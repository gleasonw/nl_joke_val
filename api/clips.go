package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	sq "github.com/Masterminds/squirrel"
	"gorm.io/gorm"
)

type Clip struct {
	ClipID    string    `json:"clip_id"`
	Count     int       `json:"count"`
	Time      time.Time `json:"time"`
	Thumbnail string    `json:"thumbnail"`
}

type ClipCountsInput struct {
	EmoteID int `query:"emote_id" default:"2"`
	SpanQuery
	Grouping string    `query:"grouping" default:"hour" enum:"25 seconds,1 minute,5 minutes,15 minutes,1 hour,1 day"`
	Order    string    `query:"order" default:"DESC" enum:"ASC,DESC"`
	Limit    int       `query:"limit" default:"10"`
	From     time.Time `query:"from"`
}

type ClipCountsOutput struct {
	Body []Clip `json:"clips"`
}

// when discovering high rolling sum, we want to eliminate building values
// eg, row@6:45:40: 105, row@6:45:50: 120, row@6:46:00: 110, we only want the max row to avoid overlapping
// the solution is to filter rows within the likelyBitLength window
const likelyBitLength = "1 minutes"

func selectClipsFromEmotePeaks(p ClipCountsInput, db *gorm.DB) (*ClipCountsOutput, error) {
	fmt.Println("fetching clips for input", p)

	var query string

	// we want just the x top comedic segments, but some segments have many clips in the top rankings
	// so we limit to a reasonable value.
	limitMap := map[string]int{
		"25 seconds": 100,
		"1 minute":   300,
		"5 minutes":  1500,
		"15 minutes": 4500,
		"1 hour":     18000,
		"1 day":      432000,
	}

	rollingSumQuery := fmt.Sprintf(`
	SELECT created_at, SUM(count) OVER (                                                   
		ORDER BY created_at                                                                    
		RANGE BETWEEN INTERVAL '%s' PRECEDING AND CURRENT ROW
	) AS rolling_sum
	FROM emote_counts
	WHERE emote_id = $2
	`, p.Grouping)

	if !p.From.IsZero() {
		rollingSumQuery = fmt.Sprintf(`
			%s
			AND emote_counts.created_at >= '%s' AND emote_counts.created_at < '%s'
			`,
			rollingSumQuery,
			p.From.Format("2006-01-02 15:04:05"),
			p.From.Add(time.Hour*24).Format("2006-01-02 15:04:05"))
	} else if p.Span != "" && p.Span != AllTime {
		rollingSumQuery = fmt.Sprintf(`
			%s 
			AND created_at >= (
				SELECT MAX(created_at) - INTERVAL '%s'
				FROM emote_counts
			)`, rollingSumQuery, p.Span)

	}

	rollingSumQuery = fmt.Sprintf("%s ORDER BY rolling_sum %s LIMIT %d", rollingSumQuery, p.Order, limitMap[p.Grouping])

	query = fmt.Sprintf(`
	WITH RollingSums AS (%s),
	RankedIntervals AS (
		SELECT created_at, rolling_sum, ROW_NUMBER() 
		OVER (
			ORDER BY rolling_sum %s, created_at DESC
		) AS rn
		FROM RollingSums
	),
	FilteredIntervals AS (
		SELECT r1.created_at AS max_created_at, r1.rolling_sum
		FROM RankedIntervals r1
		WHERE NOT EXISTS (
			SELECT 1
		    	FROM RankedIntervals r2
		    	WHERE r2.rn < r1.rn
		      	AND r2.created_at >= r1.created_at - INTERVAL '%s'
		      	AND r2.created_at <= r1.created_at + INTERVAL '%s'
		)
		LIMIT $1
	)
	SELECT fi.rolling_sum as count, ec.created_at AS time, ec.clip_id
	FROM FilteredIntervals fi
	CROSS JOIN LATERAL (
		SELECT 
		    ec.created_at, 
		    ec.clip_id, 
		    ec.count
		FROM emote_counts ec
		WHERE ec.created_at BETWEEN fi.max_created_at - INTERVAL '25 seconds' AND fi.max_created_at + INTERVAL '1 second'
		AND ec.emote_id = $2
		ORDER BY ec.count %s
		LIMIT 1
	) ec;
	`, rollingSumQuery, p.Order, likelyBitLength, likelyBitLength, p.Order)

	var clips []Clip
	err := db.Raw(query, p.Limit, p.EmoteID).Scan(&clips).Error
	if err != nil {
		fmt.Println(err)
		return &ClipCountsOutput{}, err
	}
	return &ClipCountsOutput{
		clips,
	}, nil
}

type NearestClipInput struct {
	Time time.Time `query:"time"`
}

type NearestClipOutput struct {
	Body Clip
}

func selectNearestClip(p NearestClipInput, db *gorm.DB) (*NearestClipOutput, error) {
	var clip Clip
	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	// twitch captures ~20 seconds before the moment we create a clip. Clip last
	// ~30 seconds. The range filter attempts to get a clip with an offset
	// that captures the queried moment.
	query, args, err := psql.Select("clip_id", "created_at as time").
		From("emote_counts").
		Where(sq.GtOrEq{"created_at": p.Time.Add(8 * time.Second)}).
		Where(sq.LtOrEq{"created_at": p.Time.Add(23 * time.Second)}).
		Limit(1).
		ToSql()

	if err != nil {
		fmt.Println(err)
		return &NearestClipOutput{}, err
	}

	dbError := db.Raw(query, args...).Scan(&clip).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &NearestClipOutput{}, dbError
	}

	return &NearestClipOutput{clip}, nil

}

type AllTimeClipsInput struct {
	Limit    int   `query:"limit"`
	Cursor   int   `query:"cursor"`
	EmoteIDs []int `query:"emote_ids"`
	SpanQuery
}

type EmoteAllTime struct {
	EmoteID  int
	EmoteURL string
	Code     string
	Clips    []Clip
}

type EmoteWithClips struct {
	EmoteID  int       `json:"emote_id"`
	EmoteUrl string    `json:"emote_url"`
	Code     string    `json:"code"`
	Span     TimeRange `json:"span"`
	Sum      int       `json:"sum"`
	Clips    []TopClip `json:"clips"`
}

type AllTimeClipsOutput struct {
	Body []EmoteWithClips
}

// Define a custom type for the union values
type TimeRange string

const (
	AllTime       TimeRange = "all"
	Last30Minutes TimeRange = "30 minutes"
	LastHour      TimeRange = "1 hour"
	Last9Hours    TimeRange = "9 hours"
	CurrentMonth  TimeRange = "1 month"
	CurrentWeek   TimeRange = "1 week"
	CurrentDay    TimeRange = "1 day"
)

type ClipUpdateResult struct {
	out     *ClipCountsOutput
	emoteID int
	err     error
}

var timeSpanValidateArray = []TimeRange{
	"30 minutes",
	"1 hour",
	"9 hours",
	"1 week",
	"1 month",
	"1 year",
	"all",
}

func topClipsToEmoteWithClips(topClips []TopClip, emoteIdToSpanSum map[int]EmoteSum) []EmoteWithClips {
	emoteWithClipsMap := make(map[int]*EmoteWithClips)

	for _, topClip := range topClips {
		if _, ok := emoteWithClipsMap[topClip.EmoteID]; !ok {
			emoteWithClipsMap[topClip.EmoteID] = &EmoteWithClips{
				EmoteID:  topClip.EmoteID,
				EmoteUrl: topClip.Emote.Url,
				Code:     topClip.Emote.Code,
				Span:     topClip.Span,
				Clips:    []TopClip{},
				Sum:      emoteIdToSpanSum[topClip.EmoteID].Sum,
			}
		}
		emoteWithClipsMap[topClip.EmoteID].Clips = append(emoteWithClipsMap[topClip.EmoteID].Clips, topClip)
	}

	var emoteWithClips []EmoteWithClips

	for _, emote := range emoteWithClipsMap {
		emoteWithClips = append(emoteWithClips, *emote)
	}

	return emoteWithClips
}

func topClips(span TimeRange, emotes []Emote, db *gorm.DB) (chan ClipUpdateResult, error) {
	if !slices.Contains(timeSpanValidateArray, span) {
		return nil, fmt.Errorf("invalid time span, %s", span)
	}

	numQueries := len(emotes)
	numWorkers := 10
	jobs := make(chan ClipCountsInput, numQueries)
	results := make(chan ClipUpdateResult, numQueries)
	var wg sync.WaitGroup

	for w := range numWorkers {
		wg.Add(1)

		go func(id int) {
			defer wg.Done()
			fmt.Printf("clip worker %d started\n", id)

			for input := range jobs {
				res, err := selectClipsFromEmotePeaks(input, db)

				results <- ClipUpdateResult{
					out:     res,
					err:     err,
					emoteID: input.EmoteID,
				}
			}
		}(w)
	}

	limitForSpan := allTimeLimitForSpan(span)

	for _, emoteToQuery := range emotes {
		jobs <- ClipCountsInput{
			EmoteID:   int(emoteToQuery.ID),
			SpanQuery: SpanQuery{Span: span},
			Grouping:  "25 seconds",
			Limit:     limitForSpan,
			Order:     "DESC",
		}
	}

	close(jobs)

	wg.Wait()

	close(results)

	return results, nil
}

func initializeTopClipsStore(timeSpan TimeRange, emotes []Emote, db *gorm.DB) error {
	results, err := topClips(timeSpan, emotes, db)

	if err != nil {
		return err
	}

	clipBatches := make([]TopClip, 0, len(emotes)*allTimeLimitForSpan(timeSpan))

	for res := range results {
		if res.err != nil {
			fmt.Println("error fetching clips for emote", res.err)
			continue
		}

		for index, clip := range res.out.Body {
			clipBatches = append(clipBatches, TopClip{
				ClipID:  clip.ClipID,
				EmoteID: res.emoteID,
				Count:   clip.Count,
				Span:    timeSpan,
				Rank:    index + 1,
			})
		}
	}

	fmt.Println("clips to insert: ", len(clipBatches))

	concurrentBatchInsert(db, clipBatches)

	return nil
}

func fetchClipData(clipID string, tokenManager TokenManager) (*TwitchClip, error) {
	env := GetConfig()
	var twitchClipResponse TwitchCipResponse

	url := fmt.Sprintf("https://api.twitch.tv/helix/clips?id=%s", clipID)

	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		fmt.Println("error creating request", err)
		return nil, err
	}

	request.Header.Set("Client-ID", env.ClientId)
	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenManager.AccessToken))

	resp, err := http.DefaultClient.Do(request)
	if err != nil {
		fmt.Println("error fetching clip data", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	fmt.Println(resp.Body)

	if err := json.NewDecoder(resp.Body).Decode(&twitchClipResponse); err != nil {
		return nil, fmt.Errorf("error decoding clip data: %w", err)
	}

	if len(twitchClipResponse.Data) == 0 {
		return &TwitchClip{}, fmt.Errorf("no clip data found")
	}

	return &twitchClipResponse.Data[0], nil
}

func allTimeLimitForSpan(span TimeRange) int {
	//the idea being, smaller time spans have fewer interesting segments, so why pull more...
	switch span {
	case "30 minutes":
		return 10
	case "1 hour":
		return 10
	case "9 hours":
		return 10
	case "1 week":
		return 10
	case "1 month":
		return 20
	case "1 year":
		return 50
	default:
		return 10
	}
}

var timeSpansToTrack = []TimeRange{
	"9 hours",
	"1 week",
	"1 month",
	"1 year",
	AllTime,
}

func heroTopClips(input *SpanQuery, db *gorm.DB) (*AllTimeClipsOutput, error) {
	grouping := "day"
	if input.Span == Last9Hours {
		grouping = "hour"
	}
	topTwentyEmotesPastSpan, err := selectSums(db, EmoteSumInput{
		Span:     string(input.Span),
		Limit:    20,
		Grouping: grouping,
	})
	if err != nil {
		fmt.Println("error fetching top 20 emotes", err)
		return &AllTimeClipsOutput{}, err
	}

	emoteIds := make([]int, 0, len(topTwentyEmotesPastSpan.Body.Emotes))

	for _, emote := range topTwentyEmotesPastSpan.Body.Emotes {
		emoteIds = append(emoteIds, emote.EmoteID)
	}
	emoteIdToSpanSum := make(map[int]EmoteSum, len(topTwentyEmotesPastSpan.Body.Emotes))
	for _, emote := range topTwentyEmotesPastSpan.Body.Emotes {
		emoteIdToSpanSum[emote.EmoteID] = emote
	}
	fmt.Println(emoteIdToSpanSum)

	results, err := storedTopClips(input.Span, emoteIds, db)
	if err != nil {
		fmt.Println("error fetching clips for emote", err)
		return &AllTimeClipsOutput{}, err
	}
	emotesWithClips := topClipsToEmoteWithClips(results, emoteIdToSpanSum)

	return &AllTimeClipsOutput{Body: emotesWithClips}, nil
}

func storedTopClips(span TimeRange, emoteIds []int, db *gorm.DB) ([]TopClip, error) {
	var results []TopClip

	err := db.Where("emote_id IN ?", emoteIds).
		Where("span = ?", span).
		Order("rank ASC").
		Preload("Emote").
		Preload("Clip").
		Find(&results).Error
	if err != nil {
		fmt.Println("error fetching clips for emote", err)
		return nil, err
	}
	return results, nil
}

func initializeTopClips(db *gorm.DB) error {
	emotes, err := getEmotesInDB(db)
	if err != nil {
		return err
	}

	emotesToInit := make([]Emote, 0, len(emotes))

	for _, value := range emotes {
		emotesToInit = append(emotesToInit, value)
	}

	db.Exec("DELETE FROM top_clips")

	for _, span := range timeSpansToTrack {
		fmt.Println("====")
		fmt.Printf("initializing top clips for %s\n", span)
		fmt.Println("====")
		err = initializeTopClipsStore(span, emotesToInit, db)
	}
	return nil
}

func emoteSpanKey(emoteID int, span TimeRange) string {
	return fmt.Sprintf("%d-%s", emoteID, span)
}

func timeStringToDuration(timeString TimeRange) (time.Duration, error) {
	switch timeString {
	case "1 minute":
		return time.Minute, nil
	case "30 minutes":
		return 30 * time.Minute, nil
	case "1 hour":
		return time.Hour, nil
	case "9 hours":
		return 9 * time.Hour, nil
	case "1 week":
		return 7 * 24 * time.Hour, nil
	case "1 month":
		return 30 * 24 * time.Hour, nil
	case "1 year":
		return 365 * 24 * time.Hour, nil
	case "all":
		return 0, nil
	default:
		return 0, fmt.Errorf("invalid time span, %s", timeString)
	}
}

func refreshTopClipsCache(db *gorm.DB) error {

	emoteMap, err := getEmotesInDB(db)
	if err != nil {
		return err
	}

	emotesToRefresh := make([]Emote, 0, len(emoteMap))
	emoteIds := make([]int, 0, len(emoteMap))

	for _, value := range emoteMap {
		emotesToRefresh = append(emotesToRefresh, value)
		emoteIds = append(emoteIds, int(value.ID))
	}

	clipsToPush := make([]TopClip, 0, len(emoteMap)*50)

	// we run this function every time Nl logs off. the theory is to get the top daily clips,
	// then compare to all time results, updating rankings based on counts, removing old clips.
	// this should be more efficient than recomputing the entire rankings every time Nl logs off.
	dailyResults, err := topClips("9 hours", emotesToRefresh, db)
	if err != nil {
		return fmt.Errorf("error fetching daily clips", err)
	}
	emoteSpanToClips := make(map[string][]Clip)
	for result := range dailyResults {
		for _, span := range timeSpansToTrack {
			key := emoteSpanKey(result.emoteID, span)
			emoteSpanToClips[key] = append(emoteSpanToClips[key], result.out.Body...)
		}
	}

	for _, span := range timeSpansToTrack {
		fmt.Println("====")
		fmt.Printf("refreshing top clips for %s\n", span)
		fmt.Println("====")

		storedTopForSpan, err := storedTopClips(span, emoteIds, db)
		if err != nil {
			return fmt.Errorf("error fetching stored top clips", err)
		}

		duration, err := timeStringToDuration(span)
		if err != nil {
			return fmt.Errorf("error converting time span to duration", err)
		}
		lowerTimeLimit := time.Now().Add(-duration)
		fmt.Println("time limt: ", lowerTimeLimit)

		for _, result := range storedTopForSpan {
			if span != "all" && result.Clip.CreatedAt.Before(lowerTimeLimit) {
				// clip is too old, ignore it
				continue
			}
			key := emoteSpanKey(result.EmoteID, span)
			emoteSpanToClips[key] = append(emoteSpanToClips[key], Clip{
				ClipID: result.ClipID,
				Count:  result.Count,
			})
		}

		fmt.Println("emote to clips: ", len(emoteSpanToClips))
	}
	for emoteSpan, clips := range emoteSpanToClips {
		slices.SortFunc(clips, func(i, j Clip) int {
			if i.Count > j.Count {
				return -1
			}
			return 1
		})
		// ensure there's only one of each ClipID
		filteredClips := make([]Clip, 0, len(clips))
		seenClipIds := make(map[string]struct{})
		for _, clip := range clips {
			if _, ok := seenClipIds[clip.ClipID]; !ok {
				filteredClips = append(filteredClips, clip)
				seenClipIds[clip.ClipID] = struct{}{}
			}
		}

		splitText := strings.Split(emoteSpan, "-")
		emoteID, err := strconv.Atoi(splitText[0])
		if err != nil {
			return fmt.Errorf("error converting emote id to int", err)
		}
		span := splitText[1]
		limitForSpan := allTimeLimitForSpan(TimeRange(span))
		if limitForSpan > len(filteredClips) {
			limitForSpan = len(filteredClips)
		}
		clipsToPushForEmote := (filteredClips)[:limitForSpan]
		if len(clipsToPushForEmote) == 0 {
			continue
		}

		for rank, clip := range clipsToPushForEmote {
			clipsToPush = append(clipsToPush, TopClip{
				ClipID:  clip.ClipID,
				EmoteID: emoteID,
				Rank:    rank + 1,
				Count:   clip.Count,
				Span:    TimeRange(span),
			})
		}

	}
	fmt.Println("clips to push: ", len(clipsToPush))
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM top_clips").Error; err != nil {
			return fmt.Errorf("error deleting old top clips: %v", err)
		}

		if err := tx.CreateInBatches(&clipsToPush, 1000).Error; err != nil {
			return fmt.Errorf("error inserting new top clips: %v", err)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("error refreshing top clips", err)
	}
	return nil
}

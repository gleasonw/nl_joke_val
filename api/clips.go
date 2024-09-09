package main

import (
	"fmt"
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
	EmoteID  int       `query:"emote_id" default:"2"`
	Span     string    `query:"span" default:"9 hours" enum:"30 minutes,1 hour,9 hours,1 week,1 month,1 year"`
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

	var query string

	// we want just the x top bits, but some bit have many clips in the top rankings
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
	} else if p.Span != "" {
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
	Limit  int `query:"limit"`
	Cursor int `query:"cursor"`
}

type EmoteAllTime struct {
	EmoteID  int
	EmoteURL string
	Code     string
	Clips    []Clip
}

type AllTimeClipsOutput struct {
	Body []EmoteAllTime
}

// todo: allow for a slice of emote ids in clip counts, to sum
// todo: this function should be cached by args, refreshed daily.
func selectAllTimeClips(p *AllTimeClipsInput, db *gorm.DB) (*AllTimeClipsOutput, error) {

	topTwentyEmotesPastMonth, err := selectSums(db, EmoteSumInput{
		From:     time.Now().AddDate(0, -1, 0),
		Limit:    20,
		Grouping: "day",
	})

	if err != nil {
		fmt.Println(err)
		return &AllTimeClipsOutput{}, err
	}

	topClipsForEmotes := make([]EmoteAllTime, 0, len(topTwentyEmotesPastMonth.Body.Emotes))

	// todo start 20 buffered goroutines and a wait group
	// fetch thumbnails for top clips that don't have them

	for _, emote := range topTwentyEmotesPastMonth.Body.Emotes {
		clips, err := selectClipsFromEmotePeaks(ClipCountsInput{
			EmoteID:  emote.EmoteID,
			Grouping: "25 seconds",
			Limit:    10,
			Order:    "DESC",
		}, db)

		if err != nil {
			fmt.Println("Error fetching clips for emote", err)
			continue
		}

		topClipsForEmotes = append(topClipsForEmotes, EmoteAllTime{
			EmoteID:  emote.EmoteID,
			EmoteURL: emote.EmoteURL,
			Code:     emote.Code,
			Clips:    clips.Body,
		})
	}

	return &AllTimeClipsOutput{Body: topClipsForEmotes}, nil

}

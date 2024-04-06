package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	sq "github.com/Masterminds/squirrel"
	"gorm.io/gorm"
)

type User struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	ProviderId  string `json:"providerId"`
}

type BttvEmote struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	ImageType string `json:"imageType"`
	Animated  bool   `json:"animated"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
	User      User   `json:"user"`
}

type BTTVResponse struct {
	ID            string        `json:"id"`
	Bots          []interface{} `json:"bots"`
	Avatar        string        `json:"avatar"`
	ChannelEmotes []interface{} `json:"channelEmotes"`
	SharedEmotes  []BttvEmote   `json:"sharedEmotes"`
}

type EmoteSet struct {
	Emotes []BttvEmote `json:"emotes"`
}

func fetchNlEmotesFromBTTV() (EmoteSet, error) {
	req, err := http.NewRequest("GET", "https://api.betterttv.net/3/cached/users/twitch/14371185", nil)
	if err != nil {
		fmt.Println("Error creating request:", err)
		return EmoteSet{}, err
	}

	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error sending request:", err)
		return EmoteSet{}, err
	}

	defer resp.Body.Close()

	var bttvResponse BTTVResponse
	err = json.NewDecoder(resp.Body).Decode(&bttvResponse)

	if err != nil {
		fmt.Println("Error decoding response:", err)
		return EmoteSet{}, err
	}

	emoteSet := EmoteSet{Emotes: bttvResponse.SharedEmotes}
	return emoteSet, nil

}

type EmotePerformanceInput struct {
	Date     time.Time `query:"date"`
	Grouping string    `query:"grouping" enum:"hour,day" default:"day"`
	Limit    int       `query:"limit" default:"20" minimum:"1"`
}

type LatestEmotePerformanceInput struct {
	Limit    int    `query:"limit" default:"10" minimum:"1"`
	Grouping string `query:"grouping" enum:"hour,day" default:"hour"`
}

type EmoteFullRow struct {
	EmoteURL          string
	EmoteID           int
	Code              string
	Count             float64
	Average           float64
	Difference        float64
	PercentDifference float64
}

type EmoteReport struct {
	Emotes []EmoteFullRow
	Input  EmotePerformanceInput
}

type TopPerformingEmotesOutput struct {
	Body EmoteReport
}

func statementBuilder() sq.StatementBuilderType {
	return sq.StatementBuilder.PlaceholderFormat(sq.Dollar)
}

func recentHourlyAverage() sq.SelectBuilder {
	return recentAverage(averageHourlyViewAggregate)
}

func recentDailyAverage() sq.SelectBuilder {
	return recentAverage(averageDailyViewAggregate)
}

func recentAverage(averageAggregate string) sq.SelectBuilder {
	return statementBuilder().
		Select("DISTINCT ON (emote_id) emote_id, average").
		From(averageAggregate).
		OrderBy("emote_id, bucket DESC")

}

type LatestEmoteReport struct {
	Emotes []EmoteFullRow
	Input  LatestEmotePerformanceInput
}

type LatestEmotePerformanceOutput struct {
	Body LatestEmoteReport
}

func trendiestEmoteIDs(p LatestEmotePerformanceInput, db *gorm.DB) ([]int, error) {
	e, error := selectLatestPercentGrowth(p, db)

	if error != nil {
		fmt.Println("error retrieving trendiest emote ids")
		return nil, error
	}

	trendiestEmotes := make([]int, 0, len(e.Body.Emotes))

	for _, emoteRow := range e.Body.Emotes {
		trendiestEmotes = append(trendiestEmotes, int(emoteRow.EmoteID))
	}

	return trendiestEmotes, nil
}

func selectLatestPercentGrowth(p LatestEmotePerformanceInput, db *gorm.DB) (*LatestEmotePerformanceOutput, error) {
	var currentSumQuery, avgSeriesLatestPeriod sq.SelectBuilder

	switch p.Grouping {
	case "hour":
		currentSumQuery = statementBuilder().
			Select("sum(count) as sum", "emote_id").
			From("emote_counts").
			Where("created_at >= now() - interval '1 hour'").
			GroupBy("emote_id")

		avgSeriesLatestPeriod = recentHourlyAverage()
	case "day":
		currentSumQuery = statementBuilder().
			Select("sum(count) as sum", "emote_id").
			From("emote_counts").
			Where("created_at >= now() - interval '1 day'").
			GroupBy("emote_id")

		avgSeriesLatestPeriod = recentDailyAverage()
	default:
		fmt.Println("Unknown grouping")
		return &LatestEmotePerformanceOutput{}, nil
	}

	result, err := selectGrowth(currentSumQuery, avgSeriesLatestPeriod, p.Limit, db)

	if err != nil {
		return &LatestEmotePerformanceOutput{}, err
	}

	return &LatestEmotePerformanceOutput{LatestEmoteReport{Emotes: result, Input: p}}, nil

}

func selectPercentGrowthDay(p EmotePerformanceInput, db *gorm.DB) (*TopPerformingEmotesOutput, error) {

	avgSeriesLatestPeriod := recentDailyAverage()
	currentSumQuery := statementBuilder().
		Select("sum", "bucket", "emote_id").
		From(dailyViewAggregate)

	if !p.Date.IsZero() {
		currentSumQuery = filterBucketByDay(currentSumQuery, p.Date)
	} else {
		currentSumQuery = currentSumQuery.Where(fmt.Sprintf("bucket = (SELECT MAX(bucket) FROM %s)", dailyViewAggregate))
	}

	result, err := selectGrowth(currentSumQuery, avgSeriesLatestPeriod, p.Limit, db)

	if err != nil {
		return &TopPerformingEmotesOutput{}, err
	}

	return &TopPerformingEmotesOutput{EmoteReport{Emotes: result, Input: p}}, nil

}

func selectGrowth(currentSumQuery sq.SelectBuilder, averageSumQuery sq.SelectBuilder, limit int, db *gorm.DB) ([]EmoteFullRow, error) {
	baseQuery := statementBuilder().
		Select("average", "sum", "current_sum.emote_id as emote_id").
		FromSelect(averageSumQuery, "avg_series").
		JoinClause(currentSumQuery.
			Prefix("JOIN (").
			Suffix(") current_sum ON current_sum.emote_id = avg_series.emote_id"))

	statQuery := statementBuilder().
		Select("*", "series.emote_id as emote_id", "sum - average as difference", "COALESCE((sum - average) / Nullif(average, 0) * 100, 0) as percent_difference", "url as emote_url").
		FromSelect(baseQuery, "series").
		Join("emotes on emotes.id = series.emote_id")

	weightedSortQuery, args, err := statementBuilder().
		Select("*", "sum as count", "percent_difference * sum as weighted_percent_difference").
		FromSelect(statQuery, "stat").
		OrderBy("weighted_percent_difference DESC").
		Limit(uint64(limit)).
		ToSql()

	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	averages := []EmoteFullRow{}

	err = db.Raw(weightedSortQuery, args...).Scan(&averages).Error

	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	return averages, nil
}

type EmoteSumInput struct {
	Span     string    `query:"span" enum:"1 minute,30 minutes,1 hour,9 hours,custom" default:"9 hours"`
	Limit    int       `query:"limit" default:"10" minimum:"1"`
	From     time.Time `query:"from"`
	Grouping string    `query:"grouping" enum:"second,minute,hour,day" default:"minute"`
}

type LatestEmoteSumInput struct {
	Span  string `query:"span" enum:"1 minute,30 minutes,1 hour,9 hours,custom" default:"9 hours"`
	Limit int    `query:"limit" default:"10" minimum:"1"`
}

type EmoteSum struct {
	EmoteID int
	Code    string
	Percent float64
	Sum     int
}

type EmoteSumReport struct {
	Emotes []EmoteSum
	Input  EmoteSumInput
}

type EmoteSumOutput struct {
	Body EmoteSumReport
}

func topEmoteIds(db *gorm.DB, p EmoteSumInput) ([]int, error) {
	result, err := selectSums(db, EmoteSumInput{
		Grouping: p.Grouping,
		From:     p.From,
		Span:     p.Span,
		Limit:    p.Limit,
	})

	if err != nil {
		return nil, err
	}

	topEmoteIds := make([]int, 0, len(result.Body.Emotes))

	for _, row := range result.Body.Emotes {
		topEmoteIds = append(topEmoteIds, row.EmoteID)
	}

	return topEmoteIds, nil
}

func selectSums(db *gorm.DB, p EmoteSumInput) (*EmoteSumOutput, error) {
	aggregateForGrouping, ok := groupingToView[p.Grouping]

	if !ok {
		panic("Invalid grouping while trying to get aggregate in GetTopDensityEmotes: " + p.Grouping)
	}

	filteredCountRows := statementBuilder().Select("sum(sum) as sum", "emote_id").
		From(aggregateForGrouping).
		Where(statementBuilder().Select("id").From("emotes").Where("code = 'two'").Prefix("emote_id not in (").Suffix(")")).
		GroupBy("emote_id")

	if !p.From.IsZero() {
		filteredCountRows = filterBucketByDay(filteredCountRows, p.From)
	} else if p.Span != "" {
		filteredCountRows = filterBucketBySpan(filteredCountRows, p.Span)
	}

	return queryEmoteSums(db, filteredCountRows, p)

}

func selectLatestSums(p LatestEmoteSumInput, db *gorm.DB) (*EmoteSumOutput, error) {
	filteredCountRows := statementBuilder().Select("sum(count) as sum", "emote_id").
		From("emote_counts").
		Where(statementBuilder().Select("id").From("emotes").Where("code = 'two'").Prefix("emote_id not in (").Suffix(")")).
		GroupBy("emote_id")

	filteredCountRows = addFilterCreatedAtSpan(filteredCountRows, p.Span)

	return queryEmoteSums(db, filteredCountRows, EmoteSumInput{Span: p.Span, Limit: 10})
}

func queryEmoteSums(db *gorm.DB, filteredEmoteSums sq.SelectBuilder, p EmoteSumInput) (*EmoteSumOutput, error) {
	crossJoinTotal := statementBuilder().Select("sum(sum) as total_count").
		FromSelect(filteredEmoteSums, "count_rows").
		Prefix("(").Suffix(") total")

	crossJoinQuery, _, err := crossJoinTotal.ToSql()

	if err != nil {
		return &EmoteSumOutput{}, err
	}

	baseQuery := statementBuilder().Select("emote_id, code, COALESCE((sum / NULLIF(total_count, 0)), 0) * 100 AS percent, sum").
		FromSelect(filteredEmoteSums, "count_rows").
		OrderBy("percent DESC").
		Limit(uint64(p.Limit))

	query, baseArgs, err := baseQuery.
		CrossJoin(crossJoinQuery).
		Join("emotes on emotes.id = emote_id").
		ToSql()

	if err != nil {
		return &EmoteSumOutput{}, err
	}

	var densities []EmoteSum

	err = db.Raw(query, baseArgs...).Scan(&densities).Error

	if err != nil {
		fmt.Println("Error executing query:", err)
		return nil, err
	}

	return &EmoteSumOutput{Body: EmoteSumReport{
		Emotes: densities,
		Input:  p,
	}}, nil
}

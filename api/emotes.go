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

// fetch northernlion's emotes from bttv
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
	Limit    int       `query:"limit" default:"10" minimum:"1"`
}

type LatestEmotePerformanceInput struct {
	Limit    int    `query:"limit" default:"10" minimum:"1"`
	Grouping string `query:"grouping" enum:"hour,day" default:"hour"`
}

type EmoteFullRow struct {
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
	return statementBuilder().
		Select("average", "emote_id").
		From("avg_hourly_sum_three_months").
		Where(statementBuilder().
			Select("max(bucket) from avg_hourly_sum_three_months").
			Prefix("avg_hourly_sum_three_months.bucket = (").
			Suffix(")"))
}

func recentDailyAverage() sq.SelectBuilder {
	return statementBuilder().
		Select("average", "emote_id").
		From("avg_daily_sum_three_months").
		Where(statementBuilder().
			Select("max(bucket) from avg_daily_sum_three_months").
			Prefix("avg_daily_sum_three_months.bucket = (").
			Suffix(")"))
}

type LatestEmoteReport struct {
	Emotes []EmoteFullRow
	Input  LatestEmotePerformanceInput
}

type LatestEmotePerformanceOutput struct {
	Body LatestEmoteReport
}

func GetLatestEmotePerformance(p LatestEmotePerformanceInput, db *gorm.DB) (*LatestEmotePerformanceOutput, error) {
	var currentSumQuery, avgSeriesLatestPeriod sq.SelectBuilder

	switch p.Grouping {
	case "hour":
		currentSumQuery = statementBuilder().
			Select("sum(sum) as sum", "emote_id").
			From(hourlyViewAggregate).
			Where(statementBuilder().Select("MAX(bucket) - '1 hour'::interval").
				From(secondViewAggregate).
				Prefix("bucket >= (").
				Suffix(")")).
			GroupBy("emote_id")

		avgSeriesLatestPeriod = recentHourlyAverage()
	case "day":
		currentSumQuery = statementBuilder().
			Select("sum", "emote_id").
			From(dailyViewAggregate).
			Where(statementBuilder().Select("MAX(DATE(bucket))").
				From(hourlyViewAggregate).
				Prefix("DATE(bucket) = (").
				Suffix(")"))

		avgSeriesLatestPeriod = recentDailyAverage()
	default:
		fmt.Println("Unknown grouping")
		return &LatestEmotePerformanceOutput{}, nil
	}

	currentSumQuery = currentSumQuery.Limit(uint64(p.Limit))

	result, err := selectEmotePerformance(currentSumQuery, avgSeriesLatestPeriod, db)

	if err != nil {
		return &LatestEmotePerformanceOutput{}, err
	}

	return &LatestEmotePerformanceOutput{LatestEmoteReport{Emotes: result, Input: p}}, nil

}

func GetTopPerformingEmotes(p EmotePerformanceInput, db *gorm.DB) (*TopPerformingEmotesOutput, error) {
	var currentSumQuery, avgSeriesLatestPeriod sq.SelectBuilder

	switch p.Grouping {
	case "hour":
		currentSumQuery = statementBuilder().
			Select("sum", "bucket", "emote_id", "ROW_NUMBER() OVER (PARTITION BY emote_id ORDER BY bucket DESC) AS rn").
			From(hourlyViewAggregate).
			Where(sq.Eq{"DATE(bucket)": p.Date.Format("2006-01-02")}).
			Where("rn = 1")

		avgSeriesLatestPeriod = recentHourlyAverage()

	case "day":
		currentSumQuery = statementBuilder().
			Select("sum", "bucket", "emote_id").
			From(dailyViewAggregate).
			Where(sq.Eq{"DATE(bucket)": p.Date.Format("2006-01-02")})

		avgSeriesLatestPeriod = recentDailyAverage()

	default:
		fmt.Println("Unknown grouping")
		return &TopPerformingEmotesOutput{}, nil
	}

	currentSumQuery = currentSumQuery.Limit(uint64(p.Limit))

	result, err := selectEmotePerformance(currentSumQuery, avgSeriesLatestPeriod, db)

	if err != nil {
		return &TopPerformingEmotesOutput{}, err
	}

	return &TopPerformingEmotesOutput{EmoteReport{Emotes: result, Input: p}}, nil

}

func selectEmotePerformance(currentSumQuery sq.SelectBuilder, averageSumQuery sq.SelectBuilder, db *gorm.DB) ([]EmoteFullRow, error) {
	baseQuery := statementBuilder().
		Select("average", "sum", "current_sum.emote_id as emote_id").
		FromSelect(averageSumQuery, "avg_series").
		JoinClause(currentSumQuery.
			Prefix("JOIN (").
			Suffix(") current_sum ON current_sum.emote_id = avg_series.emote_id"))

	statQuery := statementBuilder().
		Select("average", "sum", "code", "series.emote_id as emote_id", "sum - average as difference", "COALESCE((sum - average) / Nullif(average, 0) * 100, 0) as percent_difference").
		FromSelect(baseQuery, "series").
		Join("emotes on emotes.id = series.emote_id")

	weightedSortQuery, args, err := statementBuilder().
		Select("average", "sum as count", "code", "emote_id", "difference", "percent_difference", "percent_difference * sum as weighted_percent_difference").
		FromSelect(statQuery, "stat").
		OrderBy("weighted_percent_difference DESC").
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

type EmoteSum struct {
	EmoteID int
	Code    string
	Percent float64
	Count   int
}

type EmoteSumReport struct {
	Emotes []EmoteSum
	Input  EmoteSumInput
}

type TopDensityEmotesOutput struct {
	Body EmoteSumReport
}

func selectEmoteSums(db *gorm.DB, p EmoteSumInput) (*TopDensityEmotesOutput, error) {
	psql := statementBuilder()

	aggregateForGrouping, ok := groupingToView[p.Grouping]

	if !ok {
		panic("Invalid grouping while trying to get aggregate in GetTopDensityEmotes: " + p.Grouping)
	}

	filteredCountRows := psql.
		Select("*").
		From(aggregateForGrouping).
		Where(psql.Select("id").From("emotes").Where("code = 'two'").Prefix("emote_id not in (").Suffix(")"))

	if !p.From.IsZero() {
		filteredCountRows = filterByDay(filteredCountRows, p.From)
	} else if p.Span != "" {
		filteredCountRows = filterBySpan(filteredCountRows, p.Span)
	}

	crossJoinTotal := psql.Select("sum(sum) as total_count").
		FromSelect(filteredCountRows, "count_rows").
		Prefix("(").Suffix(") total")

	crossJoinQuery, _, err := crossJoinTotal.ToSql()

	if err != nil {
		return &TopDensityEmotesOutput{}, err
	}

	baseQuery := psql.Select("emote_id, code, COALESCE((sum / NULLIF(total_count, 0)), 0) * 100 AS percent, sum").
		FromSelect(filteredCountRows, "count_rows").
		OrderBy("percent DESC").
		Limit(uint64(p.Limit))

	query, baseArgs, err := baseQuery.
		CrossJoin(crossJoinQuery).
		Join("emotes on emotes.id = emote_id").
		ToSql()

	if err != nil {
		return &TopDensityEmotesOutput{}, err
	}

	var densities []EmoteSum

	err = db.Raw(query, baseArgs...).Scan(&densities).Error

	if err != nil {
		fmt.Println("Error executing query:", err)
		return nil, err
	}

	return &TopDensityEmotesOutput{Body: EmoteSumReport{
		Emotes: densities,
		Input:  p,
	}}, nil

}

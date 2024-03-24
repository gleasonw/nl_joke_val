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
}

type LatestEmotePerformanceInput struct {
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
			Select("sum", "bucket", "emote_id").
			From(hourlyViewAggregate).
			Where(statementBuilder().Select("MAX(bucket) - '9 hours'::interval").
				From(hourlyViewAggregate).
				Prefix("bucket >= (").
				Suffix(")"))

		avgSeriesLatestPeriod = recentHourlyAverage()
	case "day":
		currentSumQuery = statementBuilder().
			Select("sum", "bucket", "emote_id").
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
			Select("sum", "bucket", "emote_id").
			From(hourlyViewAggregate).
			Where(sq.Eq{"DATE(bucket)": p.Date.Format("2006-01-02")})

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

	result, err := selectEmotePerformance(currentSumQuery, avgSeriesLatestPeriod, db)

	if err != nil {
		return &TopPerformingEmotesOutput{}, err
	}

	return &TopPerformingEmotesOutput{EmoteReport{Emotes: result, Input: p}}, nil

}

func selectEmotePerformance(currentSumQuery sq.SelectBuilder, averageSumQuery sq.SelectBuilder, db *gorm.DB) ([]EmoteFullRow, error) {
	baseQuery := statementBuilder().
		Select("average", "bucket", "sum", "current_sum.emote_id as emote_id").
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

type EmoteDensityInput struct {
	Span  string    `query:"span" enum:"1 minute,30 minutes,1 hour,9 hours,custom" default:"9 hours"`
	Limit int       `query:"limit" default:"10"`
	From  time.Time `query:"from"`
}

type EmoteDensity struct {
	EmoteID int
	Code    string
	Percent float64
	Count   int
}

type EmoteDensityReport struct {
	Emotes []EmoteDensity
	Input  EmoteDensityInput
}

type TopDensityEmotesOutput struct {
	Body EmoteDensityReport
}

func GetTopDensityEmotes(db *gorm.DB, p EmoteDensityInput) (*TopDensityEmotesOutput, error) {
	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	timeFilter := func(query *sq.SelectBuilder) sq.SelectBuilder {
		updated := query.Where(psql.Select("id").From("emotes").Where("code = 'two'").Prefix("emote_id not in (").Suffix(")"))
		if !p.From.IsZero() {
			return updated.Where(sq.Eq{"DATE(bucket)": p.From})
		}
		return updated.Where(psql.Select("max(bucket) from daily_sum").Prefix("daily_sum.bucket = (").Suffix(")"))
	}

	crossJoinTotal := psql.Select("sum(sum) as total_count").
		From(dailyViewAggregate).
		Where(psql.Select("id").From("emotes").Where("code = 'two'").Prefix("emote_id not in (").Suffix(")")).
		Prefix("(").Suffix(") total")

	crossJoinTotal = timeFilter(&crossJoinTotal)

	crossJoinQuery, _, err := crossJoinTotal.ToSql()

	if err != nil {
		return &TopDensityEmotesOutput{}, err
	}

	baseQuery := psql.Select("emote_id, code, COALESCE((day_sum / NULLIF(total_count, 0)), 0) * 100 AS percent, day_sum").
		From(dailyViewAggregate).
		Join("emotes on emotes.id = daily_sum.emote_id").
		OrderBy("percent DESC")

	baseQuery = timeFilter(&baseQuery)

	query, baseArgs, err := baseQuery.CrossJoin(crossJoinQuery).ToSql()

	if err != nil {
		return &TopDensityEmotesOutput{}, err
	}

	// Execute the query.
	var densities []EmoteDensity
	err = db.Raw(query, baseArgs...).Scan(&densities).Error
	if err != nil {
		fmt.Println("Error executing query:", err)
		return nil, err
	}

	return &TopDensityEmotesOutput{Body: EmoteDensityReport{
		Emotes: densities,
		Input:  p,
	}}, nil

}

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
	Grouping string    `query:"grouping" enum:"second,minute,hour,day,week,month,year" default:"minute"`
	From     time.Time `query:"from"`
}

type EmoteFullRow struct {
	EmoteID           int
	Code              string
	DaySum            float64
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

func GetTopPerformingEmotes(p EmotePerformanceInput, db *gorm.DB) (*TopPerformingEmotesOutput, error) {
	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	currentSumQuery := psql.Select("*").From("daily_sum")

	if !p.From.IsZero() {
		currentSumQuery = currentSumQuery.Where(sq.Eq{"DATE(date)": p.From.Format("2006-01-02")})
	}

	avgSeriesLatestPeriod := psql.Select("average", "emote_id").
		From("avg_daily_sum_three_months").
		Where(psql.Select("max(date) from avg_daily_sum_three_months").Prefix("avg_daily_sum_three_months.date = (").Suffix(")"))

	baseQuery := psql.Select("average", "day_sum", "current_sum.emote_id as emote_id").
		FromSelect(avgSeriesLatestPeriod, "avg_series").
		JoinClause(currentSumQuery.Prefix("JOIN (").Suffix(") current_sum ON current_sum.emote_id = avg_series.emote_id"))

	query, args, err := psql.Select("average", "day_sum", "code", "series.emote_id as emote_id", "day_sum - average as difference", "(day_sum - average) / Nullif(average, 0) * 100 as percent_difference").
		FromSelect(baseQuery, "series").
		Join("emotes on emotes.id = series.emote_id").
		OrderBy("percent_difference DESC").
		ToSql()

	if err != nil {
		fmt.Println(err)
		return &TopPerformingEmotesOutput{}, err
	}

	averages := []EmoteFullRow{}

	err = db.Raw(query, args...).Scan(&averages).Error

	if err != nil {
		fmt.Println(err)
		return &TopPerformingEmotesOutput{}, err
	}

	return &TopPerformingEmotesOutput{EmoteReport{Emotes: averages}}, nil
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
			return updated.Where(sq.Eq{"DATE(date)": p.From})
		}
		return updated.Where(psql.Select("max(date) from daily_sum").Prefix("daily_sum.date = (").Suffix(")"))
	}

	crossJoinTotal := psql.Select("sum(day_sum) as total_count").
		From("daily_sum").
		Where(psql.Select("id").From("emotes").Where("code = 'two'").Prefix("emote_id not in (").Suffix(")")).
		Prefix("(").Suffix(") total")

	crossJoinTotal = timeFilter(&crossJoinTotal)

	crossJoinQuery, _, err := crossJoinTotal.ToSql()

	if err != nil {
		return &TopDensityEmotesOutput{}, err
	}

	baseQuery := psql.Select("emote_id, code, COALESCE((day_sum / NULLIF(total_count, 0)), 0) * 100 AS percent, day_sum").
		From("daily_sum").
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

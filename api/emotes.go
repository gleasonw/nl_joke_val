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
	To       time.Time `query:"to"`
}

type EmoteFullRow struct {
	EmoteID           int
	Code              string
	CurrentSum        float64
	PastAverage       float64
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

	currentSumQuery := psql.
		Select("count", "code", "emote_id").
		FromSelect(
			psql.Select("sum(count) as count, emote_id").
				From("emote_counts").
				Where(psql.Select(fmt.Sprintf("MAX(created_at) - '%s'::interval", fmt.Sprintf("1 %s", p.Grouping))).
					From("emote_counts").
					Prefix("emote_counts.created_at >=(").
					Suffix(")")).
				GroupBy("emote_id"),
			"series").
		Join("emotes on emotes.id = series.emote_id")

	averageQuery := psql.Select("sum(count) as count, date_trunc('"+p.Grouping+"', emote_counts.created_at) as time, emote_id").
		From("emote_counts").
		GroupBy("emote_id", "time").
		OrderBy("time")

	joinEmotes := psql.
		Select("avg(count) as past_average", "code", "series.emote_id as emote_id").
		FromSelect(averageQuery, "series").
		Join("emotes on emotes.id = series.emote_id").
		GroupBy("code", "series.emote_id")

	fullQuery, args, err := psql.Select("avg_series.code, past_average, avg_series.emote_id, current_sum.count as current_sum, current_sum.count - past_average as difference, (current_sum.count - past_average) / past_average as percent_difference").
		FromSelect(joinEmotes, "avg_series").
		JoinClause(currentSumQuery.Prefix("JOIN (").Suffix(") current_sum ON current_sum.emote_id = avg_series.emote_id")).
		ToSql()

	fmt.Println(fullQuery)

	if err != nil {
		fmt.Println(err)
		return &TopPerformingEmotesOutput{}, err
	}

	averages := []EmoteFullRow{}

	err = db.Raw(fullQuery, args...).Scan(&averages).Error

	if err != nil {
		fmt.Println(err)
		return &TopPerformingEmotesOutput{}, err
	}

	return &TopPerformingEmotesOutput{EmoteReport{Emotes: averages, Input: p}}, nil

}

func GetTopDensityEmotes(db *gorm.DB) ([]Emote, error) {
	var emotes []Emote
	err := db.Find(&emotes).Error

	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	return emotes, nil
}

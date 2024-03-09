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

type EmoteAverageRow struct {
	Code        string
	EmoteID     int
	PastAverage float64
	CurrentSum  float64
}

// at some point i should learn how gorm could pull the emote struct for me
type EmotePerformance struct {
	Emote       Emote
	PastAverage float64
	CurrentSum  float64
}

type EmoteReport struct {
	Emotes   []EmoteAverageRow
	From     time.Time
	To       time.Time
	Grouping string
}

type TopPerformingEmotesOutput struct {
	Body []EmoteAverageRow
}

func GetTopPerformingEmotes(p SeriesInput, db *gorm.DB) {

	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	series := psql.Select("sum(count) as count, date_trunc('"+p.Grouping+"', emote_counts.created_at) as time, emote_id").
		From("emote_counts").
		GroupBy("emote_id", "time").
		OrderBy("time")

	seriesJoin := psql.
		Select("count", "time", "code", "series.emote_id as emote_id").
		FromSelect(series, "series").
		Join("emotes on emotes.id = series.emote_id")

	averageQuery, args, err := psql.Select("sum_series.code as code, avg(sum_series.count), sum_series.emote_id as emote_id").
		FromSelect(seriesJoin, "sum_series").
		GroupBy("sum_series.code", "sum_series.emote_id").
		ToSql()

	fmt.Println(averageQuery)

	if err != nil {
		fmt.Println(err)
		return
	}

	averages := []EmoteAverageRow{}

	err = db.Raw(averageQuery, args...).Scan(&averages).Error

	if err != nil {
		fmt.Println(err)
		return
	}

	currentSumQuery, args, err := psql.
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
		Join("emotes on emotes.id = series.emote_id").
		ToSql()

	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Println(currentSumQuery)

	currentSums := []TimeSeriesRow{}

	err = db.Raw(currentSumQuery, args...).Scan(&currentSums).Error

	if err != nil {
		fmt.Println(err)
		return
	}

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

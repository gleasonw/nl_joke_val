package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"strings"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
	"github.com/rs/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
)

type RefreshTokenStore struct {
	RefreshToken string
	CreatedAt    time.Time
}

type Message struct {
	Type int
	Data []byte
}

type TwitchResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

const secondViewAggregate = "ten_second_sum"
const minuteViewAggregate = "minute_sum"
const hourlyViewAggregate = "hourly_sum"
const dailyViewAggregate = "daily_sum"
const averageDailyViewAggregate = "avg_daily_sum"
const averageHourlyViewAggregate = "avg_hourly_sum"

type LiveStatus struct {
	IsLive bool
}

type SpanQuery struct {
	Span TimeRange `query:"span" default:"9 hours" enum:"30 minutes,1 hour,9 hours,1 week,1 month,1 year,all"`
}

func (ls *LiveStatus) setLiveStatus(liveStatusUpdate bool, db *gorm.DB) {
	if !ls.IsLive && liveStatusUpdate {
		// pog!
		ls.IsLive = true
		return
	}

	if ls.IsLive && !liveStatusUpdate {
		// nl has logged off, refresh our aggregates to get the latest stream data
		tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
		yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")

		aggregates := []string{secondViewAggregate, minuteViewAggregate, hourlyViewAggregate, dailyViewAggregate, averageDailyViewAggregate, averageHourlyViewAggregate}

		for _, agg := range aggregates {
			query := fmt.Sprintf("CALL refresh_continuous_aggregate('%s', '%s', '%s')", agg, yesterday, tomorrow)
			err := db.Exec(query).Error

			if err != nil {
				fmt.Println("error refreshing aggregate ", agg)
				continue
			}
		}

		ls.IsLive = false
		fmt.Println("succesfully refreshed aggregates")

		err := refreshTopClipsCache(db)

		if err != nil {
			fmt.Println("error refreshing top clips store", err)
			return
		}

	}
}

// live scroller for emotes, via websocket client-sidep
// add small peak chart to show the spike
// :)

func main() {

	env := GetConfig()

	db, err := gorm.Open(postgres.Open(env.DatabaseUrl))

	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "migrate":
			randomHue := rand.Float64()

			color := hsvToRGB(HSV{
				Hue:        randomHue * 360,
				Saturation: 0.6,
				Value:      0.95,
			})
			fmt.Printf("#%02x%02x%02x", color.Red, color.Green, color.Blue)

			return
		}
	}

	if err != nil {
		fmt.Println(err)
		return
	}

	liveStatus := &LiveStatus{IsLive: false}
	tokenManager := getTokenManager(db)

	go connectToTwitchChat(
		tokenManager,
		db,
		liveStatus,
	)

	router := chi.NewMux()

	router.Use(cors.Default().Handler)

	api := humachi.New(router, huma.DefaultConfig("NL chat dashboard API", "1.0.0"))

	type ThumbnailInput struct {
		ClipID string `query:"clip_id"`
	}

	huma.Get(api, "/api/thumbnail", func(ctx context.Context, input *ThumbnailInput) (*struct{ Body TwitchClip }, error) {
		var clipInDb FetchedClip
		fmt.Println("input clip id: ", input)
		err := db.Where("clip_id = ?", input.ClipID).First(&clipInDb).Error
		if err != nil {
			fmt.Println("error getting clip from db", err)
			return &struct{ Body TwitchClip }{Body: TwitchClip{}}, err
		}
		fmt.Println("clip in db: ", clipInDb)
		if clipInDb.Thumbnail != "" {
			return &struct{ Body TwitchClip }{Body: TwitchClip{ThumbnailURL: clipInDb.Thumbnail}}, nil
		}

		clip, err := fetchClipData(input.ClipID, *tokenManager)
		if err != nil {
			fmt.Println("error updating clip thumbnail", err)
			return &struct{ Body TwitchClip }{Body: TwitchClip{}}, err
		}
		db.Model(&clipInDb).Select("thumbnail").Updates(map[string]interface{}{"thumbnail": clip.ThumbnailURL})
		return &struct{ Body TwitchClip }{Body: *clip}, nil
	})

	huma.Get(api, "/api/initialize_top_clips", func(ctx context.Context, input *struct{}) (*struct{ Body bool }, error) {
		err := initializeTopClips(db)

		if err != nil {
			fmt.Println("error initializing top clips", err)
			return &struct{ Body bool }{Body: false}, err
		}
		return &struct{ Body bool }{Body: true}, nil
	})

	huma.Get(api, "/api/hero_all_time_clips", func(ctx context.Context, input *SpanQuery) (*AllTimeClipsOutput, error) {
		return heroTopClips(input, db)
	})

	huma.Put(api, "/api/refresh_top_clips_store", func(ctx context.Context, input *struct{}) (*struct{ Body bool }, error) {
		err := refreshTopClipsCache(db)
		if err != nil {
			fmt.Println("error refreshing top clips store", err)
			return &struct{ Body bool }{Body: false}, err
		}
		return &struct{ Body bool }{Body: true}, nil
	})

	huma.Get(api, "/api/clip_counts", func(ctx context.Context, input *ClipCountsInput) (*ClipCountsOutput, error) {
		return selectClipsFromEmotePeaks(*input, db)
	})

	huma.Get(api, "/api/series", func(ctx context.Context, input *SeriesInputForEmotes) (*TimeSeriesOutput, error) {
		fmt.Println(input.EmoteIDs)
		return selectSeries(*input, db)
	})

	huma.Get(api, "/api/series_greatest", func(ctx context.Context, input *SeriesInput) (*TimeSeriesOutput, error) {
		return selectSeriesForGreatest(*input, db)
	})

	huma.Get(api, "/api/latest_series", func(ctx context.Context, input *SeriesInputForEmotes) (*TimeSeriesOutput, error) {
		return selectLatestSeries(*input, db)
	})

	huma.Get(api, "/api/latest_greatest_series", func(ctx context.Context, input *SeriesInputForEmotes) (*TimeSeriesOutput, error) {
		return selectLatestGreatestTimeSeries(*input, db)
	})

	huma.Get(api, "/api/latest_trendiest_series", func(ctx context.Context, input *SeriesInputForEmotes) (*TimeSeriesOutput, error) {
		return selectLatestTrendiestTimeSeries(*input, db)
	})

	huma.Get(api, "/api/clip", func(ctx context.Context, input *NearestClipInput) (*NearestClipOutput, error) {
		return selectNearestClip(*input, db)
	})

	huma.Get(api, "/api/is_live", func(ctx context.Context, input *struct{}) (*struct{ Body bool }, error) {
		return &struct{ Body bool }{liveStatus.IsLive}, nil
	})

	huma.Get(api, "/api/emote_growth", func(ctx context.Context, input *EmotePerformanceInput) (*TopPerformingEmotesOutput, error) {
		return selectPercentGrowthDay(*input, db)
	})

	huma.Get(api, "/api/latest_emote_growth", func(ctx context.Context, input *LatestEmotePerformanceInput) (*LatestEmotePerformanceOutput, error) {
		return selectLatestPercentGrowth(*input, db)
	})

	huma.Get(api, "/api/emote_sums", func(ctx context.Context, input *EmoteSumInput) (*EmoteSumOutput, error) {
		return selectSums(db, *input)
	})

	huma.Get(api, "/api/latest_emote_sums", func(ctx context.Context, input *LatestEmoteSumInput) (*EmoteSumOutput, error) {
		return selectLatestSums(*input, db)
	})

	type PreviousStreamDateInput struct {
		From time.Time `query:"from"`
	}

	// todo: eventually we should just include all data for a date in a single query
	// reduce some round trips
	huma.Get(api, "/api/previous_stream_date", func(ctx context.Context, input *PreviousStreamDateInput) (*struct{ Body time.Time }, error) {
		psql := statementBuilder()
		var query squirrel.SelectBuilder
		if input.From.IsZero() {
			query = psql.
				Select("DATE(MAX(created_at))").
				From("emote_counts").
				Where(psql.
					Select("DATE(max(created_at))").
					From("emote_counts").
					Prefix("created_at < (").
					Suffix(")"))

		} else {
			query = psql.
				Select("DATE(max(created_at))").
				From("emote_counts").
				Where(squirrel.Lt{"created_at": input.From})
		}

		var date time.Time

		queryString, args, _ := query.ToSql()

		err := db.Raw(queryString, args...).Scan(&date).Error

		if err != nil {
			return nil, err
		}

		return &struct{ Body time.Time }{Body: date}, nil

	})

	huma.Get(api, "/api/next_stream_date", func(ctx context.Context, input *PreviousStreamDateInput) (*struct{ Body time.Time }, error) {

		if input.From.IsZero() {
			return nil, fmt.Errorf("from date is required")
		}

		query := statementBuilder().
			Select("DATE(min(created_at))").
			From("emote_counts").
			Where(squirrel.Gt{"created_at": input.From.Add(time.Hour * 24)})

		var date time.Time

		queryString, args, _ := query.ToSql()

		err := db.Raw(queryString, args...).Scan(&date).Error

		if err != nil {
			return nil, err
		}

		return &struct{ Body time.Time }{Body: date}, nil
	})

	type EmoteOutput struct {
		Body []Emote
	}

	huma.Get(api, "/api/emotes", func(ctx context.Context, input *struct{}) (*EmoteOutput, error) {
		trackedEmotes, err := getEmotesInDB(db)

		emotes := make([]Emote, 0, len(trackedEmotes))

		for _, emote := range trackedEmotes {
			emotes = append(emotes, emote)
		}

		if err != nil {
			fmt.Println("Error getting emotes:", err)
			return nil, err
		}

		return &EmoteOutput{Body: emotes}, nil

	})

	port := fmt.Sprintf(":%s", os.Getenv("PORT"))
	fmt.Println("Listening on port", port)

	listenError := http.ListenAndServe(port, router)

	if listenError != nil {
		fmt.Println(listenError)
	}
}

func getChatCountEmotes() (map[string]bool, []string) {
	val := reflect.ValueOf(ChatCounts{})
	validColumnSet := make(map[string]bool, val.NumField())
	emotes := make([]string, 0, val.NumField())

	for i := 0; i < val.NumField(); i++ {
		jsonTag := val.Type().Field(i).Tag.Get("json")
		if jsonTag != "-" && jsonTag != "time" {
			validColumnSet[jsonTag] = true
			emotes = append(emotes, jsonTag)
		}
	}

	return validColumnSet, emotes

}

func getTokenManager(db *gorm.DB) *TokenManager {
	tokens, err := tryUseLatestRefreshToken(db)

	if err != nil {
		tokens, err = getTwitchWithAuthCode(db)
		if err != nil {
			panic("Error getting Twitch token!")
		}
	}
	return &TokenManager{AccessToken: tokens.AccessToken, _refreshToken: tokens.RefreshToken}
}

type TokenManager struct {
	AccessToken   string
	_refreshToken string
}

func (t *TokenManager) RefreshToken(db *gorm.DB) error {
	response, err := refreshTwitchToken(db, t._refreshToken)

	if err != nil {
		fmt.Println("Error refreshing Twitch token:", err)
		return err
	}

	t._refreshToken = response.RefreshToken
	t.AccessToken = response.AccessToken

	return nil
}

func connectToTwitchChat(tokenManager *TokenManager, db *gorm.DB, liveStatus *LiveStatus) {
	env := GetConfig()

	for {
		ctx, cancel := context.WithCancel(context.Background())

		conn, _, err := websocket.DefaultDialer.Dial("ws://irc-ws.chat.twitch.tv:80", nil)
		if err != nil {
			fmt.Println("Error connecting to Twitch IRC:", err)
			cancel()
			return
		}

		defer conn.Close()

		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS oauth:%s", tokenManager.AccessToken)))
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", env.Nickname)))
		conn.WriteMessage(websocket.TextMessage, []byte("JOIN #northernlion"))

		incomingMessages := make(chan Message)

		go readChatMessages(conn, incomingMessages, cancel)

		initEmotesToTrack, err := getTrackingEmotes(db)

		if err != nil {
			fmt.Println("Error getting initial emotes:", err)
			return
		}

		latestEmotes := make(chan map[int]Emote)

		go syncTrackingEmotes(db, latestEmotes, ctx)

		go countEmotes(ctx, incomingMessages, db, initEmotesToTrack, tokenManager, liveStatus, latestEmotes)

		<-ctx.Done()
		cancel()

		time.Sleep(5 * time.Second)
		fmt.Println("Reconnecting to Twitch chat")

	}
}

func getTrackingEmotes(db *gorm.DB) (map[int]Emote, error) {
	emotes, err := getEmotesInDB(db)

	if err != nil {
		return nil, err
	}

	// delete the combined columns
	for id, emote := range emotes {
		if emote.Code == lul_kekw_icant || emote.Code == pog_pogcrazy_letsgo {
			delete(emotes, id)
		}
	}

	return emotes, nil
}

func getEmotesInDB(db *gorm.DB) (map[int]Emote, error) {
	var emotes []Emote
	err := db.Find(&emotes).Error

	idToEmote := make(map[int]Emote)
	for _, emote := range emotes {
		idToEmote[int(emote.ID)] = emote
	}

	return idToEmote, err
}

func syncTrackingEmotes(db *gorm.DB, trackingEmotesOut chan<- map[int]Emote, ctx context.Context) {
	refreshTimer := time.NewTicker(20 * time.Second)
	defer refreshTimer.Stop()

	for {
		select {
		case <-ctx.Done():
			close(trackingEmotesOut)
			return
		case <-refreshTimer.C:
			bttvEmotes, err := fetchNlEmotesFromBTTV()

			if err != nil {
				fmt.Println("Error getting latest BTTV emotes:", err)
				continue
			}

			emotes, err := getTrackingEmotes(db)

			if err != nil {
				fmt.Println("Error getting current emotes in db:", err)
				continue
			}

			currentTrackedCodes := make(map[string]bool)

			for _, emote := range emotes {
				currentTrackedCodes[emote.Code] = true
			}

			for _, bttvEmote := range bttvEmotes.Emotes {
				if _, ok := currentTrackedCodes[bttvEmote.Code]; !ok {
					fmt.Println("inserting new emote", bttvEmote.Code)

					randomHue := rand.Float64()

					color := hsvToRGB(HSV{
						Hue:        randomHue * 360,
						Saturation: 0.6,
						Value:      0.95,
					})

					newEmote := Emote{
						Code:     bttvEmote.Code,
						Url:      fmt.Sprintf("https://cdn.betterttv.net/emote/%s/2x.webp", bttvEmote.ID),
						HexColor: fmt.Sprintf("#%02x%02x%02x", color.Red, color.Green, color.Blue),
					}

					err := db.Create(&newEmote).Error

					if err != nil {
						fmt.Println("Error creating new emote:", err)
						continue
					}

				}
			}

			updatedEmotes, err := getTrackingEmotes(db)

			if err != nil {
				fmt.Println("Error getting updated db emotes:", err)
				continue
			}

			trackingEmotesOut <- updatedEmotes
		}
	}

}

func readChatMessages(conn *websocket.Conn, incomingMessages chan Message, cancel context.CancelFunc) {
	for {
		messageType, messageData, err := conn.ReadMessage()
		text := string(messageData)

		if strings.Contains(text, "PING") {
			conn.WriteMessage(websocket.TextMessage, []byte("PONG :tmi.twitch.tv"))
			continue
		}

		if err != nil {
			fmt.Println(text)
			fmt.Println("Error reading message:", err)
			cancel()
			return
		}

		incomingMessages <- Message{Type: messageType, Data: messageData}
	}
}

func countEmotes(
	ctx context.Context,
	message chan Message,
	db *gorm.DB,
	trackingEmotes map[int]Emote,
	tokenManager *TokenManager,
	liveStatus *LiveStatus,
	emoteUpdates <-chan map[int]Emote,
) {
	env := GetConfig()
	postInterval := time.NewTicker(10 * time.Second)
	defer postInterval.Stop()

	var counter map[int]float64

	resetCounter := func() {
		counter = make(map[int]float64)
		for _, emote := range trackingEmotes {
			counter[int(emote.ID)] = 0
		}
	}

	resetCounter()

	for {
		select {
		case msg := <-message:
			message := string(msg.Data)
			messageText := splitAndGetLast(message, "#northernlion")

			for _, emote := range trackingEmotes {
				if emote.Code == "two" {
					continue
				}
				if strings.Contains(messageText, emote.Code) {
					if env.Debug {
						fmt.Println("found emote", emote.Code)
					}
					counter[int(emote.ID)] += 1
				}
			}

			twoEmoteId := -1

			for _, emote := range trackingEmotes {
				if emote.Code == "two" {
					twoEmoteId = int(emote.ID)
					break
				}
			}

			if twoEmoteId == -1 {
				panic("two code not found in trackingEmotes. Need to make this more generic at some point.")
			}

			_, ok := counter[twoEmoteId]

			if !ok {
				panic("two code not found in counter; it should have been initialized. ")
			}

			if contains_plus := strings.Contains(messageText, "+"); contains_plus {
				counter[twoEmoteId] += parseVal(splitAndGetLast(messageText, "+"))
			} else if contains_minus := strings.Contains(messageText, "-"); contains_minus {
				counter[twoEmoteId] -= parseVal(splitAndGetLast(messageText, "-"))
			}

		case <-postInterval.C:
			counts := make([]EmoteCount, 0, len(counter))

			for emoteId, count := range counter {
				emote := trackingEmotes[emoteId]
				counts = append(counts, EmoteCount{
					Count: int(count),
					Emote: emote,
				})
			}

			resetCounter()

			go persistCountsIfLive(db, counts, tokenManager, liveStatus)

		case refreshedEmotes := <-emoteUpdates:
			for _, emote := range refreshedEmotes {
				if _, ok := trackingEmotes[int(emote.ID)]; !ok {
					fmt.Println("new emote", emote.Code)
				}

			}
			trackingEmotes = refreshedEmotes

		case <-ctx.Done():
			return
		}
	}
}

func persistCountsIfLive(
	db *gorm.DB,
	counts []EmoteCount,
	tokenManager *TokenManager,
	liveStatus *LiveStatus,
	retries ...int) {

	env := GetConfig()

	if env.Debug {
		for _, row := range counts {
			if row.Count != 0 {
				fmt.Println("inserting", row.Emote.Code, row.Count)
			}
		}
	}

	clipResult := makeClip(tokenManager.AccessToken)

	if clipResult.clipID != "" {

		liveStatus.setLiveStatus(true, db)
		countsWithClipIDs := make([]EmoteCount, 0, len(counts))

		for _, count := range counts {
			countsWithClipIDs = append(
				countsWithClipIDs,
				EmoteCount{
					Count:  count.Count,
					Emote:  count.Emote,
					ClipID: clipResult.clipID,
				})
		}

		err := db.Create(&FetchedClip{ClipID: clipResult.clipID}).Error

		if err != nil {
			fmt.Println("Error creating clip: ", clipResult.error)
			liveStatus.setLiveStatus(false, db)
		}

		err = db.Create(&countsWithClipIDs).Error

		if err != nil {
			fmt.Println("Error inserting into db:", err)
		}

		if env.Debug {
			fmt.Println("successfully inserted clip")
		}

	} else if clipResult.error == "unauthorized" {
		fmt.Println("Unauthorized, refreshing token")

		tokenManager.RefreshToken(db)

		if len(retries) == 0 {
			persistCountsIfLive(db, counts, tokenManager, liveStatus, 1)
		}
	} else {
		fmt.Println("Error creating clip: ", clipResult.error)
		liveStatus.setLiveStatus(false, db)
	}

}

func splitAndGetLast(text string, splitter string) string {
	split_text := strings.Split(text, splitter)
	last := len(split_text) - 1
	return split_text[last]
}

func parseVal(text string) float64 {
	if strings.Contains(text, "2") {
		return 2
	}
	return 0
}

type ClipResponse struct {
	Data []struct {
		Id string `json:"id"`
	} `json:"data"`
}

type CreateClipResponse struct {
	error  string
	clipID string
}

type TwitchCipResponse struct {
	Data []TwitchClip `json:"data"`
}

type TwitchClip struct {
	ID            string  `json:"id"`
	BroadcasterID string  `json:"broadcaster_id"`
	CreatedAt     string  `json:"created_at"`
	Duration      float64 `json:"duration"`
	ThumbnailURL  string  `json:"thumbnail_url"`
	VideoID       string  `json:"video_id"`
}

func makeClip(authToken string) CreateClipResponse {
	env := GetConfig()
	requestBody := map[string]string{
		"broadcaster_id": "14371185",
		"has_delay":      "false",
		"duration":       "90",
	}

	requestBodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return CreateClipResponse{error: "Error marshaling JSON"}
	}

	req, err := http.NewRequest("POST", "https://api.twitch.tv/helix/clips", bytes.NewBuffer(requestBodyBytes))
	if err != nil {
		return CreateClipResponse{error: "error creating request"}
	}

	auth := splitAndGetLast(authToken, ":")
	bearer := fmt.Sprintf("Bearer %s", auth)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Client-Id", env.ClientId)
	req.Header.Set("Authorization", bearer)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return CreateClipResponse{error: "error making request"}
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return CreateClipResponse{error: "unauthorized"}
	}

	if resp.StatusCode == 404 {
		return CreateClipResponse{error: "not found"}
	}

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return CreateClipResponse{error: "error reading response body"}
	}

	var responseObject ClipResponse
	err = json.Unmarshal(responseBody, &responseObject)
	if err != nil {
		return CreateClipResponse{error: "error unmarshaling response body"}
	}

	if len(responseObject.Data) > 0 {
		return CreateClipResponse{clipID: responseObject.Data[0].Id}
	}

	return CreateClipResponse{error: "no clip found"}

}

func getTwitchWithAuthCode(db *gorm.DB) (TwitchResponse, error) {
	env := GetConfig()

	fmt.Println("Authorizing Twitch with client code")

	data := url.Values{}
	data.Set("client_id", env.ClientId)
	data.Set("client_secret", env.ClientSecret)
	data.Set("code", os.Getenv("CLIENT_CODE"))
	data.Set("redirect_uri", "http://localhost:3000")
	data.Set("grant_type", "authorization_code")

	return getTwitchAuthResponse(data, db)
}

func refreshTwitchToken(db *gorm.DB, refreshToken string) (TwitchResponse, error) {
	env := GetConfig()
	fmt.Println("Refreshing Twitch auth with refresh token")

	data := url.Values{}
	data.Set("client_id", env.ClientId)
	data.Set("client_secret", env.ClientSecret)
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	return getTwitchAuthResponse(data, db)

}

func getTwitchAuthResponse(data url.Values, db *gorm.DB) (TwitchResponse, error) {
	req, err := http.NewRequest("POST", "https://id.twitch.tv/oauth2/token", strings.NewReader(data.Encode()))
	if err != nil {
		return TwitchResponse{}, err
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return TwitchResponse{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return TwitchResponse{}, err
	}

	var twitchResponse TwitchResponse
	err = json.Unmarshal(body, &twitchResponse)
	if err != nil {
		fmt.Println(err)
		return TwitchResponse{}, err
	}
	if twitchResponse.AccessToken == "" || twitchResponse.RefreshToken == "" {
		fmt.Println("Tokens are empty. Body was:", string(body))
		return TwitchResponse{}, fmt.Errorf("tokens are empty")
	}

	db.Create(&RefreshTokenStore{RefreshToken: twitchResponse.RefreshToken, CreatedAt: time.Now()})

	return twitchResponse, nil
}

func tryUseLatestRefreshToken(db *gorm.DB) (TwitchResponse, error) {
	var refreshTokenStore RefreshTokenStore
	db.Order("created_at desc").First(&refreshTokenStore)

	if refreshTokenStore.RefreshToken != "" {
		return refreshTwitchToken(db, refreshTokenStore.RefreshToken)
	}

	return TwitchResponse{}, fmt.Errorf("no refresh token found")
}

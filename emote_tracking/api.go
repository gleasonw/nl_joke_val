package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
)

type ChatCounts struct {
	Classic      float64   `json:"classic"`
	MonkaGiga    float64   `json:"monka_giga"`
	Two          float64   `json:"two"`
	Lol          float64   `json:"lol"`
	Cereal       float64   `json:"cereal"`
	Monkas       float64   `json:"monkas"`
	Joel         float64   `json:"joel"`
	Pog          float64   `json:"pog"`
	Huh          float64   `json:"huh"`
	No           float64   `json:"no"`
	Cocka        float64   `json:"cocka"`
	WhoAsked     float64   `json:"who_asked"`
	Shock        float64   `json:"shock"`
	Copium       float64   `json:"copium"`
	Ratjam       float64   `json:"ratjam"`
	Sure         float64   `json:"sure"`
	CreatedAt    time.Time `gorm:"index" json:"-"`
	ClipId       string    `json:"-"`
	Thumbnail    string    `json:"-"`
	CreatedEpoch float64   `json:"time"`
	Caught       float64   `json:"caught"`
	Life         float64   `json:"life"`
}

type RefreshTokenStore struct {
	RefreshToken string
	CreatedAt    time.Time
}

type Message struct {
	Type int
	Data []byte
}

var nickname string = os.Getenv("NICK")
var db_url string = os.Getenv("DATABASE_URL")
var client_id string = os.Getenv("CLIENT_ID")
var authToken = ""
var refreshToken = ""

type TwitchResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func authorizeTwitch(db *gorm.DB) error {

	// a little hack to avoid client code auth flow on startup
	var refreshTokenStore RefreshTokenStore
	db.Order("created_at desc").First(&refreshTokenStore)

	if refreshTokenStore.RefreshToken != "" {
		refreshToken = refreshTokenStore.RefreshToken
		refreshTwitchToken(db)
		return nil
	}

	fmt.Println("Authorizing Twitch with client code")

	data := url.Values{}
	data.Set("client_id", client_id)
	data.Set("client_secret", os.Getenv("CLIENT_SECRET"))
	data.Set("grant_type", "authorization_code")
	data.Set("code", os.Getenv("CLIENT_CODE"))
	data.Set("redirect_uri", "http://localhost:3000")

	req, err := http.NewRequest("POST", "https://id.twitch.tv/oauth2/token", strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var twitchResponse TwitchResponse
	err = json.Unmarshal(body, &twitchResponse)
	if err != nil {
		fmt.Println(err)
		return err
	}
	if twitchResponse.AccessToken == "" || twitchResponse.RefreshToken == "" {
		fmt.Println("Tokens are empty. Body was:", string(body))
		return error(fmt.Errorf("tokens are empty"))
	}
	authToken = twitchResponse.AccessToken
	refreshToken = twitchResponse.RefreshToken
	return nil
}

func refreshTwitchToken(db *gorm.DB) {
	fmt.Println("refreshing token")
	data := url.Values{}
	data.Set("client_id", client_id)
	data.Set("client_secret", os.Getenv("CLIENT_SECRET"))
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	req, err := http.NewRequest("POST", "https://id.twitch.tv/oauth2/token", strings.NewReader(data.Encode()))
	if err != nil {
		fmt.Println(err)
		return
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println(err)
		return
	}
	var twitchResponse TwitchResponse
	err = json.Unmarshal(body, &twitchResponse)
	if err != nil {
		fmt.Println(err)
		return
	}
	authToken = twitchResponse.AccessToken
	refreshToken = twitchResponse.RefreshToken
	if refreshToken != "" {
		db.Create(&RefreshTokenStore{RefreshToken: refreshToken, CreatedAt: time.Now()})
	}
}

var val = reflect.ValueOf(ChatCounts{})
var validColumnSet = make(map[string]bool)

func main() {
	if client_id == "" {
		//load .env file
		err := godotenv.Load()
		if err != nil {
			fmt.Println("Error loading .env file")
		}
		client_id = os.Getenv("CLIENT_ID")
		nickname = os.Getenv("NICK")
		db_url = os.Getenv("DATABASE_URL")
	}

	db, err := gorm.Open(postgres.Open(db_url))
	if err != nil {
		fmt.Println(err)
		return
	}

	db.AutoMigrate(&ChatCounts{})
	db.AutoMigrate(&RefreshTokenStore{})

	// build validColumnSet
	for i := 0; i < val.NumField(); i++ {
		jsonTag := val.Type().Field(i).Tag.Get("json")
		if jsonTag != "-" && jsonTag != "time" {
			validColumnSet[jsonTag] = true
		}
	}

	var lionIsLive = false

	getLiveStatus := func() bool {
		fmt.Println("getting live status: ", lionIsLive)
		return lionIsLive
	}

	setLiveStatus := func(isLive bool) {
		fmt.Println("setting live status: ", isLive)
		lionIsLive = isLive
	}

	authError := authorizeTwitch(db)

	if authError != nil {
		fmt.Println("Error authorizing Twitch:", authError)
		return
	}

	go connectToTwitchChat(db, getLiveStatus, setLiveStatus)

	router := chi.NewMux()

	api := humachi.New(router, huma.DefaultConfig("My API", "1.0.0"))

	api.UseMiddleware(func(ctx huma.Context, next func(huma.Context)) {
		ctx.SetHeader("Access-Control-Allow-Origin", "*")
		ctx.SetHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		ctx.SetHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
		ctx.SetHeader("Content-Type", "application/json")
		next(ctx)
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-series",
		Summary:     "Get a time series of emote counts",
		Method:      http.MethodGet,
		Path:        "/api/series",
	}, func(ctx context.Context, input *SeriesInput) (*SeriesOutput, error) {
		if input.RollingAverage > 0 {
			return GetRollingAverageSeries(*input, db)
		}
		return GetSeries(*input, db)
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-clip-counts",
		Summary:     "Get clip counts",
		Method:      http.MethodGet,
		Path:        "/api/clip_counts",
	}, func(ctx context.Context, input *ClipCountsInput) (*ClipCountsOutput, error) {
		return GetClipCounts(*input, db)
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-nearest-clip",
		Summary:     "Get nearest clip",
		Method:      http.MethodGet,
		Path:        "/api/clip",
	}, func(ctx context.Context, input *NearestClipInput) (*NearestClipOutput, error) {
		return GetNearestClip(*input, db)
	})

	type IsLiveInput struct{}
	type IsLiveOutput struct {
		IsLive bool `json:"is_live"`
	}

	huma.Register(api, huma.Operation{
		OperationID: "is-nl-live",
		Summary:     "Is NL live",
		Method:      http.MethodGet,
		Path:        "/api/is_live",
	}, func(ctx context.Context, input *IsLiveInput) (*IsLiveOutput, error) {
		return &IsLiveOutput{IsLive: lionIsLive}, nil
	})

	port := fmt.Sprintf(":%s", os.Getenv("PORT"))
	fmt.Println("Listening on port", port)

	listenError := http.ListenAndServe(port, router)

	if listenError != nil {
		fmt.Println(listenError)
	}

}

func connectToTwitchChat(db *gorm.DB, getLiveStatus func() bool, setLiveStatus func(bool)) {

	conn, _, err := websocket.DefaultDialer.Dial("ws://irc-ws.chat.twitch.tv:80", nil)
	if err != nil {
		fmt.Println("Error connecting to Twitch IRC:", err)
		return
	}

	defer conn.Close()

	conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS oauth:%s", authToken)))
	conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", nickname)))
	conn.WriteMessage(websocket.TextMessage, []byte("JOIN #northernlion"))

	incomingMessages := make(chan Message)
	createClipStatus := make(chan bool)

	go func() {
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
				return
			}
			incomingMessages <- Message{Type: messageType, Data: messageData}
		}
	}()

	post_count_ticker := time.NewTicker(10 * time.Second)
	counter := ChatCounts{}

	for {
		select {
		case msg := <-incomingMessages:
			full_message := string(msg.Data)
			only_message_text := split_and_get_last(full_message, "#northernlion")
			emotesAndKeywords := map[string]*float64{
				"LUL":                 &counter.Lol,
				"ICANT":               &counter.Lol,
				"KEKW":                &counter.Lol,
				"Cereal":              &counter.Cereal,
				"NOOO":                &counter.No,
				"COCKA":               &counter.Cocka,
				"monkaS":              &counter.Monkas,
				"Joel":                &counter.Joel,
				"POGCRAZY":            &counter.Pog,
				"Pog":                 &counter.Pog,
				"LETSGO":              &counter.Pog,
				"HUHH":                &counter.Huh,
				"Copium":              &counter.Copium,
				"D:":                  &counter.Shock,
				"WhoAsked":            &counter.WhoAsked,
				"ratJAM":              &counter.Ratjam,
				"Sure":                &counter.Sure,
				"Classic":             &counter.Classic,
				"monkaGIGAftRyanGary": &counter.MonkaGiga,
				"CAUGHT":              &counter.Caught,
				"Life":                &counter.Life,
			}

			for keyword, count := range emotesAndKeywords {
				if strings.Contains(only_message_text, keyword) {
					(*count)++
				}
			}

			if contains_plus := strings.Contains(only_message_text, "+"); contains_plus {
				counter.Two += parse_val(split_and_get_last(only_message_text, "+"))
			} else if contains_minus := strings.Contains(only_message_text, "-"); contains_minus {
				counter.Two -= parse_val(split_and_get_last(only_message_text, "-"))
			}

		case <-post_count_ticker.C:

			var timestamp time.Time

			if getLiveStatus() {
				err := db.Create(&counter).Error
				if err != nil {
					fmt.Println("Error inserting into db:", err)
				}
				timestamp = counter.CreatedAt
				fmt.Println("creating moment ", timestamp)

			}

			go createClipAndInsert(db, timestamp, createClipStatus)
			counter = ChatCounts{}

		case clipWasMade := <-createClipStatus:
			setLiveStatus(clipWasMade)
		}
	}
}

func split_and_get_last(text string, splitter string) string {
	split_text := strings.Split(text, splitter)
	last := len(split_text) - 1
	return split_text[last]
}

func parse_val(text string) float64 {
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

func createClipAndInsert(db *gorm.DB, unix_timestamp time.Time, isLive chan bool) {
	responseObject := createTwitchClip(db)

	if len(responseObject.Data) > 0 {
		clip_id := responseObject.Data[0].Id
		fmt.Println("Clip ID:", clip_id)
		db.Exec("UPDATE chat_counts SET clip_id = $1 WHERE created_at = $2", clip_id, unix_timestamp)
		isLive <- true
	} else {
		isLive <- false
	}
}

func createTwitchClip(db *gorm.DB) ClipResponse {
	requestBody := map[string]string{
		"broadcaster_id": "14371185",
		"has_delay":      "false",
		"duration":       "90",
	}

	requestBodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		fmt.Println("Error marshaling JSON:", err)
		return ClipResponse{}
	}

	req, err := http.NewRequest("POST", "https://api.twitch.tv/helix/clips", bytes.NewBuffer(requestBodyBytes))
	if err != nil {
		fmt.Println("Error creating request:", err)
		return ClipResponse{}
	}
	fmt.Println(authToken)

	auth := split_and_get_last(authToken, ":")
	bearer := fmt.Sprintf("Bearer %s", auth)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Client-Id", client_id)
	req.Header.Set("Authorization", bearer)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error sending request:", err)
		return ClipResponse{}
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("unauthorized: ", auth)
		refreshTwitchToken(db)

		//TODO: need a better way to refresh our token. here, we'll assign a clip slightly later than we should
		time.Sleep(2 * time.Second)
		return createTwitchClip(db)
	}

	if resp.StatusCode == 404 {
		return ClipResponse{}
	}

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return ClipResponse{}
	}

	var responseObject ClipResponse
	err = json.Unmarshal(responseBody, &responseObject)
	if err != nil {
		fmt.Println("Error unmarshaling JSON:", err)
		return ClipResponse{}
	}

	return responseObject
}

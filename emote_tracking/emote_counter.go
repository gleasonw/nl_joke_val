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
	Classic      int       `json:"classic"`
	MonkaGiga    int       `json:"monka_giga"`
	Two          int       `json:"two"`
	Lol          int       `json:"lol"`
	Cereal       int       `json:"cereal"`
	Monkas       int       `json:"monkas"`
	Joel         int       `json:"joel"`
	Pog          int       `json:"pog"`
	Huh          int       `json:"huh"`
	No           int       `json:"no"`
	Cocka        int       `json:"cocka"`
	WhoAsked     int       `json:"who_asked"`
	Shock        int       `json:"shock"`
	Copium       int       `json:"copium"`
	Ratjam       int       `json:"ratjam"`
	Sure         int       `json:"sure"`
	CreatedAt    time.Time `gorm:"index" json:"-"`
	ClipId       string    `json:"-"`
	Thumbnail    string    `json:"-"`
	CreatedEpoch float64   `json:"time"`
}

// keep the json the same, but we need the name to reflect the db avg_*
type AveragedChatCounts struct {
	AvgMonkaGiga float64   `json:"monka_giga"`
	AvgClassic   float64   `json:"classic"`
	AvgTwo       float64   `json:"two"`
	AvgLol       float64   `json:"lol"`
	AvgCereal    float64   `json:"cereal"`
	AvgMonkas    float64   `json:"monkas"`
	AvgJoel      float64   `json:"joel"`
	AvgPog       float64   `json:"pog"`
	AvgHuh       float64   `json:"huh"`
	AvgNo        float64   `json:"no"`
	AvgCocka     float64   `json:"cocka"`
	AvgWhoAsked  float64   `json:"who_asked"`
	AvgShock     float64   `json:"shock"`
	AvgCopium    float64   `json:"copium"`
	AvgRatjam    float64   `json:"ratjam"`
	AvgSure      float64   `json:"sure"`
	CreatedAt    time.Time `gorm:"index" json:"-"`
	ClipId       string    `json:"-"`
	Thumbnail    string    `json:"-"`
	CreatedEpoch float64   `json:"time"`
}

var val = reflect.ValueOf(ChatCounts{})
var validColumnSet = make(map[string]bool)

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

func authorizeTwitch() error {
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

func refreshTwitchToken() {
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
}

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

	for i := 0; i < val.NumField(); i++ {
		jsonTag := val.Type().Field(i).Tag.Get("json")
		if jsonTag != "-" && jsonTag != "time" {
			validColumnSet[jsonTag] = true
		}
	}

	authErr := authorizeTwitch()
	if authErr != nil {
		fmt.Println(authErr)
		return
	}

	go connectToTwitchChat(db)

	router := chi.NewMux()
	api := humachi.New(router, huma.DefaultConfig("My API", "1.0.0"))

	huma.Register(api, huma.Operation{
		OperationID: "get-series",
		Summary:     "Get a time series of emote counts",
		Method:      http.MethodGet,
		Path:        "/api/series",
	}, func(ctx context.Context, input *SeriesInput) (*SeriesOutput, error) {
		return GetSeries(*input, db)
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-average-series",
		Summary:     "Get the rolling average of a time series of emote counts",
		Method:      http.MethodGet,
		Path:        "/api/average_series",
	}, func(ctx context.Context, input *SeriesInput) (*AveragedSeriesOutput, error) {
		return GetRollingAverageSeries(*input, db)
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

	port := fmt.Sprintf(":%s", os.Getenv("PORT"))
	fmt.Println("Listening on port", port)

	listenError := http.ListenAndServe(port, router)

	if listenError != nil {
		fmt.Println(listenError)
	}

}

func marshalJsonAndWrite(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	jsonData, err := json.Marshal(data)
	if err != nil {
		fmt.Println(err)
		return
	}

	w.Write(jsonData)
}

func connectToTwitchChat(db *gorm.DB) {

	conn, _, err := websocket.DefaultDialer.Dial("ws://irc-ws.chat.twitch.tv:80", nil)
	if err != nil {
		fmt.Println("Error connecting to Twitch IRC:", err)
		return
	}

	chat_closed := make(chan error)

	go func() {
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS oauth:%s", authToken)))
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", nickname)))
		conn.WriteMessage(websocket.TextMessage, []byte("JOIN #northernlion"))

		incomingMessages := make(chan Message)
		createClipStatus := make(chan bool)
		lionIsLive := false

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
					chat_closed <- err
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
				emotesAndKeywords := map[string]*int{
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

				if lionIsLive {
					err := db.Create(&counter).Error
					if err != nil {
						fmt.Println("Error inserting into db:", err)
					}
					timestamp = counter.CreatedAt
					fmt.Println("creating moment ", timestamp)

				}

				go create_clip(db, timestamp, createClipStatus)
				counter = ChatCounts{}

			case clipWasMade := <-createClipStatus:
				lionIsLive = clipWasMade
			}
		}
	}()

	defer conn.Close()

	for {
		select {
		case err := <-chat_closed:
			fmt.Println("Chat closed:", err)
			time.Sleep(30 * time.Second)
			go connectToTwitchChat(db)
			return
		default:
			time.Sleep(100 * time.Millisecond)
		}
	}
}

func split_and_get_last(text string, splitter string) string {
	split_text := strings.Split(text, splitter)
	last := len(split_text) - 1
	return split_text[last]
}

func parse_val(text string) int {
	if strings.Contains(text, "2") {
		return 2
	}
	return 0
}

func create_clip(db *gorm.DB, unix_timestamp time.Time, isLive chan bool) {
	requestBody := map[string]string{
		"broadcaster_id": "14371185",
		"has_delay":      "false",
		"duration":       "90",
	}

	requestBodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		fmt.Println("Error marshaling JSON:", err)
		return
	}

	req, err := http.NewRequest("POST", "https://api.twitch.tv/helix/clips", bytes.NewBuffer(requestBodyBytes))
	if err != nil {
		fmt.Println("Error creating request:", err)
		return
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
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		fmt.Println("unauthorized: ", auth)
		refreshTwitchToken()
		time.Sleep(5 * time.Second)
	}

	if resp.StatusCode == 404 {
		isLive <- false
		return
	}

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return
	}

	var responseObject map[string]interface{}
	err = json.Unmarshal(responseBody, &responseObject)
	if err != nil {
		fmt.Println("Error unmarshaling JSON:", err)
		return
	}
	fmt.Println(responseObject)
	data, ok := responseObject["data"].([]interface{})
	if !ok {
		fmt.Println("error creating clip")
		return
	}
	clip_id, ok := data[0].(map[string]interface{})["id"].(string)
	if !ok {
		fmt.Println("error creating clip")
		return
	}
	db.Exec("UPDATE chat_counts SET clip_id = $1 WHERE created_at = $2", clip_id, unix_timestamp)
	isLive <- true
}

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

//TODO: link

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
	Caught       float64   `json:"caught"`
	Life         float64   `json:"life"`
	CreatedAt    time.Time `gorm:"index" json:"-"`
	ClipId       string    `json:"-"`
	Thumbnail    string    `json:"-"`
	CreatedEpoch float64   `json:"time"`
}

func textToCountMap(count ChatCounts) map[string]*float64 {
	return map[string]*float64{
		"monkaGiga": &count.MonkaGiga,
		"two":       &count.Two,
		"lol":       &count.Lol,
		"cereal":    &count.Cereal,
		"monkas":    &count.Monkas,
		"joel":      &count.Joel,
		"pog":       &count.Pog,
		"huh":       &count.Huh,
		"no":        &count.No,
		"cocka":     &count.Cocka,
		"whoAsked":  &count.WhoAsked,
		"shock":     &count.Shock,
		"copium":    &count.Copium,
		"ratjam":    &count.Ratjam,
		"sure":      &count.Sure,
		"caught":    &count.Caught,
		"life":      &count.Life,
	}
}

type Message struct {
	Type int
	Data []byte
}

var nickname string = os.Getenv("NICK")
var db_url string = os.Getenv("LOCAL_DATABASE_URL")
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

var val = reflect.ValueOf(ChatCounts{})
var validColumnSet = make(map[string]bool)

func main() {
	emotes, err := fetchNlEmotesFromBTTV()

	for _, emote := range emotes.Emotes {
		fmt.Println(emote)
	}

	fmt.Printf("num emoticons: %d\n", len(emotes.Emotes))

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
	// db.AutoMigrate(&ChatCounts{})

	// build validColumnSet
	for i := 0; i < val.NumField(); i++ {
		jsonTag := val.Type().Field(i).Tag.Get("json")
		if jsonTag != "-" && jsonTag != "time" {
			validColumnSet[jsonTag] = true
		}
	}

	lionIsLive := false

	// setLionLiveStatus := func(isLive bool) {
	// 	lionIsLive = isLive
	// }

	// getLionLiveStatus := func() bool {
	// 	return lionIsLive
	// }

	// go connectToTwitchChat(db, setLionLiveStatus, getLionLiveStatus)

	router := chi.NewMux()
	api := humachi.New(router, huma.DefaultConfig("My API", "1.0.0"))

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
		return &IsLiveOutput{lionIsLive}, nil
	})

	port := fmt.Sprintf(":%s", os.Getenv("PORT"))
	fmt.Println("Listening on port", port)

	listenError := http.ListenAndServe(port, router)

	if listenError != nil {
		fmt.Println(listenError)
	}

}

func connectToTwitchChat(db *gorm.DB, setLiveStatus func(bool), getLiveStatus func() bool) {

	//todo: maybe move to clip count maker?
	authErr := authorizeTwitch()
	if authErr != nil {
		fmt.Println(authErr)
		return
	}

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

	go readChatFromSocket(conn, incomingMessages)

	insertCountsTicker := time.NewTicker(10 * time.Second)
	counter := ChatCounts{}

	for {
		select {
		case msg := <-incomingMessages:
			fullMessage := string(msg.Data)
			messageText := splitAndGetLast(fullMessage, "#northernlion")

			for keyword, count := range textToCountMap(counter) {
				if strings.Contains(messageText, keyword) {
					(*count)++
				}
			}

			if contains_plus := strings.Contains(messageText, "+"); contains_plus {
				counter.Two += parseTwoValue(splitAndGetLast(messageText, "+"))
			} else if contains_minus := strings.Contains(messageText, "-"); contains_minus {
				counter.Two -= parseTwoValue(splitAndGetLast(messageText, "-"))
			}

		case <-insertCountsTicker.C:

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

func readChatFromSocket(conn *websocket.Conn, messageChannel chan Message) {
	for {
		messageType, messageData, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Error reading message:", err)
			return
		}
		text := string(messageData)
		if strings.Contains(text, "PING") {
			conn.WriteMessage(websocket.TextMessage, []byte("PONG :tmi.twitch.tv"))
			continue
		}
		if err != nil {
			fmt.Println(text)
			fmt.Println("Error reading message:", err)
			fmt.Println("Chat closed:", err)
			time.Sleep(30 * time.Second)
			return
		}
		messageChannel <- Message{Type: messageType, Data: messageData}
	}
}

func splitAndGetLast(text string, splitter string) string {
	split_text := strings.Split(text, splitter)
	last := len(split_text) - 1
	return split_text[last]
}

func parseTwoValue(text string) float64 {
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
	responseObject := doCreateClipRequest()

	if len(responseObject.Data) > 0 {
		clip_id := responseObject.Data[0].Id
		fmt.Println("Clip ID:", clip_id)
		db.Exec("UPDATE chat_counts SET clip_id = $1 WHERE created_at = $2", clip_id, unix_timestamp)
		isLive <- true
	} else {
		isLive <- false
	}
}

func doCreateClipRequest() ClipResponse {
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

	auth := splitAndGetLast(authToken, ":")
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
		refreshTwitchToken()
		time.Sleep(5 * time.Second)
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

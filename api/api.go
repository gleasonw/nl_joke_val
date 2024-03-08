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

type LiveStatus struct {
	IsLive bool
}

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "migrate":
			migrate()
			return
		case "verify":
			verify()
			return
		}
	}

	env := GetConfig()

	db, err := gorm.Open(postgres.Open(env.DatabaseUrl))
	if err != nil {
		fmt.Println(err)
		return
	}

	db.AutoMigrate(&RefreshTokenStore{})
	db.AutoMigrate(&Emote{})
	db.AutoMigrate(&EmoteCount{})
	db.AutoMigrate(&FetchedClip{})

	liveStatus := &LiveStatus{IsLive: false}

	go connectToTwitchChat(
		db,
		liveStatus,
	)

	router := chi.NewMux()

	router.Use(cors.Default().Handler)

	api := humachi.New(router, huma.DefaultConfig("NL chat dashboard API", "1.0.0"))

	validColumnSet, _ := getEmotes()

	huma.Get(api, "/api/clip_counts", func(ctx context.Context, input *ClipCountsInput) (*ClipCountsOutput, error) {
		return GetClipCounts(*input, db, validColumnSet)
	})

	huma.Get(api, "/api/series", func(ctx context.Context, input *SeriesInput) (*TimeSeriesOutput, error) {
		if input.RollingAverage > 0 {
			return GetTimeSeriesRollingAverage(*input, db)
		}
		return GetTimeSeries(*input, db)
	})

	huma.Get(api, "/api/clip", func(ctx context.Context, input *NearestClipInput) (*NearestClipOutput, error) {
		return GetNearestClip(*input, db)
	})

	huma.Get(api, "/api/is_live", func(ctx context.Context, input *struct{}) (*struct{ Body bool }, error) {
		return &struct{ Body bool }{liveStatus.IsLive}, nil
	})

	port := fmt.Sprintf(":%s", os.Getenv("PORT"))
	fmt.Println("Listening on port", port)

	listenError := http.ListenAndServe(port, router)

	if listenError != nil {
		fmt.Println(listenError)
	}
}

func getEmotes() (map[string]bool, []string) {
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

func connectToTwitchChat(db *gorm.DB, liveStatus *LiveStatus) {
	env := GetConfig()

	tokens, err := tryUseLatestRefreshToken(db)

	if err != nil {
		tokens, err = getTwitchWithAuthCode(db)
		if err != nil {
			fmt.Println("Error getting Twitch token:", err)
			return
		}
	}

	if err != nil {
		fmt.Println("Error getting Twitch token:", err)
		return
	}

	for {
		ctx, cancel := context.WithCancel(context.Background())

		refreshTokens := func() bool {
			tokens, err = refreshTwitchToken(db, tokens.RefreshToken)
			if err != nil {
				fmt.Println("Error refreshing Twitch token:", err)
				return false
			}
			return true
		}

		conn, _, err := websocket.DefaultDialer.Dial("ws://irc-ws.chat.twitch.tv:80", nil)
		if err != nil {
			fmt.Println("Error connecting to Twitch IRC:", err)
			cancel()
			return
		}

		defer conn.Close()

		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS oauth:%s", tokens.AccessToken)))
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", env.Nickname)))
		conn.WriteMessage(websocket.TextMessage, []byte("JOIN #northernlion"))

		incomingMessages := make(chan Message)

		go readChatMessages(conn, incomingMessages, cancel)

		initialEmotes, err := getEmotesInDB(db)

		if err != nil {
			fmt.Println("Error getting initial emotes:", err)
			return
		}

		latestEmotes := make(chan map[int]Emote)

		go syncTrackingEmotes(db, latestEmotes, ctx)

		go countEmotes(incomingMessages, db, initialEmotes, ctx, refreshTokens, tokens, liveStatus, latestEmotes)

		<-ctx.Done()
		cancel()

		time.Sleep(5 * time.Second)
		fmt.Println("Reconnecting to Twitch chat")

	}
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

			emotes, err := getEmotesInDB(db)

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

					newEmote := Emote{Code: bttvEmote.Code}

					err := db.Create(&newEmote).Error

					if err != nil {
						fmt.Println("Error creating new emote:", err)
						continue
					}

				}
			}

			updatedEmotes, err := getEmotesInDB(db)

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
	message chan Message,
	db *gorm.DB,
	trackingEmotes map[int]Emote,
	ctx context.Context,
	refreshTokens func() bool,
	tokens TwitchResponse,
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

			if env.Debug {
				fmt.Println("new message: ", messageText)
			}

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
			rowsToInsert := make([]EmoteCount, 0, len(counter))

			for emoteId, count := range counter {
				emote := trackingEmotes[emoteId]
				rowsToInsert = append(rowsToInsert, EmoteCount{
					Count: int(count),
					Emote: emote,
				})
			}

			err := db.Create(&rowsToInsert).Error

			if env.Debug {
				for _, row := range rowsToInsert {
					if row.Count != 0 {
						fmt.Println("inserting", row.Emote.Code, row.Count)
					}
				}
			}

			insertedRowIds := make([]int, 0, len(rowsToInsert))

			for _, row := range rowsToInsert {
				insertedRowIds = append(insertedRowIds, int(row.Id))
			}

			if err != nil {
				fmt.Println("Error inserting into db:", err)
			}

			resetCounter()

			createClipAndMaybeRefreshToken(db, insertedRowIds, tokens.AccessToken, liveStatus, refreshTokens)

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

func createClipAndMaybeRefreshToken(
	db *gorm.DB,
	rowsToAssignClipId []int,
	authToken string,
	liveStatus *LiveStatus,
	refreshTokens func() bool,
	retries ...int) {

	clipResultChannel := make(chan CreateClipResponse)

	go func() {
		clipResultChannel <- createClipAndInsert(db, rowsToAssignClipId, authToken)
	}()

	clipResult := <-clipResultChannel

	if clipResult.error == "unauthorized" {
		fmt.Println("Unauthorized, refreshing token")
		refreshTokens()
		if len(retries) == 0 {
			createClipAndMaybeRefreshToken(db, rowsToAssignClipId, authToken, liveStatus, refreshTokens, 1)
		}
	} else if clipResult.error != "" {
		fmt.Println("Error creating clip: ", clipResult.error)
	} else {
		liveStatus.IsLive = true
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
	error string
}

func createClipAndInsert(db *gorm.DB, rowsToAssignClipId []int, authToken string) CreateClipResponse {
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
		clipId := responseObject.Data[0].Id

		sq := squirrel.StatementBuilder.PlaceholderFormat(squirrel.Dollar)

		query, args, err := sq.Update("emote_counts").
			Set("clip_id", clipId).
			Where(squirrel.Eq{"id": rowsToAssignClipId}).
			ToSql()

		if env.Debug {
			fmt.Println("updating rows with", query)
		}

		if err != nil {
			fmt.Println("Error building query:", err)
			return CreateClipResponse{error: "error building query"}
		}

		err = db.Raw(query, args...).Error

		if err != nil {
			fmt.Println("Error updating emote_counts:", err)
			return CreateClipResponse{error: "error updating emote_counts"}
		}

		return CreateClipResponse{}
	}

	return CreateClipResponse{}

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

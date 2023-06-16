package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"reflect"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type ChatCounts struct {
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
	CreatedAt    time.Time `gorm:"index" json:"-"`
	ClipId       string    `json:"-"`
	CreatedEpoch float64   `json:"time"`
}

type Clip struct {
	ClipID string  `json:"clip_id"`
	Count  int     `json:"count"`
	Time   float64 `json:"time"`
}

type Message struct {
	Type int
	Data []byte
}

var auth_token string = os.Getenv("AUTH_TOKEN")
var nickname string = os.Getenv("NICK")
var db_url string = os.Getenv("DATABASE_URL")
var client_id string = os.Getenv("CLIENT_ID")

func main() {
	if auth_token == "" {
		//load .env file
		err := godotenv.Load()
		if err != nil {
			fmt.Println("Error loading .env file")
		}
		auth_token = os.Getenv("AUTH_TOKEN")
		nickname = os.Getenv("NICK")
		db_url = os.Getenv("DATABASE_URL")
		client_id = os.Getenv("CLIENT_ID")
	}
	db, err := gorm.Open(postgres.Open(db_url))
	if err != nil {
		fmt.Println(err)
		return
	}
	db.AutoMigrate(&ChatCounts{})
	go connect_to_nl_chat(db)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello World!"))
	})

	sumQuery, overQuery, err := buildQueriesFromStructReflect(ChatCounts{})
	if err != nil {
		fmt.Println(err)
		return
	}

	http.HandleFunc("/api/instant", func(w http.ResponseWriter, r *http.Request) {
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")

		var result []ChatCounts

		err := db.Raw(sumQuery, grouping, span).Scan(&result).Error
		if err != nil {
			fmt.Println(err)
			return
		}

		marshal_json_and_write(w, result)
	})

	http.HandleFunc("/api/rolling_sum", func(w http.ResponseWriter, r *http.Request) {
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		result := []ChatCounts{}
		err := db.Raw(overQuery, grouping, span).Scan(&result).Error
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, result)
	})

	http.HandleFunc("/api/max_clip", func(w http.ResponseWriter, r *http.Request) {
		column_to_select := r.URL.Query().Get("column")
		span := r.URL.Query().Get("span")
		var query string
		timeSpan := "FROM chat_counts"

		// sanitize column_to_select
		val := reflect.ValueOf(ChatCounts{})
		typeOfChatCounts := val.Type()
		for i := 0; i < val.NumField(); i++ {
			jsonTag := typeOfChatCounts.Field(i).Tag.Get("json")
			if jsonTag == column_to_select {
				break
			}
			if i == val.NumField()-1 {
				http.Error(w, fmt.Sprintf("invalid column: %s", column_to_select), http.StatusBadRequest)
				return
			}
		}
		
		// sanitize span
		switch span {
		case "day", "week", "month", "year":
			timeSpan = fmt.Sprintf(`
				FROM chat_counts
				WHERE created_at >= (
					SELECT MAX(created_at) - INTERVAL '1 %s'
					FROM chat_counts
				)`, span)
		}

		query = fmt.Sprintf(`
			SELECT %s AS count, EXTRACT(epoch from created_at) as time, clip_id
			FROM chat_counts 
			WHERE clip_id != ''
			AND clip_id IN (
				SELECT clip_id
				%s
				ORDER BY %s DESC
				LIMIT 10
			)
		`, column_to_select, timeSpan, column_to_select)
		
		fmt.Println(query)

		minMaxClipGetter(w, query, db)
	})

	http.HandleFunc("/api/min_clip", func(w http.ResponseWriter, r *http.Request) {
		span := r.URL.Query().Get("span")
		var query string
		var timeSpan string

		switch span {
		case "day", "week", "month", "year":
			timeSpan = fmt.Sprintf(
				`WHERE created_at >= (
					SELECT MAX(created_at) - INTERVAL '1 %s'
					FROM chat_counts
				)
			`, span)
		}

		query = fmt.Sprintf(`
		SELECT two as count, EXTRACT(epoch from created_at) as time, clip_id 
		FROM chat_counts 
		WHERE clip_id IS NOT NULL
		AND clip_id IN (
			SELECT clip_id
			FROM chat_counts
			%s
		)
		ORDER BY two ASC
		LIMIT 10`, timeSpan)

		minMaxClipGetter(w, query, db)
	})

	http.HandleFunc("/api/clip", func(w http.ResponseWriter, r *http.Request) {
		t := r.URL.Query().Get("time")
		var clip Clip
		db.Raw(`
		SELECT clip_id, EXTRACT(epoch from created_at) as time
		FROM chat_counts 
		WHERE EXTRACT(epoch from created_at) > $1::float + 10
		AND EXTRACT(epoch from created_at) < $1::float + 20
		LIMIT 1`, t).Scan(&clip)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, map[string]string{
			"clip_id": clip.ClipID,
			"time":    fmt.Sprintf("%f", clip.Time),
		})
	})

	port := fmt.Sprintf(":%s", os.Getenv("PORT"))
	fmt.Println("Listening on port", port)

	listenError := http.ListenAndServe(port, nil)
	if listenError != nil {
		fmt.Println(listenError)
	}

}

func buildQueriesFromStructReflect(s interface{}) (string, string, error) {
	val := reflect.ValueOf(s)
	typeOfS := val.Type()

	sumFields := make([]string, 0, val.NumField())
	overFields := make([]string, 0, val.NumField())

	for i := 0; i < val.NumField(); i++ {
		fieldName := typeOfS.Field(i).Tag.Get("json")

		if fieldName != "-" && fieldName != "time" {
			sumField := fmt.Sprintf("SUM(%s) as %s", fieldName, fieldName)
			overField := fmt.Sprintf("SUM(%s) OVER (ORDER BY created_epoch) as %s", fieldName, fieldName)
			sumFields = append(sumFields, sumField)
			overFields = append(overFields, overField)
		}
	}

	sumFieldStr := strings.Join(sumFields, ",\n\t\t")
	overFieldStr := strings.Join(overFields, ",\n\t\t")

	sumQuery := fmt.Sprintf(`
		SELECT %s,
			EXTRACT(epoch from date_trunc($1, created_at)) AS created_epoch
		FROM chat_counts 
		WHERE created_at >= (SELECT MAX(created_at) - $2::interval from chat_counts)
		GROUP BY date_trunc($1, created_at) 
		ORDER BY date_trunc($1, created_at) asc
	`, sumFieldStr)

	overQuery := fmt.Sprintf(`
		SELECT %s,
			created_epoch
		FROM (%s) as grouping_sum
	`, overFieldStr, sumQuery)

	return sumQuery, overQuery, nil
}

func minMaxClipGetter(w http.ResponseWriter, query string, db *gorm.DB) {
	var clips []Clip
	err := db.Raw(query).Scan(&clips).Error
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	marshal_json_and_write(w, map[string][]Clip{
		"clips": clips,
	})
}

func marshal_json_and_write(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	jsonData, err := json.Marshal(data)
	if err != nil {
		fmt.Println(err)
		return
	}

	w.Write(jsonData)
}

func connect_to_nl_chat(db *gorm.DB) {
	conn, _, err := websocket.DefaultDialer.Dial("ws://irc-ws.chat.twitch.tv:80", nil)
	fmt.Println(conn)
	if err != nil {
		fmt.Println("Error connecting to Twitch IRC:", err)
		return
	}
	chat_closed := make(chan error)
	go read_chat(conn, chat_closed, db)
	defer conn.Close()
	for {
		select {
		case err := <-chat_closed:
			fmt.Println("Chat closed:", err)
			time.Sleep(30 * time.Second)
			go connect_to_nl_chat(db)
			return
		default:
			time.Sleep(100 * time.Millisecond)
		}
	}
}

func read_chat(conn *websocket.Conn, chat_closed chan error, db *gorm.DB) {

	// connect to NL chat
	fmt.Println(auth_token)
	fmt.Println(nickname)
	conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS %s", auth_token)))
	conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", nickname)))
	conn.WriteMessage(websocket.TextMessage, []byte("JOIN #northernlion"))

	incomingMessages := make(chan Message)
	createClipStatus := make(chan bool)
	lionIsLive := false

	go readMessages(conn, chat_closed, incomingMessages)
	post_count_ticker := time.NewTicker(10 * time.Second)
	counter := ChatCounts{}

	for {
		select {
		case msg := <-incomingMessages:
			full_message := string(msg.Data)
			only_message_text := split_and_get_last(full_message, "#northernlion")
			emotesAndKeywords := map[string]*int{
				"LUL":      &counter.Lol,
				"ICANT":    &counter.Lol,
				"KEKW":    &counter.Lol,
				"Cereal":   &counter.Cereal,
				"NOOO":     &counter.No,
				"COCKA":    &counter.Cocka,
				"monkaS":   &counter.Monkas,
				"Joel":     &counter.Joel,
				"POGCRAZY": &counter.Pog,
				"Pog":      &counter.Pog,
				"LETSGO": &counter.Pog,
				"HUHH":     &counter.Huh,
				"Copium":   &counter.Copium,
				"D:":       &counter.Shock,
				"WhoAsked": &counter.WhoAsked,
			}

			for keyword, count := range emotesAndKeywords {
				if strings.Contains(only_message_text, keyword) {
					(*count)++
				}
			}

			// modify the twos score

			if contains_plus := strings.Contains(only_message_text, "+"); contains_plus {
				counter.Two += parse_val(split_and_get_last(only_message_text, "+"))
			} else if contains_minus := strings.Contains(only_message_text, "-"); contains_minus {
				counter.Two -= parse_val(split_and_get_last(only_message_text, "-"))
			}

		case <-post_count_ticker.C:

			// post 10 second count bins to postgres if NL is live
			var timestamp time.Time
			if lionIsLive {
				err := db.Create(&counter).Error
				if err != nil {
					fmt.Println("Error inserting into db:", err)
				}
				timestamp = counter.CreatedAt
			}

			go create_clip(db, timestamp, createClipStatus)
			counter = ChatCounts{}

		case clipWasMade := <-createClipStatus:
			fmt.Println(lionIsLive)
			lionIsLive = clipWasMade
		}
	}
}

func readMessages(conn *websocket.Conn, chat_closed chan error, incomingMessages chan Message) {
	for {
		messageType, messageData, err := conn.ReadMessage()
		text := string(messageData)
		if strings.Contains(text, "PING") {
			conn.WriteMessage(websocket.TextMessage, []byte("PONG :tmi.twitch.tv"))
			continue
		}
		if err != nil {
			fmt.Println("Error reading message:", err)
			chat_closed <- err
			return
		}
		incomingMessages <- Message{Type: messageType, Data: messageData}
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

	// Convert the request body to a JSON string
	requestBodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		fmt.Println("Error marshaling JSON:", err)
		return
	}

	// Create a new HTTP POST request to the Twitch Clip API
	req, err := http.NewRequest("POST", "https://api.twitch.tv/helix/clips", bytes.NewBuffer(requestBodyBytes))
	if err != nil {
		fmt.Println("Error creating request:", err)
		return
	}

	auth := split_and_get_last(auth_token, ":")
	bearer := fmt.Sprintf("Bearer %s", auth)

	// Set the required headers for the request
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Client-Id", client_id)
	req.Header.Set("Authorization", bearer)

	// Send the request and get the response
	client := &http.Client{}
	resp, err := client.Do(req)
	//check if 404, live status
	if resp.StatusCode == 404 {
		isLive <- false
		return
	}
	if err != nil {
		fmt.Println("Error sending request:", err)
		return
	}
	defer resp.Body.Close()

	// Read the response body
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return
	}

	// get clip_id from json response
	var responseObject map[string]interface{}
	err = json.Unmarshal(responseBody, &responseObject)
	if err != nil {
		fmt.Println("Error unmarshaling JSON:", err)
		return
	}
	data, ok := responseObject["data"].([]interface{})
	if !ok {
		return
	}
	clip_id, ok := data[0].(map[string]interface{})["id"].(string)
	if !ok {
		return
	}
	db.Exec("UPDATE chat_counts SET clip_id = $1 WHERE created_at = $2", clip_id, unix_timestamp)
	isLive <- true
}

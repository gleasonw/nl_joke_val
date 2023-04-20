package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type SeriesData struct {
	Twos   int     `json:"twos"`
	Lol    int     `json:"lol"`
	Cereal int     `json:"cereal"`
	Monkas int     `json:"monkas"`
	Joel   int     `json:"joel"`
	Pogs   int     `json:"pogs"`
	Huhs   int     `json:"huhs"`
	Time   float64 `json:"time"`
}

var auth_token string = os.Getenv("AUTH_TOKEN")
var nickname string = os.Getenv("NICK")
var db_url string = os.Getenv("DATABASE_URL")
var client_id string = os.Getenv("CLIENT_ID")

func main() {
	if auth_token == "" {
		//load .env file
		fmt.Println("local")
		err := godotenv.Load()
		if err != nil {
			fmt.Println("Error loading .env file")
		}
		auth_token = os.Getenv("AUTH_TOKEN")
		nickname = os.Getenv("NICK")
		db_url = os.Getenv("DATABASE_URL")
		client_id = os.Getenv("CLIENT_ID")
	}
	if db_url == "" {
		//load .env file
		err := godotenv.Load()
		if err != nil {
			fmt.Println("Error loading .env file")
		}
		db_url = os.Getenv("DATABASE_URL")
	}

	db, err := sql.Open("postgres", db_url)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer db.Close()
	go connect_to_nl_chat(db)

	http.HandleFunc("/api/sum", func(w http.ResponseWriter, r *http.Request) {
		span := r.URL.Query().Get("interval")
		var total int
		db.QueryRow("SELECT SUM(count) FROM counts WHERE created > NOW() - $1::interval", span).Scan(&total)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, total)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello World!"))
	})

	http.HandleFunc("/api/instant", func(w http.ResponseWriter, r *http.Request) {
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		rows, err := db.Query(`	
			SELECT SUM(count), 
				SUM(lol), 
				SUM(cereal), 
				SUM(monkas), 
				SUM(joel), 
				SUM(pogs), 
				SUM(huhs),
				EXTRACT(epoch from date_trunc($1, created)) AS created_epoch
			FROM counts 
			WHERE created > NOW() - $2::interval
			GROUP BY date_trunc($1, created) 
			ORDER BY date_trunc($1, created) asc
		`, grouping, span)
		if err != nil {
			fmt.Println(err)
			return
		}
		defer rows.Close()
		data := make([]SeriesData, 0)
		for rows.Next() {
			var seriesData SeriesData
			err := rows.Scan(&seriesData.Twos, &seriesData.Lol, &seriesData.Cereal, &seriesData.Monkas, &seriesData.Joel, &seriesData.Pogs, &seriesData.Huhs, &seriesData.Time)
			if err != nil {
				fmt.Println(err)
				continue
			}
			data = append(data, seriesData)
		}
		marshal_json_and_write(w, data)
	})

	http.HandleFunc("/api/rolling_sum", func(w http.ResponseWriter, r *http.Request) {
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		rows, err := db.Query(`
			SELECT SUM(count) OVER (ORDER BY created),
				SUM(lol) OVER (ORDER BY created),
				SUM(cereal) OVER (ORDER BY created),
				SUM(monkas) OVER (ORDER BY created),
				SUM(joel) OVER (ORDER BY created),
				SUM(pogs) OVER (ORDER BY created),
				SUM(huhs) OVER (ORDER BY created),
			EXTRACT(epoch from date_trunc('minute', created)) AS created_epoch
 			FROM counts
 			WHERE created > NOW() - $2::interval; 
		`, grouping, span)
		if err != nil {
			fmt.Println(err)
			return
		}
		defer rows.Close()
		data := make([]SeriesData, 0)
		for rows.Next() {
			var seriesData SeriesData
			err := rows.Scan(&seriesData.Twos, &seriesData.Lol, &seriesData.Cereal, &seriesData.Monkas, &seriesData.Joel, &seriesData.Pogs, &seriesData.Huhs, &seriesData.Time)
			if err != nil {
				fmt.Println(err)
				continue
			}
			data = append(data, seriesData)
		}
		marshal_json_and_write(w, data)
	})

	http.HandleFunc("/api/max", func(w http.ResponseWriter, r *http.Request) {
		var max int
		var time float64
		err := db.QueryRow("SELECT count, EXTRACT(epoch from created) FROM counts WHERE count=(SELECT max(count) from counts)").Scan(&max, &time)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, SeriesData{Twos: max, Time: time})
	})

	http.HandleFunc("/api/min", func(w http.ResponseWriter, r *http.Request) {
		var min int
		var time float64
		err := db.QueryRow("SELECT count, EXTRACT(epoch from created) FROM counts WHERE count=(SELECT min(count) from counts)").Scan(&min, &time)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, SeriesData{Twos: min, Time: time})

	})

	http.HandleFunc("/api/clip", func(w http.ResponseWriter, r *http.Request) {
		t := r.URL.Query().Get("time")
		var clipID string
		db.QueryRow(`
		SELECT clip_id 
		FROM counts 
		WHERE EXTRACT(epoch from created) > $1::float + 10
		AND EXTRACT(epoch from created) < $1::float + 20
		LIMIT 1`, t).Scan(&clipID)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, clipID)
	})

	port := fmt.Sprintf(":%s", os.Getenv("PORT"))
	fmt.Println("Listening on port", port)

	http.ListenAndServe(port, nil)

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

func connect_to_nl_chat(db *sql.DB) {
	conn, _, err := websocket.DefaultDialer.Dial("ws://irc-ws.chat.twitch.tv:80", nil)
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
			return
		default:
			time.Sleep(100 * time.Millisecond)
		}
	}
}

type ChatCounts struct {
	Twos          int
	LulsAndICANTS int
	Monkas        int
	Cereals       int
	Joels         int
	PogCrazies    int
	Huhs          int
}

func read_chat(conn *websocket.Conn, chat_closed chan error, db *sql.DB) {

	conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS %s", auth_token)))
	conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", nickname)))
	conn.WriteMessage(websocket.TextMessage, []byte("JOIN #northernlion"))

	incomingMessages := make(chan Message)
	go func() {
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
	}()

	post_count_ticker := time.NewTicker(10 * time.Second)
	counter := ChatCounts{}
	for {
		select {
		case msg := <-incomingMessages:
			full_message := string(msg.Data)
			only_message_text := split_and_get_last(full_message, ":")
			if strings.Contains(only_message_text, "LUL") || strings.Contains(only_message_text, "ICANT") {
				counter.LulsAndICANTS++
			}
			if strings.Contains(only_message_text, "Cereal") {
				counter.Cereals++
			}
			if strings.Contains(only_message_text, "monkaS") {
				counter.Monkas++
			}
			if strings.Contains(only_message_text, "Joel") {
				counter.Joels++
			}
			if strings.Contains(only_message_text, "POGCRAZY") || strings.Contains(only_message_text, "Pog") {
				counter.PogCrazies++
			}
			if strings.Contains(only_message_text, "HUHH") {
				counter.Huhs++
			}
			if contains_plus := strings.Contains(only_message_text, "+"); contains_plus {
				delta := parse_val(split_and_get_last(only_message_text, "+"))
				counter.Twos += delta
			} else if contains_minus := strings.Contains(only_message_text, "-"); contains_minus {
				delta := parse_val(split_and_get_last(only_message_text, "-"))
				counter.Twos -= delta
			}
		case <-post_count_ticker.C:
			var timestamp time.Time
			err := db.QueryRow("INSERT INTO counts (count, lol, cereal, monkas, joel, pogs, huhs) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING created", counter.Twos, counter.LulsAndICANTS, counter.Cereals, counter.Monkas, counter.Joels, counter.PogCrazies, counter.Huhs).Scan(&timestamp)
			if err != nil {
				fmt.Println("Error inserting into db:", err)
			}
			go create_clip(db, timestamp)
			counter = ChatCounts{}
		}
	}

}

func split_and_get_last(text string, splitter string) string {
	split_text := strings.Split(text, splitter)
	last := len(split_text) - 1
	return split_text[last]
}

func parse_val(text string) int {
	for _, char := range text {
		if char >= '0' && char <= '9' {
			return int(char - '0')
		}
	}
	return 0
}

func create_clip(db *sql.DB, unix_timestamp time.Time) {
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
	db.Exec("UPDATE counts SET clip_id = $1 WHERE created = $2", clip_id, unix_timestamp)
}

type Message struct {
	Type int
	Data []byte
}

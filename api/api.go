package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type SeriesData struct {
	Y int     `json:"y"`
	X float64 `json:"x"`
}

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println(err)
		return
	}
	db, err := sql.Open("postgres", "user=will password=postgres dbname=nl_jokes sslmode=disable")
	if err != nil {
		fmt.Println(err)
		return
	}
	defer db.Close()
	go connect_to_nl_chat(db)
	http.HandleFunc("/api/sum", func(w http.ResponseWriter, r *http.Request) {
		req_db, err := sql.Open("postgres", "user=will password=postgres dbname=nl_jokes sslmode=disable")
		if err != nil {
			fmt.Println(err)
			return
		}
		defer req_db.Close()
		span := r.URL.Query().Get("interval")
		// cast interval to int

		var total int
		req_db.QueryRow("SELECT SUM(count) FROM counts WHERE created > NOW() - $1::interval", span).Scan(&total)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, total)
	})
	http.HandleFunc("/api/instant", func(w http.ResponseWriter, r *http.Request) {
		req_db, err := sql.Open("postgres", "user=will password=postgres dbname=nl_jokes sslmode=disable")
		if err != nil {
			fmt.Println(err)
			return
		}
		defer req_db.Close()
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		rows, err := req_db.Query("SELECT SUM(count), EXTRACT(epoch from date_trunc($1, created)) FROM counts WHERE created > NOW() - $2::interval GROUP BY date_trunc($1, created) ORDER BY date_trunc($1, created) asc", grouping, span)
		if err != nil {
			fmt.Println(err)
			return
		}
		defer rows.Close()
		data := make([]SeriesData, 0)
		for rows.Next() {
			var count int
			var created float64
			err := rows.Scan(&count, &created)
			if err != nil {
				fmt.Println(err)
				continue
			}
			data = append(data, SeriesData{Y: count, X: created})
		}
		marshal_json_and_write(w, data)
	})
	http.HandleFunc("/api/rolling_sum", func(w http.ResponseWriter, r *http.Request) {
		local_db := get_db()
		defer local_db.Close()
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		rows, err := local_db.Query("SELECT SUM(count) OVER (ORDER BY created), EXTRACT(epoch from date_trunc($1, created)) FROM counts WHERE created > NOW() - $2::interval", grouping, span)
		if err != nil {
			fmt.Println(err)
			return
		}
		defer rows.Close()
		data := make([]SeriesData, 0)
		for rows.Next() {
			var count int
			var created float64
			err := rows.Scan(&count, &created)
			if err != nil {
				fmt.Println(err)
				continue
			}
			data = append(data, SeriesData{Y: count, X: created})
		}
		marshal_json_and_write(w, data)
	})
	http.HandleFunc("/api/max", func(w http.ResponseWriter, r *http.Request) {
		local_db := get_db()
		defer local_db.Close()
		var max int
		var time float64
		local_db.QueryRow("SELECT count, EXTRACT(epoch from created) FROM counts WHERE count=(SELECT max(count) from counts)").Scan(&max, &time)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, SeriesData{Y: max, X: time})
	})
	http.HandleFunc("/api/min", func(w http.ResponseWriter, r *http.Request) {
		local_db := get_db()
		defer local_db.Close()
		var min int
		var time float64
		local_db.QueryRow("SELECT count, EXTRACT(epoch from created) FROM counts WHERE count=(SELECT min(count) from counts)").Scan(&min, &time)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, SeriesData{Y: min, X: time})

	})

	http.ListenAndServe(":8080", nil)

}

func get_db() sql.DB {
	req_db, err := sql.Open("postgres", "user=will password=postgres dbname=nl_jokes sslmode=disable")
	if err != nil {
		fmt.Println(err)
		panic(err)
	}
	return *req_db

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

func read_chat(conn *websocket.Conn, chat_closed chan error, db *sql.DB) {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error loading .env file")
	}
	auth := os.Getenv("AUTH_TOKEN")
	nick := os.Getenv("NICKNAME")
	conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS %s", auth)))
	conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", nick)))
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

	post_count_ticker := time.NewTicker(5 * time.Second)
	count := 0
	for {
		select {
		case msg := <-incomingMessages:
			full_message := string(msg.Data)
			only_message_text := split_and_get_last(full_message, ":")
			if contains_plus := strings.Contains(only_message_text, "+"); contains_plus {
				fmt.Println(only_message_text)
				delta := parse_val(split_and_get_last(only_message_text, "+"))
				count += delta
			} else if contains_minus := strings.Contains(only_message_text, "-"); contains_minus {
				delta := parse_val(split_and_get_last(only_message_text, "-"))
				count -= delta
			}
		case <-post_count_ticker.C:
			db.QueryRow("INSERT INTO counts (count) VALUES ($1)", count)
			count = 0
		default:
			// do other things, like send messages
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
	for _, char := range text {
		if char >= '0' && char <= '9' {
			return int(char - '0')
		}
	}
	return 0
}

type Message struct {
	Type int
	Data []byte
}

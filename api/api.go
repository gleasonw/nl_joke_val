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
	Twos   int     `json:"twos"`
	Lol    int     `json:"lol"`
	Cereal int     `json:"cereal"`
	Monkas int     `json:"monkas"`
	Joel   int     `json:"joel"`
	Pogs   int     `json:"pogs"`
	Huhs   int     `json:"huhs"`
	Time   float64 `json:"time"`
}

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println(err)
		return
	}
	connStr := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", connStr)
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
			SELECT SUM(count) OVER(ORDER BY created), 
				SUM(lol) OVER (ORDER BY created), 
				SUM(cereal) OVER (ORDER BY created), 
				SUM(monkas) OVER (ORDER BY created), 
				SUM(joel) OVER (ORDER BY created), 
				SUM(pogs) OVER (ORDER BY created), 
				SUM(huhs) OVER (ORDER BY created),
				EXTRACT(epoch from date_trunc($1, created)) AS created_epoch
			FROM counts 
			WHERE created > NOW() - $2::interval
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
	// http.HandleFunc("/api/max", func(w http.ResponseWriter, r *http.Request) {
	// 	var max int
	// 	var time float64
	// 	db.QueryRow("SELECT count, EXTRACT(epoch from created) FROM counts WHERE count=(SELECT max(count) from counts)").Scan(&max, &time)
	// 	if err != nil {
	// 		fmt.Println(err)
	// 		return
	// 	}
	// 	marshal_json_and_write(w, SeriesData{Y: max, X: time})
	// })
	// http.HandleFunc("/api/min", func(w http.ResponseWriter, r *http.Request) {
	// 	var min int
	// 	var time float64
	// 	db.QueryRow("SELECT count, EXTRACT(epoch from created) FROM counts WHERE count=(SELECT min(count) from counts)").Scan(&min, &time)
	// 	if err != nil {
	// 		fmt.Println(err)
	// 		return
	// 	}
	// 	marshal_json_and_write(w, SeriesData{Y: min, X: time})

	// })

	http.ListenAndServe(":8080", nil)

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
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error loading .env file")
	}
	auth := os.Getenv("AUTH_TOKEN")
	nick := os.Getenv("NICK")
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
			if strings.Contains(only_message_text, "POGCRAZY") {
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
			fmt.Println(counter)
			db.Exec("INSERT INTO counts (count, lol, cereal, monkas, joel, pogs, huhs) VALUES ($1, $2, $3, $4, $5, $6, $7)", counter.Twos, counter.LulsAndICANTS, counter.Cereals, counter.Monkas, counter.Joels, counter.PogCrazies, counter.Huhs)
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

type Message struct {
	Type int
	Data []byte
}

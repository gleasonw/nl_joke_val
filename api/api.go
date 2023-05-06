package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type SeriesData struct {
	Twos     int     `json:"twos"`
	Lol      int     `json:"lol"`
	Cereal   int     `json:"cereal"`
	Monkas   int     `json:"monkas"`
	Joel     int     `json:"joel"`
	Pogs     int     `json:"pogs"`
	Huhs     int     `json:"huhs"`
	Time     float64 `json:"time"`
	Nos      int     `json:"nos"`
	Cockas   int     `json:"cockas"`
	WhoAsked int     `json:"who_asked"`
	Shock    int     `json:"what"`
	Copium   int     `json:"copium"`
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
	db, err := sql.Open("postgres", db_url)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer db.Close()
	go connect_to_nl_chat(db)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello World!"))
	})

	sumQuery := `	
		SELECT SUM(count) as count_sum,
			SUM(lol) as lol_sum,
			SUM(cereal) as cereal_sum,
			SUM(monkas) as monkas_sum,
			SUM(joel) as joel_sum,
			SUM(pogs) as pogs_sum,
			SUM(huhs) as huhs_sum,
			SUM(nos) as nos_sum,
			SUM(cockas) as cockas_sum,
			SUM(who_askeds) as who_askeds_sum,
			SUM(shocks) as shocks_sum,
			SUM(copiums) as copiums_sum,
			EXTRACT(epoch from date_trunc($1, created)) AS created_epoch
		FROM counts 
		WHERE created >= (SELECT MAX(created) - $2::interval from counts)
		GROUP BY date_trunc($1, created) 
		ORDER BY date_trunc($1, created) asc
	`

	http.HandleFunc("/api/instant", func(w http.ResponseWriter, r *http.Request) {
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		rows, err := db.Query(sumQuery, grouping, span)
		if err != nil {
			fmt.Println(err)
			return
		}
		defer rows.Close()
		data := scan_rows_to_series_data(rows)
		marshal_json_and_write(w, data)
	})

	http.HandleFunc("/api/rolling_sum", func(w http.ResponseWriter, r *http.Request) {
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		rows, err := db.Query(fmt.Sprintf(`
		SELECT SUM(count_sum) OVER(ORDER BY created_epoch),
			SUM(lol_sum) OVER (ORDER BY created_epoch),
			SUM(cereal_sum) OVER (ORDER BY created_epoch),
			SUM(monkas_sum) OVER (ORDER BY created_epoch),
			SUM(joel_sum) OVER (ORDER BY created_epoch),
			SUM(pogs_sum) OVER (ORDER BY created_epoch),
			SUM(huhs_sum) OVER (ORDER BY created_epoch),
			SUM(nos_sum) OVER (ORDER BY created_epoch),
			SUM(cockas_sum) OVER (ORDER BY created_epoch),
			SUM(who_askeds_sum) OVER (ORDER BY created_epoch),
			SUM(shocks_sum) OVER (ORDER BY created_epoch),
			SUM(copiums_sum) OVER (ORDER BY created_epoch),
			created_epoch
		FROM (%s) as grouping_sum`, sumQuery), grouping, span)
		if err != nil {
			fmt.Println(err)
			return
		}
		defer rows.Close()
		data := scan_rows_to_series_data(rows)
		marshal_json_and_write(w, data)
	})

	http.HandleFunc("/api/max_clip", func(w http.ResponseWriter, r *http.Request) {
		var max int
		var time float64
		var clip_id string
		column_to_select := r.URL.Query().Get("column")
		span := r.URL.Query().Get("span")
		if column_to_select == "twos" {
			column_to_select = "count"
		}
		var q string
		switch column_to_select {
		case "count", "lol", "cereal", "monkas", "joel", "pogs", "huhs", "nos", "cockas", "who_asked", "shock", "copium":
			q = fmt.Sprintf(`
			SELECT %s, EXTRACT(epoch from created), clip_id 
			FROM counts 
			WHERE clip_id IS NOT NULL`,
				column_to_select)
			switch span {
			case "day", "week", "month", "year":
				q = fmt.Sprintf(`
				%s AND %s=(
					SELECT max(%s)
					FROM counts
					WHERE created >= (
						SELECT MAX(created) - INTERVAL '1 %s'
						FROM counts)
					)`, q, column_to_select, column_to_select, span)
			default:
				q = fmt.Sprintf("%s AND %s=(SELECT max(%s) from counts)", q, column_to_select, column_to_select)
			}
		default:
			fmt.Println("invalid column")
			return
		}

		err := db.QueryRow(q).Scan(&max, &time, &clip_id)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, map[string]string{
			"clip_id": clip_id,
			"twos":    strconv.Itoa(max),
			"time":    strconv.FormatFloat(time, 'f', 0, 64),
		})
	})

	http.HandleFunc("/api/min_clip", func(w http.ResponseWriter, r *http.Request) {
		var min int
		var time float64
		var clip_id string
		err := db.QueryRow(`
		SELECT count, EXTRACT(epoch from created), clip_id 
		FROM counts 
		WHERE count=(
			SELECT min(count) 
			FROM counts
		)
		AND clip_id IS NOT NULL`).Scan(&min, &time, &clip_id)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, map[string]string{
			"clip_id": clip_id,
			"twos":    strconv.Itoa(min),
			"time":    strconv.FormatFloat(time, 'f', 0, 64),
		})

	})

	http.HandleFunc("/api/clip", func(w http.ResponseWriter, r *http.Request) {
		t := r.URL.Query().Get("time")
		var clipID string
		var time float64
		db.QueryRow(`
		SELECT clip_id, EXTRACT(epoch from created)
		FROM counts 
		WHERE EXTRACT(epoch from created) > $1::float + 10
		AND EXTRACT(epoch from created) < $1::float + 20
		LIMIT 1`, t).Scan(&clipID, &time)
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, map[string]string{
			"clip_id": clipID,
			"time":    fmt.Sprintf("%f", time),
		})
	})

	port := fmt.Sprintf(":%s", os.Getenv("PORT"))
	fmt.Println("Listening on port", port)

	http.ListenAndServe(port, nil)

}

func scan_rows_to_series_data(rows *sql.Rows) []SeriesData {
	data := make([]SeriesData, 0)
	for rows.Next() {
		var seriesData SeriesData
		err := rows.Scan(
			&seriesData.Twos,
			&seriesData.Lol,
			&seriesData.Cereal,
			&seriesData.Monkas,
			&seriesData.Joel,
			&seriesData.Pogs,
			&seriesData.Huhs,
			&seriesData.Nos,
			&seriesData.Cockas,
			&seriesData.WhoAsked,
			&seriesData.Shock,
			&seriesData.Copium,
			&seriesData.Time,
		)
		if err != nil {
			fmt.Println(err)
			continue
		}
		data = append(data, seriesData)
	}
	return data
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
			time.Sleep(30 * time.Second)
			go connect_to_nl_chat(db)
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
	Pogs          int
	Huhs          int
	Nos           int
	Cockas        int
	Copiums       int
	WhoAskeds     int
	Shocks        int
}

func read_chat(conn *websocket.Conn, chat_closed chan error, db *sql.DB) {
    initializeConnection(conn)
    incomingMessages := make(chan Message)
    createClipStatus := make(chan bool)
    lionIsLive := false

    go readMessages(conn, chat_closed, incomingMessages)
    post_count_ticker := time.NewTicker(10 * time.Second)
    counter := ChatCounts{}

    for {
        select {
        case msg := <-incomingMessages:
            processMessage(msg, &counter)
        case <-post_count_ticker.C:
            handlePostCountTicker(db, &lionIsLive, createClipStatus, &counter)
        case clipWasMade := <-createClipStatus:
            lionIsLive = clipWasMade
        }
    }
}

func initializeConnection(conn *websocket.Conn) {
    conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS %s", auth_token)))
    conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("NICK %s", nickname)))
    conn.WriteMessage(websocket.TextMessage, []byte("JOIN #northernlion"))
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

func processMessage(msg Message, counter *ChatCounts) {
    full_message := string(msg.Data)
    only_message_text := split_and_get_last(full_message, ":")
    emotesAndKeywords := map[string]*int{
        "LUL":      &counter.LulsAndICANTS,
        "ICANT":    &counter.LulsAndICANTS,
        "Cereal":   &counter.Cereals,
        "NOOO":     &counter.Nos,
        "COCKA":    &counter.Cockas,
        "monkaS":   &counter.Monkas,
        "Joel":     &counter.Joels,
        "POGCRAZY": &counter.Pogs,
        "Pog":      &counter.Pogs,
        "HUHH":     &counter.Huhs,
        "COPIUM":   &counter.Copiums,
        "D:":       &counter.Shocks,
        "WhoAsked": &counter.WhoAskeds,
    }

    for keyword, count := range emotesAndKeywords {
        if strings.Contains(only_message_text, keyword) {
            (*count)++
        }
    }

    handleTwos(only_message_text, counter)
}

func handleTwos(only_message_text string, counter *ChatCounts) {
    if contains_plus := strings.Contains(only_message_text, "+"); contains_plus {
        counter.Twos += parse_val(split_and_get_last(only_message_text, "+"))
    } else if contains_minus := strings.Contains(only_message_text, "-"); contains_minus {
        counter.Twos -= parse_val(split_and_get_last(only_message_text, "-"))
    }
}
		
func handlePostCountTicker(db *sql.DB, lionIsLive *bool, createClipStatus chan bool, counter *ChatCounts) {
    if *lionIsLive {
        var timestamp time.Time
        err := db.QueryRow(`
        INSERT INTO counts (count, lol, cereal, monkas, joel, pogs, huhs, nos, cockas, copiums, who_askeds, shocks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING created`,
            counter.Twos,
            counter.LulsAndICANTS,
            counter.Cereals,
            counter.Monkas,
            counter.Joels,
            counter.Pogs,
            counter.Huhs,
            counter.Nos,
            counter.Cockas,
            counter.Copiums,
            counter.WhoAskeds,
            counter.Shocks).Scan(&timestamp)
        if err != nil {
            fmt.Println("Error inserting into db:", err)
        }
        go create_clip(db, timestamp, createClipStatus)
    } else {
        go create_clip(db, time.Now(), createClipStatus)
    }
    *counter = ChatCounts{}
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

func create_clip(db *sql.DB, unix_timestamp time.Time, isLive chan bool) {
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
	db.Exec("UPDATE counts SET clip_id = $1 WHERE created = $2", clip_id, unix_timestamp)
	isLive <- true
}

type Message struct {
	Type int
	Data []byte
}

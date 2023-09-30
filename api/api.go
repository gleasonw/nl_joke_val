package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"reflect"
	"strconv"
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
	Ratjam int `json:"ratjam"`
	CreatedAt    time.Time `gorm:"index" json:"-"`
	ClipId       string    `json:"-"`
	Thumbnail string `json:"-"`
	CreatedEpoch float64   `json:"time"`
}

// keep the json the same, but we need the name to reflect the db avg_*
type AveragedChatCounts struct {
	AvgTwo 				float64       `json:"two"`
	AvgLol 				float64       `json:"lol"`
	AvgCereal 			float64       `json:"cereal"`
	AvgMonkas 			float64       `json:"monkas"`
	AvgJoel 			float64       `json:"joel"`
	AvgPog 				float64       `json:"pog"`
	AvgHuh 				float64       `json:"huh"`
	AvgNo 				float64       `json:"no"`
	AvgCocka 			float64       `json:"cocka"`
	AvgWhoAsked 		float64       `json:"who_asked"`
	AvgShock 			float64       `json:"shock"`
	AvgCopium 			float64       `json:"copium"`
	AvgRatjam 			float64       `json:"ratjam"`
	CreatedAt 			time.Time `gorm:"index" json:"-"`
	ClipId 				string    `json:"-"`
	Thumbnail 			string `json:"-"`
	CreatedEpoch 		float64   `json:"time"`
}

var val = reflect.ValueOf(ChatCounts{})
var validColumnSet = make(map[string]bool)


type Clip struct {
	ClipID string  `json:"clip_id"`
	Count  int     `json:"count"`
	Time   float64 `json:"time"`
	Thumbnail string `json:"thumbnail"`
}

type Message struct {
	Type int
	Data []byte
}

var auth_token string = os.Getenv("AUTH_TOKEN")
var nickname string = os.Getenv("NICK")
var db_url string = os.Getenv("DATABASE_URL")
var client_id string = os.Getenv("CLIENT_ID")


// TODO: refresh token every month. URL on Railway vars

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

	for i := 0; i < val.NumField(); i++ {
		jsonTag := val.Type().Field(i).Tag.Get("json")
		if jsonTag != "-" && jsonTag != "time" {
			validColumnSet[jsonTag] = true
		}
	}

	go connect_to_nl_chat(db)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello World!"))
	})


	http.HandleFunc("/api/instant", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println(r.URL)
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		rollingAverage := r.URL.Query().Get("rolling_average")
		from := r.URL.Query().Get("from")
		to := r.URL.Query().Get("to")

		sumQuery, _, err := buildSQL(to)
		if err != nil {
			fmt.Println(err)
			return
		}

		if rollingAverage != "0" && rollingAverage != ""{
			parseIntRollingAverage, err := strconv.Atoi(rollingAverage)

			if err != nil {
				fmt.Println(err)
				return
			}

			avgQuery := buildRollingAverageQuery(ChatCounts{}, parseIntRollingAverage)
			result := []AveragedChatCounts{}
			dbError := db.Raw(avgQuery, grouping, span).Scan(&result).Error
			if dbError != nil {
				fmt.Println(err)
				return
			}
			marshal_json_and_write(w, result)
		} else {
			result := []ChatCounts{}
			dbError := db.Raw(sumQuery, grouping, from).Scan(&result).Error
			if dbError != nil {
				fmt.Println(err)
				return
			}
			marshal_json_and_write(w, result)

		}



	})

	http.HandleFunc("/api/rolling_sum", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println(r.URL)
		grouping := r.URL.Query().Get("grouping")
		from := r.URL.Query().Get("from")
		to := r.URL.Query().Get("to")

		_, overQuery, sqlErr := buildSQL(to)
		if sqlErr != nil {
			fmt.Println(sqlErr)
			return
		}

		result := []ChatCounts{}
		err := db.Raw(overQuery, grouping, from).Scan(&result).Error
		if err != nil {
			fmt.Println(err)
			return
		}
		marshal_json_and_write(w, result)
	})

	http.HandleFunc("/api/clip_counts", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println(r.URL)
		column_to_select := r.URL.Query()["column"]
		span := r.URL.Query().Get("span")
		grouping := r.URL.Query().Get("grouping")
		order := r.URL.Query().Get("order")

		switch grouping {
		case "second", "minute", "hour", "day", "week", "month", "year" :
			break
		default:
			http.Error(w, fmt.Sprintf("invalid grouping: %s", grouping), http.StatusBadRequest)
			return
		}

		switch order {
		case "asc", "desc":
			break
		default:
			http.Error(w, fmt.Sprintf("invalid order: %s", order), http.StatusBadRequest)
			return
		}

		var query string
		timeSpan := "FROM chat_counts"


		for _, column := range column_to_select {
			_, ok := validColumnSet[column]
			if !ok {
				http.Error(w, fmt.Sprintf("invalid column: %s", column_to_select), http.StatusBadRequest)
				return
			}
		}
		
		switch span {
		case "day", "week", "month", "year":

			if span == "day" {
				// a full day pulls clips from prior streams
				span = "9 hours"
			}else{
				span = fmt.Sprintf("1 %s", span)
			}

			timeSpan = fmt.Sprintf(`
				AND created_at >= (
					SELECT MAX(created_at) - INTERVAL '%s'
					FROM chat_counts
				)`, span)
		}

		sum_clause := strings.Join(column_to_select, " + ")
		not_null_clause := make([]string, 0, len(column_to_select))
		for _, column := range column_to_select {
			not_null_clause = append(not_null_clause, fmt.Sprintf("%s IS NOT NULL", column))
		}

		not_null_string := strings.Join(not_null_clause, " AND ")

		query = fmt.Sprintf(`
			SELECT SUM(sub.count) AS count, EXTRACT(epoch from time) as time, MIN(clip_id) as clip_id
			FROM (
				SELECT %s AS count, date_trunc('%s', created_at) as time, clip_id
				FROM chat_counts
				WHERE clip_id != ''
				AND
				%s
				%s
			) sub
			GROUP BY time
			ORDER BY count %s
			LIMIT 10
		`, sum_clause, grouping, not_null_string, timeSpan, order)
		

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


func buildSQL(to string) (string, string, error) {
	val := reflect.ValueOf(ChatCounts{})
	typeOfS := val.Type()
	
	toClause := ""

	if to != "" {
		toClause = fmt.Sprintf("AND created_at <= '%s'", to)
	}

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
		WHERE created_at >= (SELECT MAX(created_at) - $2 from chat_counts)
		%s
		GROUP BY date_trunc($1, created_at) 
		ORDER BY date_trunc($1, created_at) asc
	`, sumFieldStr, toClause)

	overQuery := fmt.Sprintf(`
		SELECT %s,
			created_epoch
		FROM (%s) as grouping_sum
	`, overFieldStr, sumQuery)

	return sumQuery, overQuery, nil
}


func buildRollingAverageQuery(s interface{}, rollingSum int) (string) {
	val := reflect.ValueOf(s)
	typeOfS := val.Type()

	sumFields := make([]string, 0, val.NumField())
	avgOverFields := make([]string, 0, val.NumField())

	for i := 0; i < val.NumField(); i++ {
		fieldName := typeOfS.Field(i).Tag.Get("json")

		if fieldName != "-" && fieldName != "time" {
			sumField := fmt.Sprintf("SUM(%s) as %s", fieldName, fieldName)
			sumFields = append(sumFields, sumField)
			
			avgOverField := fmt.Sprintf("AVG(%s) OVER (ROWS BETWEEN %d PRECEDING AND CURRENT ROW) as avg_%s", fieldName, rollingSum, fieldName)
			avgOverFields = append(avgOverFields, avgOverField)
		}
	}

	sumFieldStr := strings.Join(sumFields, ",\n\t\t")
	avgOverFieldStr := strings.Join(avgOverFields, ",\n\t\t")

	baseQuery := fmt.Sprintf(`
		WITH base_query AS (
			SELECT %s,
				EXTRACT(epoch from date_trunc($1, created_at)) AS created_epoch
			FROM chat_counts
			WHERE created_at >= (SELECT MAX(created_at) - $2::interval from chat_counts)
			GROUP BY date_trunc($1, created_at)
			ORDER BY date_trunc($1, created_at) asc
		)
	`, sumFieldStr)

	avgOverQuery := fmt.Sprintf(`
		SELECT %s,
			created_epoch
		FROM base_query;
	`, avgOverFieldStr)

	fullQuery := baseQuery + avgOverQuery

	return fullQuery
}



func minMaxClipGetter(w http.ResponseWriter, query string, db *gorm.DB) {
	var clips []Clip
	err := db.Raw(query).Scan(&clips).Error
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for i, clip := range clips {
		var instantFromDB ChatCounts
		db.Where("clip_id = ?", clip.ClipID).First(&instantFromDB)
		if instantFromDB.Thumbnail == "" {
			req, err := http.NewRequest("GET", fmt.Sprintf("https://api.twitch.tv/helix/clips?id=%s", clip.ClipID), nil)
			if err != nil {
				fmt.Println(err)
				return
			}
			auth := split_and_get_last(auth_token, ":")
			bearer := fmt.Sprintf("Bearer %s", auth)
			req.Header.Set("Client-Id", client_id)
			req.Header.Set("Authorization", bearer)
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				fmt.Println(err)
				return
			}
			defer resp.Body.Close()
			body, err := ioutil.ReadAll(resp.Body)
			if err != nil {
				fmt.Println(err)
				return
			}
			type HelixClip struct {
				Data []struct {
					ThumbnailURL string `json:"thumbnail_url"`
				} `json:"data"`
			}
			var clipResponse HelixClip
			json.Unmarshal(body, &clipResponse)
			if(len(clipResponse.Data) == 0) {
				fmt.Println("No data returned from helix api")
				fmt.Println(string(body))
				fmt.Println(clip)
				continue
			}
			thumbnailUrl := clipResponse.Data[0].ThumbnailURL
			db.Model(&ChatCounts{}).Where("clip_id = ?", clip.ClipID).Update("thumbnail", thumbnailUrl)
			clips[i].Thumbnail = thumbnailUrl
		} else {
			clips[i].Thumbnail = instantFromDB.Thumbnail
		}
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
	if err != nil {
		fmt.Println("Error connecting to Twitch IRC:", err)
		return
	}

	chat_closed := make(chan error)

	go func() {
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("PASS %s", auth_token)))
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
					"ratJAM":  &counter.Ratjam,
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
			go connect_to_nl_chat(db)
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

	auth := split_and_get_last(auth_token, ":")
	bearer := fmt.Sprintf("Bearer %s", auth)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Client-Id", client_id)
	req.Header.Set("Authorization", bearer)

	client := &http.Client{}
	resp, err := client.Do(req)
	if resp.StatusCode == 404 {
		isLive <- false
		return
	}
	if err != nil {
		fmt.Println("Error sending request:", err)
		return
	}
	defer resp.Body.Close()

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

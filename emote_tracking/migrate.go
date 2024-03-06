package main

import (
	"fmt"
	"os"
	"reflect"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Emote struct {
	gorm.Model
	ChannelId string
	Code      string
}

type EmoteCount struct {
	Id        int `gorm:"primary_key"`
	Count     int
	EmoteID   int `gorm:"index"`
	Emote     Emote
	ClipID    *string
	Clip      FetchedClip
	CreatedAt time.Time `gorm:"index"`
}

type FetchedClip struct {
	VodOffset int
	ClipID    string    `gorm:"primary_key"`
	CreatedAt time.Time `gorm:"index"`
}

func getLegacyEmoteCodes() map[string]string {
	return map[string]string{
		"LUL":                 "lol",
		"ICANT":               "lol",
		"KEKW":                "lol",
		"Cereal":              "cereal",
		"NOOO":                "no",
		"COCKA":               "cocka",
		"monkaS":              "monkas",
		"Joel":                "joel",
		"POGCRAZY":            "pog",
		"Pog":                 "pog",
		"LETSGO":              "pog",
		"HUHH":                "huh",
		"Copium":              "copium",
		"D:":                  "shock",
		"WhoAsked":            "who_asked",
		"ratJAM":              "ratjam",
		"Sure":                "sure",
		"Classic":             "classic",
		"monkaGIGAftRyanGary": "monka_giga",
		"CAUGHT":              "caught",
		"Life":                "life",
	}
}

func verify() error {

	godotenv.Load()

	dbUrl := os.Getenv("DATABASE_URL")

	db, err := gorm.Open(postgres.Open(dbUrl))

	if err != nil {
		panic("failed to connect database")
	}

	db.AutoMigrate(&EmoteCount{})

	bttvEmotes, err := fetchNlEmotesFromBTTV()

	currentColumnSet := getLegacyEmoteCodes()

	if err != nil {
		return err
	}

	newEmoteCodes := make([]string, 0, len(bttvEmotes.Emotes))
	_, legacyColumns := getEmotes()

	for _, emote := range bttvEmotes.Emotes {
		if _, ok := currentColumnSet[emote.Code]; !ok {
			fmt.Println("We aren't tracking this emote yet", emote.Code)
			continue
		}
		newEmoteCodes = append(newEmoteCodes, emote.Code)
	}

	if len(newEmoteCodes) != len(legacyColumns) {
		fmt.Println("We have a mismatch between the number of emotes we are tracking and the number of old columns in the database")
		return nil
	}

	emotesInDb := make([]Emote, 0, len(newEmoteCodes))
	db.Find(&emotesInDb)

	emoteIdMap := make(map[string]int)

	for _, emote := range emotesInDb {
		emoteIdMap[emote.Code] = int(emote.ID)
	}

	for _, emote := range newEmoteCodes {
		var oldCount, newCount int

		legacyColumnName := currentColumnSet[emote]

		query := fmt.Sprintf("SELECT sum(%s) as old_count FROM chat_counts", legacyColumnName)

		db.Raw(query).Scan(&oldCount)

		emoteId, ok := emoteIdMap[emote]

		if !ok {
			fmt.Println("Emote not found in database", emote)
			return nil
		}

		db.Raw(fmt.Sprintf("SELECT sum(count) as new_count FROM emote_counts where emote_id=%d", emoteId)).Scan(&newCount)

		fmt.Println(emote, "old sum and new sum: ", oldCount, newCount)

		if oldCount != newCount || oldCount == 0 || newCount == 0 {
			fmt.Println("Broken migration for ", emote, oldCount, newCount)
			return nil
		}
	}

	fmt.Println("Migration verified")

	return nil
}

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

func migrate() error {

	godotenv.Load()

	dbUrl := os.Getenv("DATABASE_URL")

	db, err := gorm.Open(postgres.Open(dbUrl))

	if err != nil {
		panic("failed to connect database")
	}

	db.AutoMigrate(&Emote{})
	db.AutoMigrate(&EmoteCount{})
	db.AutoMigrate(&FetchedClip{})

	oldChatCounts := make([]ChatCounts, 0, 1000000)

	bttvEmotes, err := fetchNlEmotesFromBTTV()

	if err != nil {
		return err
	}

	bttvEmoteCodeToColumnMap := getLegacyEmoteCodes()

	emotes := make([]string, 0, len(bttvEmotes.Emotes))

	validEmoteSet := make(map[string]bool, len(bttvEmotes.Emotes))

	for _, emote := range bttvEmotes.Emotes {
		if _, ok := bttvEmoteCodeToColumnMap[emote.Code]; !ok {
			fmt.Println("We aren't tracking this emote yet", emote.Code)
			continue
		}
		emotes = append(emotes, emote.Code)
		validEmoteSet[emote.Code] = true
	}

	db.Find(&oldChatCounts)

	emoteToIDMap := make(map[string]Emote)

	db.Transaction(func(tx *gorm.DB) error {

		for _, emote := range emotes {
			emoteToMap := Emote{Code: emote}
			err := tx.Create(&emoteToMap).Error

			if err != nil {
				fmt.Println("Error creating emote", err)
				return err
			}

			emoteToIDMap[emote] = emoteToMap
		}

		emoteCounts := make([]EmoteCount, 0, len(oldChatCounts)*len(emotes))
		clipsToInsert := make([]FetchedClip, 0, len(oldChatCounts))
		columnNameSet, _ := getEmotes()

		for _, oldChatCount := range oldChatCounts {
			oldCountReflect := reflect.ValueOf(oldChatCount)

			columnToCount := make(map[string]int)

			for i := 0; i < oldCountReflect.NumField(); i++ {
				jsonTag := oldCountReflect.Type().Field(i).Tag.Get("json")
				fieldValue := oldCountReflect.Field(i).Interface()
				if ok := columnNameSet[jsonTag]; ok {
					columnToCount[jsonTag] = int(fieldValue.(float64))
				}

			}

			if oldChatCount.ClipId != "" {
				clipsToInsert = append(clipsToInsert,
					FetchedClip{
						ClipID:    oldChatCount.ClipId,
						CreatedAt: oldChatCount.CreatedAt,
					},
				)
			}

			for _, emote := range emotes {
				columnName := bttvEmoteCodeToColumnMap[emote]
				emoteFromDb, ok := emoteToIDMap[emote]

				if !ok {
					fmt.Println("Emote not found in database", emote)
					return nil
				}

				var builder func(count int, emote Emote, oldChatCount ChatCounts) EmoteCount

				if oldChatCount.ClipId != "" {
					builder = buildEmoteCount
				} else {
					builder = buildEmoteCountNoClip
				}

				count, ok := columnToCount[columnName]

				if !ok {
					fmt.Println("Emote not found in chat count", columnName)
					// an emote we don't track yet
					continue
				}

				emoteCount := builder(count, emoteFromDb, oldChatCount)

				emoteCounts = append(emoteCounts, emoteCount)

			}
		}
		// wait for confirmation from user before inserting
		fmt.Println("Inserting clips")

		tx.CreateInBatches(clipsToInsert, 1000)

		fmt.Println("Inserting emote counts")

		tx.CreateInBatches(emoteCounts, 1000)

		return nil
	})

	return nil

}

func buildEmoteCount(count int, emote Emote, oldChatCount ChatCounts) EmoteCount {
	return EmoteCount{
		Count:     count,
		EmoteID:   int(emote.ID),
		Emote:     emote,
		ClipID:    &oldChatCount.ClipId,
		CreatedAt: oldChatCount.CreatedAt,
	}
}

func buildEmoteCountNoClip(count int, emote Emote, oldChatCount ChatCounts) EmoteCount {
	return EmoteCount{
		Count:     count,
		EmoteID:   int(emote.ID),
		Emote:     emote,
		CreatedAt: oldChatCount.CreatedAt,
	}
}

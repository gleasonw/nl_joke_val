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

func verify() error {

	godotenv.Load()

	dbUrl := os.Getenv("DATABASE_URL")

	db, err := gorm.Open(postgres.Open(dbUrl))

	if err != nil {
		panic("failed to connect database")
	}

	db.AutoMigrate(&EmoteCount{})

	_, emotes := getEmotes()

	emotesInDb := make([]Emote, 0, len(emotes))
	db.Find(&emotesInDb)

	emoteIdMap := make(map[string]int)

	for _, emote := range emotesInDb {
		emoteIdMap[emote.Code] = int(emote.ID)
	}

	for _, emote := range emotes {
		var oldCount, newCount int

		query := fmt.Sprintf("SELECT sum(%s) as old_count FROM chat_counts", emote)

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

	validColumnSet, emotes := getEmotes()

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

		for _, oldChatCount := range oldChatCounts {
			oldCountReflect := reflect.ValueOf(oldChatCount)

			countEmoteMap := make(map[string]int)

			for i := 0; i < oldCountReflect.NumField(); i++ {
				jsonTag := oldCountReflect.Type().Field(i).Tag.Get("json")
				fieldValue := oldCountReflect.Field(i).Interface()
				if ok := validColumnSet[jsonTag]; ok {
					countEmoteMap[jsonTag] = int(fieldValue.(float64))
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

				count, ok := countEmoteMap[emote]

				if !ok {
					fmt.Println("Emote not found in chat count", emote)
					return nil
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

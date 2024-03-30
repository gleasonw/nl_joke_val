package main

import (
	"fmt"
	"log"
	"os"
	"reflect"
	"slices"
	"sync"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Emote struct {
	gorm.Model
	ChannelId string
	Code      string `gorm:"unique"`
	BttvId    int64
}

func (e *Emote) String() string {
	return fmt.Sprintf("Emote{ChannelId: %s, Code: %s}", e.ChannelId, e.Code)
}

type EmoteCount struct {
	Id        int64
	Count     int
	EmoteID   int
	Emote     Emote
	ClipID    string
	Clip      FetchedClip
	CreatedAt time.Time
}

func (e *EmoteCount) String() string {
	return fmt.Sprintf("EmoteCount{Count: %d, Emote: %s, CreatedAt: %s}", e.Count, e.Emote.Code, e.CreatedAt)
}

type FetchedClip struct {
	VodOffset int
	ClipID    string    `gorm:"primary_key"`
	CreatedAt time.Time `gorm:"index"`
}

const noClipSentinel = "no_clip"

func legacyCodes() []string {
	return []string{
		"LUL",
		"ICANT",
		"KEKW",
		"Cereal",
		"NOOO",
		"COCKA",
		"monkaS",
		"Joel",
		"POGCRAZY",
		"Pog",
		"LETSGO",
		"HUHH",
		"Copium",
		"D:",
		"WhoAsked",
		"ratJAM",
		"Sure",
		"Classic",
		"monkaGIGAftRyanGary",
		"CAUGHT",
		"Life",
		"two",
	}
}

func legacyCodeToColumnMap() map[string]string {
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
		"two":                 "two",
	}
}

const pog_pogcrazy_letsgo = "pog_pogcrazy_letsgo"
const lul_kekw_icant = "lul_kekw_icant"

func verify(db *gorm.DB) error {
	legacyCodes := legacyCodes()
	codeToLegacyColumnMap := legacyCodeToColumnMap()

	// remove the special cases from legacyCodes
	legacyCodes = slices.DeleteFunc(legacyCodes, func(code string) bool {
		switch code {
		case "LUL", "ICANT", "KEKW", "POGCRAZY", "LETSGO", "Pog":
			return true
		default:
			return false
		}
	})

	codeToLegacyColumnMap[lul_kekw_icant] = "lol"
	codeToLegacyColumnMap[pog_pogcrazy_letsgo] = "pog"

	// a bit slow, could do this in one sql query.
	for _, newEmote := range legacyCodes {
		var oldCount, newCount int

		oldEmote, ok := codeToLegacyColumnMap[newEmote]

		if !ok {
			return fmt.Errorf("unexpected emote while trying to map to old columns: %s", newEmote)
		}

		query := fmt.Sprintf("SELECT sum(%s) as old_count FROM chat_counts", oldEmote)

		db.Raw(query).Scan(&oldCount)

		emoteFromCode := Emote{}

		db.Find(&emoteFromCode, "code = ?", newEmote)

		db.Raw(fmt.Sprintf("SELECT sum(count) as new_count FROM emote_counts where emote_id=%d", emoteFromCode.ID)).Scan(&newCount)

		fmt.Println(newEmote, "old sum and new sum: ", oldCount, newCount)

		if oldCount != newCount || oldCount == 0 || newCount == 0 {
			return fmt.Errorf("broken migration for %s, old sum and new sum: %d %d", newEmote, oldCount, newCount)
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

// moves data in chat_counts to the new data model, more decoupled.
// also sets up timescaledb for the new model

// todo: set jit off
// todo: set up refresh settings
func migrateToNewModel() error {

	godotenv.Load()

	dbUrl := os.Getenv("DATABASE_URL")

	db, err := gorm.Open(postgres.Open(dbUrl), &gorm.Config{
		Logger: logger.New(log.New(os.Stdout, "", log.LstdFlags),
			logger.Config{
				LogLevel: logger.Silent,
			}),
	})

	db.AutoMigrate(&Emote{})
	db.AutoMigrate(&EmoteCount{})
	db.AutoMigrate(&FetchedClip{})

	if err != nil {
		panic("failed to connect database")
	}

	oldChatCounts := make([]ChatCounts, 0, 1000000)

	bttvEmotes, err := fetchNlEmotesFromBTTV()

	if err != nil {
		return err
	}

	codeToColumnMap := legacyCodeToColumnMap()

	emotes := make([]string, 0, len(bttvEmotes.Emotes))

	validEmoteSet := make(map[string]struct{}, len(bttvEmotes.Emotes))

	for _, emote := range bttvEmotes.Emotes {
		if _, ok := codeToColumnMap[emote.Code]; !ok {
			fmt.Println("We aren't tracking this emote yet", emote.Code)
			continue
		}
		emotes = append(emotes, emote.Code)
		validEmoteSet[emote.Code] = struct{}{}
	}

	// add our special cases for combined columns

	emotes = append(emotes, lul_kekw_icant)
	emotes = append(emotes, pog_pogcrazy_letsgo)
	codeToColumnMap[lul_kekw_icant] = "lol"
	codeToColumnMap[pog_pogcrazy_letsgo] = "pog"
	validEmoteSet[lul_kekw_icant] = struct{}{}
	validEmoteSet[pog_pogcrazy_letsgo] = struct{}{}

	// add the non-bttv emotes

	for emoteCode := range codeToColumnMap {
		if _, ok := validEmoteSet[emoteCode]; !ok {
			fmt.Println("adding non-bttv emote", emoteCode)
			validEmoteSet[emoteCode] = struct{}{}
			emotes = append(emotes, emoteCode)
		}
	}

	db.Find(&oldChatCounts)

	emoteToIDMap := make(map[string]Emote)

	for _, emote := range emotes {
		emoteToMap := Emote{Code: emote}
		err := db.Create(&emoteToMap).Error

		if err != nil {
			fmt.Println("Error creating emote", err)
			return err
		}

		emoteToIDMap[emote] = emoteToMap
	}

	// create a sentinel clip for emote counts with no clip
	err = db.Create(&FetchedClip{ClipID: noClipSentinel}).Error

	if err != nil {
		fmt.Println("Error creating sentinel clip:", err)
		return err
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
			columnName := codeToColumnMap[emote]
			emoteFromDb, ok := emoteToIDMap[emote]

			switch emoteFromDb.Code {
			case "KEKW", "ICANT", "LUL", "POGCRAZY", "LETSGO", "Pog":
				// these were tracked in combined columns, so we don't want to insert values for the individual columns.
				continue
			}

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
	fmt.Println("Inserting clips")

	err = concurrentBatchInsert(db, clipsToInsert)

	if err != nil {
		fmt.Println("Error inserting clips:", err)
		return err
	}

	fmt.Println("Inserting emote counts")

	err = concurrentBatchInsert(db, emoteCounts)

	if err != nil {
		fmt.Println("Error inserting emote counts:", err)
		return err
	}

	fmt.Println("Setting up timescaledb")

	// we must drop the primary key for the timescaledb setup.
	// the key comes from gorm. I could probably disable it.
	err = db.Exec("ALTER TABLE emote_counts drop constraint emote_counts_pkey").Error

	if err != nil {
		fmt.Println("Error dropping primary key constraint:", err)
		return err
	}

	err = initTimescaledb(db)

	if err != nil {
		fmt.Println("Error initializing timescaledb:", err)
		return err
	}

	verify(db)

	return nil

}

func concurrentBatchInsert[Row EmoteCount | FetchedClip](db *gorm.DB, rows []Row) error {
	var wg sync.WaitGroup
	numWorkers := 20
	wg.Add(numWorkers)
	numRowsPerWorker := len(rows) / numWorkers
	for i := 0; i < numWorkers; i++ {
		go func(chunkedRows []Row) {
			defer wg.Done()
			err := db.CreateInBatches(chunkedRows, 1000).Error
			if err != nil {
				fmt.Println("Error inserting rows:", err)
			}
		}(rows[i*numRowsPerWorker : (i+1)*numRowsPerWorker])
	}
	remainingRows := len(rows) - (numWorkers * numRowsPerWorker)
	if remainingRows > 0 {
		err := db.Create(rows[numWorkers*numRowsPerWorker:]).Error
		if err != nil {
			fmt.Println("Error inserting remaining rows:", err)
		}
	}
	wg.Wait()
	return nil
}

func initTimescaledb(db *gorm.DB) error {
	err := db.Exec("CREATE extension if not exists timescaledb").Error

	if err != nil {
		fmt.Println("Error creating timescaledb extension:", err)
		return err
	}

	err = db.Exec("SELECT create_hypertable('emote_counts', 'created_at', migrate_data => true, if_not_exists => true);").Error

	if err != nil {
		fmt.Println("Error creating hypertable:", err)
		return err
	}

	secondAggregateName := groupingToView["second"]

	err = db.Exec(fmt.Sprintf(`
		CREATE MATERIALIZED VIEW IF NOT EXISTS %s
		WITH (timescaledb.continuous) AS
		SELECT emote_id, 
			sum(count) as sum,
			time_bucket('10 seconds', created_at) as bucket
		FROM emote_counts
		GROUP BY 1, 3
		ORDER BY bucket;`,
		secondAggregateName)).Error

	if err != nil {
		fmt.Println("Error creating second aggregate: ", err)
		return err
	}

	err = db.Exec(`
		SELECT add_continuous_aggregate_policy('ten_second_sum',
  			start_offset => NULL,
  			end_offset => NULL,
  			schedule_interval => INTERVAL '10 hours',
			if_not_exists => true
			);
		`).Error

	if err != nil {
		fmt.Println("Error creating policy: ", err)
		return err
	}

	minuteAggregateName := groupingToView["minute"]

	err = createMaterializedView(db, secondAggregateName, "1 minute", minuteAggregateName, RefreshPolicy{
		StartOffset:      "NULL",
		EndOffset:        "NULL",
		ScheduleInterval: "11 hours",
	})

	if err != nil {
		fmt.Println("Error creating minute aggregate: ", err)
		return err
	}

	hourlyAggregateName := groupingToView["hour"]

	err = createMaterializedView(db, minuteAggregateName, "1 hour", hourlyAggregateName, RefreshPolicy{
		StartOffset:      "NULL",
		EndOffset:        "NULL",
		ScheduleInterval: "12 hours",
	})

	if err != nil {
		fmt.Println("Error creating hourly aggregate: ", err)
		return err
	}

	dailyAggregateName := groupingToView["day"]

	err = createMaterializedView(db, hourlyAggregateName, "1 day", dailyAggregateName, RefreshPolicy{
		StartOffset:      "NULL",
		EndOffset:        "NULL",
		ScheduleInterval: "13 hours",
	})

	if err != nil {
		fmt.Println("Error creating daily aggregate: ", err)
		return err
	}

	err = db.Exec(fmt.Sprintf(`
			CREATE MATERIALIZED VIEW IF NOT EXISTS %s
			WITH (timescaledb.continuous) AS 
			SELECT time_bucket('3 months'::interval, bucket) as bucket, 
				avg(sum) as average, 
				emote_id
			FROM %s
			GROUP BY 1, 3;`,
		averageDailyViewAggregate, dailyViewAggregate)).Error

	if err != nil {
		fmt.Println("Error creating avg_daily_sum_three_months view:", err)
		return err
	}

	err = db.Exec(fmt.Sprintf(`
		SELECT add_continuous_aggregate_policy('%s',
  			start_offset => NULL,
  			end_offset => NULL,
  			schedule_interval => INTERVAL '1 week');
		`, averageDailyViewAggregate)).Error

	if err != nil {
		fmt.Println("Error creating refresh policy for daily average: ", err)
		return err
	}

	err = db.Exec(fmt.Sprintf(`
			CREATE MATERIALIZED VIEW IF NOT EXISTS %s
			WITH (timescaledb.continuous) AS 
			SELECT time_bucket('3 months'::interval, bucket) as bucket, 
				avg(sum) as average, 
				emote_id
			FROM %s
			GROUP BY 1, 3;`,
		averageHourlyViewAggregate, hourlyViewAggregate)).Error

	if err != nil {
		fmt.Println("Error creating avg_hourly_sum_three_months view:", err)
		return err
	}

	err = db.Exec(fmt.Sprintf(`
		SELECT add_continuous_aggregate_policy('%s',
  			start_offset => NULL,
  			end_offset => NULL,
  			schedule_interval => INTERVAL '1 month');
		`, averageHourlyViewAggregate)).Error

	if err != nil {
		fmt.Println("Error creating refresh policy for hourly average: ", err)
		return err
	}

	return nil

}

func buildEmoteCount(count int, emote Emote, oldChatCount ChatCounts) EmoteCount {
	return EmoteCount{
		Count:     count,
		EmoteID:   int(emote.ID),
		Emote:     emote,
		ClipID:    oldChatCount.ClipId,
		CreatedAt: oldChatCount.CreatedAt,
	}
}

func buildEmoteCountNoClip(count int, emote Emote, oldChatCount ChatCounts) EmoteCount {
	return EmoteCount{
		Count:     count,
		EmoteID:   int(emote.ID),
		ClipID:    noClipSentinel,
		Emote:     emote,
		CreatedAt: oldChatCount.CreatedAt,
	}
}

type RefreshPolicy struct {
	StartOffset      string
	EndOffset        string
	ScheduleInterval string
}

func createMaterializedView(db *gorm.DB, from string, grouping string, aggregateName string, policy RefreshPolicy) error {
	err := db.Exec(fmt.Sprintf(`
			CREATE MATERIALIZED VIEW IF NOT EXISTS %s
			WITH (timescaledb.continuous) AS
			SELECT emote_id, 
				sum(sum) as sum,
				time_bucket('%s', bucket) as bucket
			FROM %s
			GROUP BY 1, 3
			ORDER BY bucket;`,
		aggregateName, grouping, from)).Error

	if err != nil {
		fmt.Println("Error creating materialized view: ", err)
		fmt.Println(grouping)
		return err
	}

	err = db.Exec(fmt.Sprintf(`
		SELECT add_continuous_aggregate_policy('%s',
  			start_offset => %s,
  			end_offset => %s,
  			schedule_interval => INTERVAL '%s', 
			if_not_exists => true
		);
		`, aggregateName, policy.StartOffset, policy.EndOffset, policy.ScheduleInterval)).Error

	if err != nil {
		fmt.Println("Error creating policy: ", err)
		return err
	}

	return nil

}

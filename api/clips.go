package main

import (
	"fmt"
	"time"

	sq "github.com/Masterminds/squirrel"
	"gorm.io/gorm"
)

type Clip struct {
	ClipID string    `json:"clip_id"`
	Count  int       `json:"count"`
	Time   time.Time `json:"time"`
}

type ClipCountsInput struct {
	EmoteID  int    `query:"emote_id" default:"2"`
	Span     string `query:"span" default:"9 hours" enum:"30 minutes,9 hours,1 week,1 month,1 year"`
	Grouping string `query:"grouping" default:"hour" enum:"25 seconds,1 minute,5 minutes,15 minutes,1 hour,1 day"`
	Order    string `query:"order" default:"DESC" enum:"ASC,DESC"`
	Limit    int    `query:"limit" default:"10"`
}

type ClipCountsOutput struct {
	Body []Clip `json:"clips"`
}

// when discovering high rolling sum, we want to eliminate building values
// eg, row@6:45:40: 105, row@6:45:50: 120, row@6:46:00: 110, we only want the max row to avoid overlapping
// the solution is to filter rows within the likelyBitLength window
const likelyBitLength = "1 minutes"

func GetClipCountsNewModel(p ClipCountsInput, db *gorm.DB, validColumnSet map[string]bool) (*ClipCountsOutput, error) {

	var query string

	// we want just the x top bits, but some bit have many clips in the top rankings
	// so we limit to a reasonable value.
	limitMap := map[string]int{
		"25 seconds": 100,
		"1 minute":   300,
		"5 minutes":  1500,
		"15 minutes": 4500,
		"1 hour":     18000,
		"1 day":      432000,
	}

	rollingSumQuery := fmt.Sprintf(`
	SELECT created_at, SUM(count) OVER (                                                   
		ORDER BY created_at                                                                    
		RANGE BETWEEN INTERVAL '%s' PRECEDING AND CURRENT ROW
	) AS rolling_sum
	FROM emote_counts
	WHERE emote_id = $2
	`, p.Grouping)

	if p.Span != "" {
		rollingSumQuery = fmt.Sprintf(`
			%s 
			AND created_at >= (
				SELECT MAX(created_at) - INTERVAL '%s'
				FROM emote_counts
			)`, rollingSumQuery, p.Span)

	}

	rollingSumQuery = fmt.Sprintf("%s ORDER BY rolling_sum %s LIMIT %d", rollingSumQuery, p.Order, limitMap[p.Grouping])

	query = fmt.Sprintf(`
	WITH RollingSums AS (%s),
	RankedIntervals AS (
		SELECT created_at, rolling_sum, ROW_NUMBER() 
		OVER (
			ORDER BY rolling_sum %s, created_at DESC
		) AS rn
		FROM RollingSums
	),
	FilteredIntervals AS (
		SELECT r1.created_at AS max_created_at, r1.rolling_sum
		FROM RankedIntervals r1
		WHERE NOT EXISTS (
			SELECT 1
		    	FROM RankedIntervals r2
		    	WHERE r2.rn < r1.rn
		      	AND r2.created_at >= r1.created_at - INTERVAL '%s'
		      	AND r2.created_at <= r1.created_at + INTERVAL '%s'
		)
		LIMIT $1
	)
	SELECT fi.rolling_sum as count, ec.created_at AS time, ec.clip_id
	FROM FilteredIntervals fi
	CROSS JOIN LATERAL (
		SELECT 
		    ec.created_at, 
		    ec.clip_id, 
		    ec.count
		FROM emote_counts ec
		WHERE ec.created_at BETWEEN fi.max_created_at - INTERVAL '25 seconds' AND fi.max_created_at + INTERVAL '1 second'
		AND ec.emote_id = $2
		ORDER BY ec.count %s
		LIMIT 1
	) ec;
	`, rollingSumQuery, p.Order, likelyBitLength, likelyBitLength, p.Order)

	fmt.Println(query)

	var clips []Clip
	err := db.Raw(query, p.Limit, p.EmoteID).Scan(&clips).Error
	if err != nil {
		fmt.Println(err)
		return &ClipCountsOutput{}, err
	}
	return &ClipCountsOutput{
		clips,
	}, nil
}

type NearestClipInput struct {
	Time int `query:"time"`
}

type NearestClipOutput struct {
	Body Clip
}

func GetNearestClip(p NearestClipInput, db *gorm.DB) (*NearestClipOutput, error) {
	var clip Clip
	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	query, args, err := psql.Select("clip_id", "created_at as time").
		From("chat_counts").
		Where(sq.GtOrEq{"EXTRACT(epoch from created_at)": p.Time + 10}).
		Where(sq.LtOrEq{"EXTRACT(epoch from created_at)": p.Time + 20}).
		Limit(1).
		ToSql()

	if err != nil {
		fmt.Println(err)
		return &NearestClipOutput{}, err
	}

	dbError := db.Raw(query, args...).Scan(&clip).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &NearestClipOutput{}, dbError
	}

	return &NearestClipOutput{clip}, nil

}
package main

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

type Clip struct {
	ClipID string    `json:"clip_id"`
	Count  int       `json:"count"`
	Time   time.Time `json:"time"`
}

type ClipCountsInput struct {
	Column   []string `query:"column" default:"two"`
	Span     string   `query:"span" default:"9 hours" enum:"30 minutes,9 hours,1 week,1 month,1 year"`
	Grouping string   `query:"grouping" default:"hour" enum:"25 seconds,1 minute,5 minutes,15 minutes,1 hour,1 day"`
	Order    string   `query:"order" default:"DESC" enum:"ASC,DESC"`
	Limit    int      `query:"limit" default:"10"`
}

type ClipCountsOutput struct {
	Body []Clip `json:"clips"`
}

// when calculting the rolling sum, we want to eliminate building values
// if we don't filter, then clips from the same bit might enter the rankings
// must be in SQL interval format
const likelyBitLength = "1 minutes"

func GetClipCounts(p ClipCountsInput, db *gorm.DB) (*ClipCountsOutput, error) {
	var query string

	if len(p.Column) == 0 {
		return &ClipCountsOutput{}, fmt.Errorf("no column provided")
	}

	if len(p.Column) > 1 {
		return &ClipCountsOutput{}, fmt.Errorf("multi column not yet supported")
	}

	columnToSelect := p.Column[0]

	if !validColumnSet[columnToSelect] {
		return &ClipCountsOutput{}, fmt.Errorf("invalid column: %s", columnToSelect)
	}

	// // we want just the x top bits, but some bit have many clips in the top rankings
	// // so we limit to a reasonable value.
	// // maybe there are no perf implications? I should test this
	rollingSumValueLimit := 100

	switch p.Grouping {
	case "1 minute":
		rollingSumValueLimit = 300
	case "5 minutes":
		rollingSumValueLimit = 1500
	case "15 minutes":
		rollingSumValueLimit = 4500
	case "1 hour":
		rollingSumValueLimit = 18000
	case "1 day":
		rollingSumValueLimit = 432000
	}

	rollingSumQuery := fmt.Sprintf(`
	SELECT created_at, SUM(%s) OVER (                                                   
		ORDER BY created_at                                                                    
		RANGE BETWEEN INTERVAL '%s' PRECEDING AND CURRENT ROW
	) AS rolling_sum
	FROM chat_counts
	`, columnToSelect, p.Grouping)

	if p.Span != "" {
		rollingSumQuery = fmt.Sprintf(`
			%s 
			WHERE created_at >= (
				SELECT MAX(created_at) - INTERVAL '%s'
				FROM chat_counts
			)`, rollingSumQuery, p.Span)

	}

	rollingSumQuery = fmt.Sprintf("%s LIMIT %d", rollingSumQuery, rollingSumValueLimit)

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
	SELECT fi.rolling_sum as count, cc.created_at AS time, cc.clip_id
	FROM FilteredIntervals fi
	JOIN chat_counts cc
		ON cc.created_at = (
			SELECT created_at
			FROM chat_counts
			WHERE created_at BETWEEN fi.max_created_at - INTERVAL '%s' AND fi.max_created_at + INTERVAL '1 second'
			ORDER BY %s %s
			LIMIT 1
		);
	`, rollingSumQuery, p.Order, likelyBitLength, likelyBitLength, p.Grouping, columnToSelect, p.Order)

	var clips []Clip
	err := db.Raw(query, p.Limit).Scan(&clips).Error
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
	dbError := db.Raw(`
		SELECT clip_id, created_at as time
		FROM chat_counts 
		WHERE EXTRACT(epoch from created_at) > $1::float + 10
		AND EXTRACT(epoch from created_at) < $1::float + 20
		LIMIT 1`, p.Time).Scan(&clip).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &NearestClipOutput{}, dbError
	}

	return &NearestClipOutput{clip}, nil

}

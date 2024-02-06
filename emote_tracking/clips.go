package main

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type Clip struct {
	ClipID string  `json:"clip_id"`
	Count  int     `json:"count"`
	Time   float64 `json:"time"`
}

type ClipCountsInput struct {
	Column   []string `query:"column" default:"two"`
	Span     string   `query:"span" default:"9 hours" enum:"9 hours,1 week,1 month,1 year"`
	Grouping string   `query:"grouping" default:"hour" enum:"second,minute,hour,day,week,month,year"`
	Order    string   `query:"order" default:"DESC" enum:"ASC,DESC"`
	Limit    int      `query:"limit" default:"10"`
}

type ClipCountsOutput struct {
	Body []Clip `json:"clips"`
}

func GetClipCounts(p ClipCountsInput, db *gorm.DB) (*ClipCountsOutput, error) {
	var query string

	for emote := range p.Column {
		if !validColumnSet[p.Column[emote]] {
			return &ClipCountsOutput{}, fmt.Errorf("invalid column: %s", p.Column[emote])
		}
	}

	timeSpan := "FROM chat_counts"
	if p.Span != "" {
		timeSpan = fmt.Sprintf(`
			AND created_at >= (
				SELECT MAX(created_at) - INTERVAL '%s'
				FROM chat_counts
			)`, p.Span)
	}

	sumClause := strings.Join(p.Column, " + ")

	notNullClause := make([]string, 0, len(p.Column))
	for _, column := range p.Column {
		notNullClause = append(notNullClause, fmt.Sprintf("%s IS NOT NULL", column))
	}
	notNullString := strings.Join(notNullClause, " AND ")

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
		LIMIT %d
	`, sumClause, p.Grouping, notNullString, timeSpan, p.Order, p.Limit)

	var clips []Clip
	err := db.Raw(query).Scan(&clips).Error
	if err != nil {
		fmt.Println(err)
		return &ClipCountsOutput{}, err
	}

	return &ClipCountsOutput{
		clips,
	}, nil
}

type NearestClipInput struct {
	Time string
}

type NearestClipOutput struct {
	ClipID string `json:"clip_id"`
	Time   string `json:"time"`
}

func GetNearestClip(p NearestClipInput, db *gorm.DB) (*NearestClipOutput, error) {
	var clip Clip
	dbError := db.Raw(`
		SELECT clip_id, EXTRACT(epoch from created_at) as time
		FROM chat_counts 
		WHERE EXTRACT(epoch from created_at) > $1::float + 10
		AND EXTRACT(epoch from created_at) < $1::float + 20
		LIMIT 1`, p.Time).Scan(&clip).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &NearestClipOutput{}, dbError
	}

	return &NearestClipOutput{
		ClipID: clip.ClipID,
		Time:   fmt.Sprintf("%f", clip.Time),
	}, nil

}

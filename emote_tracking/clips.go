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
	Column   []string
	Span     string
	Grouping string
	Order    string
	Limit    int
}

type ClipCountsOutput struct {
	Clips []Clip `json:"clips"`
}

func GetClipCounts(p ClipCountsInput, db *gorm.DB) (*ClipCountsOutput, error) {
	var query string

	timeSpan := "FROM chat_counts"
	if p.Span != "" {
		span := p.Span

		if span == "day" {
			// a full day pulls clips from prior streams
			span = "9 hours"
		} else {
			span = fmt.Sprintf("1 %s", span)
		}

		timeSpan = fmt.Sprintf(`
			AND created_at >= (
				SELECT MAX(created_at) - INTERVAL '%s'
				FROM chat_counts
			)`, span)
	}

	sum_clause := strings.Join(p.Column, " + ")
	not_null_clause := make([]string, 0, len(p.Column))
	for _, column := range p.Column {
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
		LIMIT %s
	`, sum_clause, p.Grouping, not_null_string, timeSpan, p.Order, p.Limit)
	var clips []Clip
	err := db.Raw(query).Scan(&clips).Error
	if err != nil {
		fmt.Println(err)
		return &ClipCountsOutput{}, err
	}

	return &ClipCountsOutput{
		Clips: clips,
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

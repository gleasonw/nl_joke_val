package main

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"gorm.io/gorm"
)

// weird things:
// no error if no path in struct

type SeriesInput struct {
	Span           string    `query:"span" enum:"day,week,month,year"`
	Grouping       string    `query:"grouping" enum:"10 seconds,30 seconds,1 minute,5 minutes"`
	RollingAverage int       `query:"rolling_average"`
	From           time.Time `query:"from"`
	To             time.Time `query:"to"`
}

type SeriesOutput struct {
	Body []ChatCounts
}

type AveragedSeriesOutput struct {
	Body []AveragedChatCounts
}

func GetSeries(p SeriesInput, db *gorm.DB) (*SeriesOutput, error) {
	var result = []ChatCounts{}

	dbError := db.Raw(getTimeFilterSQL(p), p.Grouping, p.From, p.To).Scan(&result).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &SeriesOutput{}, dbError
	}

	return &SeriesOutput{result}, nil

}

func GetRollingAverageSeries(p SeriesInput, db *gorm.DB) (*AveragedSeriesOutput, error) {
	rollingAverageString := buildStringForEachColumn(func(fieldName string) string {
		return fmt.Sprintf("AVG(%s) OVER (ROWS BETWEEN %d PRECEDING AND CURRENT ROW) as avg_%s", fieldName, p.RollingAverage, fieldName)
	})
	result := []AveragedChatCounts{}

	query := fmt.Sprintf(`
	WITH base_sum AS (%s)
	SELECT %s ,
	created_epoch
	FROM base_sum
	`, getTimeFilterSQL(p), rollingAverageString)

	dbError := db.Raw(query, p.Grouping, p.From, p.To).Scan(&result).Error
	if dbError != nil {
		fmt.Println(dbError)
		return &AveragedSeriesOutput{}, dbError
	}

	return &AveragedSeriesOutput{result}, nil
}

func buildStringForEachColumn(fn func(string) string) string {
	val := reflect.ValueOf(ChatCounts{})
	typeOfS := val.Type()
	columnStrings := make([]string, 0, val.NumField())
	for i := 0; i < val.NumField(); i++ {
		fieldName := typeOfS.Field(i).Tag.Get("json")
		if fieldName != "-" && fieldName != "time" {
			columnStrings = append(columnStrings, fn(fieldName))
		}
	}
	return strings.Join(columnStrings, ",\n")
}

var baseSumStrings = buildStringForEachColumn(func(fieldName string) string {
	return fmt.Sprintf("SUM(%s) as %s", fieldName, fieldName)
})

var seriesQueryFromTo = fmt.Sprintf(`
SELECT %s,
EXTRACT(epoch from date_trunc($1, created_at)) AS created_epoch
FROM chat_counts 
WHERE created_at BETWEEN $2 AND $3
GROUP BY date_trunc($1, created_at) 
ORDER BY date_trunc($1, created_at) asc
`, baseSumStrings)

var seriesQuerySinceSpan = fmt.Sprintf(`
SELECT %s,
EXTRACT(epoch from date_trunc($1, created_at)) AS created_epoch
FROM chat_counts
WHERE created_at > (
SELECT MAX(created_at) - $2::interval 
FROM chat_counts
)
GROUP BY date_trunc($1, created_at)
ORDER BY date_trunc($1, created_at) asc
`, baseSumStrings)

func getTimeFilterSQL(p SeriesInput) string {
	if p.Span != "" {
		return seriesQuerySinceSpan
	}
	return seriesQueryFromTo
}

package main

import (
	"fmt"
	"net/http"
	"reflect"
	"strings"

	_ "github.com/lib/pq"
	"gorm.io/gorm"
)

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

type SeriesInput struct {
	Span           string
	Grouping       string
	RollingAverage int
	From           string
	To             string
}

type SeriesOutput struct {
	Body []ChatCounts
}

type AveragedSeriesOutput struct {
	Body []AveragedChatCounts
}

func GetSeries(w http.ResponseWriter, p SeriesInput, db *gorm.DB) SeriesOutput {
	finalDbQuery := ""

	if p.Span != "" {
		finalDbQuery = seriesQuerySinceSpan
	} else {
		finalDbQuery = seriesQueryFromTo
	}

	if p.RollingAverage > 0 {
		return getRollingAverageSeries(w, p, db, finalDbQuery)
	}

	var result = []ChatCounts{}

	dbError := db.Raw(finalDbQuery, p.Grouping, p.From, p.To).Scan(&result).Error
	if dbError != nil {
		fmt.Println(dbError)
		return SeriesOutput{}
	}

	return SeriesOutput{result}

}

func getRollingAverageSeries(w http.ResponseWriter, p SeriesInput, db *gorm.DB, finalDbQuery string) AveragedSeriesOutput {
	rollingAverageString := buildStringForEachColumn(func(fieldName string) string {
		return fmt.Sprintf("AVG(%s) OVER (ROWS BETWEEN %d PRECEDING AND CURRENT ROW) as avg_%s", fieldName, p.RollingAverage, fieldName)
	})
	result := []AveragedChatCounts{}

	finalDbQuery = fmt.Sprintf(`
	WITH base_sum AS (%s)
	SELECT %s ,
	created_epoch
	FROM base_sum
	`, finalDbQuery, rollingAverageString)

	dbError := db.Raw(finalDbQuery, p.Grouping, p.From, p.To).Scan(&result).Error
	if dbError != nil {
		fmt.Println(dbError)
		return AveragedSeriesOutput{}
	}

	return AveragedSeriesOutput{result}
}

package main

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"gorm.io/gorm"
)

type SeriesInput struct {
	Span           string    `query:"span" enum:"1 minute,30 minutes,1 hour,9 hours,custom" default:"9 hours"`
	Grouping       string    `query:"grouping" enum:"second,minute,hour,day,week,month,year" default:"minute"`
	RollingAverage int       `query:"rollingAverage"`
	From           time.Time `query:"from"`
	To             time.Time `query:"to"`
}

type SeriesOutput struct {
	Body []ChatCounts
}

var baseFromToQuery = `
SELECT %s,
EXTRACT(epoch from date_trunc($1, created_at)) AS created_epoch
FROM chat_counts 
WHERE created_at BETWEEN $2 AND $3
GROUP BY date_trunc($1, created_at) 
ORDER BY date_trunc($1, created_at) asc
`

var baseSinceSpanQuery = `
SELECT %s,
EXTRACT(epoch from date_trunc($1, created_at)) AS created_epoch
FROM chat_counts
WHERE created_at > (
	SELECT MAX(created_at) - $2::interval 
	FROM chat_counts
)
GROUP BY date_trunc($1, created_at)
ORDER BY date_trunc($1, created_at) asc
`

var baseSumStrings = buildStringForEachColumn(func(fieldName string) string {
	return fmt.Sprintf("SUM(%s) as %s", fieldName, fieldName)
})

var queryFromTo = fmt.Sprintf(baseFromToQuery, baseSumStrings)
var querySinceSpan = fmt.Sprintf(baseSinceSpanQuery, baseSumStrings)

func GetSeries(p SeriesInput, db *gorm.DB) (*SeriesOutput, error) {
	result := runQuery(p, queryRunner{
		getResultsFromTo: func() queryReturn {
			result := []ChatCounts{}
			dbError := db.Raw(queryFromTo, p.Grouping, p.From, p.To).Scan(&result).Error
			return queryReturn{result, dbError}
		},
		getResultsSpanSinceLive: func() queryReturn {
			result := []ChatCounts{}
			dbError := db.Raw(querySinceSpan, p.Grouping, p.Span).Scan(&result).Error
			return queryReturn{result, dbError}
		},
	})

	if result.error != nil {
		fmt.Println(result.error)
		return &SeriesOutput{}, result.error
	}

	return &SeriesOutput{result.result}, nil

}

func tempColumnSumName(fieldName string) string {
	return fieldName + "_sum"
}

// we rename the column to avoid conflict with later averaged sum
var averagedSumStrings = buildStringForEachColumn(func(fieldName string) string {
	return fmt.Sprintf("SUM(%s) as %s", fieldName, tempColumnSumName(fieldName))
})

var averagedQueryFromTo = fmt.Sprintf(baseFromToQuery, averagedSumStrings)
var averagedQuerySinceSpan = fmt.Sprintf(baseSinceSpanQuery, averagedSumStrings)

func GetRollingAverageSeries(p SeriesInput, db *gorm.DB) (*SeriesOutput, error) {
	rollingAverageString := buildStringForEachColumn(func(fieldName string) string {
		return fmt.Sprintf("AVG(%s) OVER (ROWS BETWEEN %d PRECEDING AND CURRENT ROW) as %s", tempColumnSumName(fieldName), p.RollingAverage, fieldName)
	})
	var dbError error

	baseQuery := `
	WITH base_sum AS (%s)
	SELECT %s ,
	created_epoch
	FROM base_sum
	`

	result := runQuery(p, queryRunner{
		getResultsFromTo: func() queryReturn {
			result := []ChatCounts{}
			query := fmt.Sprintf(baseQuery, averagedQueryFromTo, rollingAverageString)
			dbError = db.Raw(query, p.Grouping, p.From, p.To).Scan(&result).Error
			return queryReturn{result, dbError}
		},
		getResultsSpanSinceLive: func() queryReturn {
			result := []ChatCounts{}
			query := fmt.Sprintf(baseQuery, averagedQuerySinceSpan, rollingAverageString)
			dbError = db.Raw(query, p.Grouping, p.Span).Scan(&result).Error
			return queryReturn{result, dbError}
		},
	})

	if result.error != nil {
		fmt.Println(dbError)
		return &SeriesOutput{}, dbError
	}

	return &SeriesOutput{result.result}, nil
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

type queryReturn struct {
	result []ChatCounts
	error  error
}

type queryRunner struct {
	getResultsFromTo        func() queryReturn
	getResultsSpanSinceLive func() queryReturn
}

func runQuery(p SeriesInput, runner queryRunner) queryReturn {
	if !p.From.IsZero() && !p.To.IsZero() {
		return runner.getResultsFromTo()
	} else if p.Span != "" {
		return runner.getResultsSpanSinceLive()
	} else {
		return queryReturn{error: fmt.Errorf("invalid input, must provide either from and to or span")}
	}
}

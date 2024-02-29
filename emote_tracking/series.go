package main

import (
	"fmt"
	"reflect"
	"time"

	sq "github.com/Masterminds/squirrel"
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

func GetSeries(p SeriesInput, db *gorm.DB) (*SeriesOutput, error) {

	query, args := seriesQuery(p)
	fmt.Println(query)

	result := []ChatCounts{}

	dbError := db.Raw(query, args...).Scan(&result).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &SeriesOutput{}, dbError
	}

	return &SeriesOutput{result}, nil

}

func seriesQuery(p SeriesInput) (string, []interface{}) {
	emotes := getEmotes()
	sumStrings := buildSumStrings(
		emotes,
		p,
		func(s string) string {
			return fmt.Sprintf("SUM(%s) as %s", s, s)
		})

	baseSelect := baseSeriesSelect(p, sumStrings)

	sql, args, err := baseSelect.ToSql()

	if err != nil {
		fmt.Println(err)
		return "", nil
	}

	return sql, args
}

func tempColumnSumName(fieldName string) string {
	return fieldName + "_sum"
}

func GetRollingAverageSeries(p SeriesInput, db *gorm.DB) (*SeriesOutput, error) {

	query, args := rollingAverageSeriesQuery(p)

	result := []ChatCounts{}

	dbError := db.Raw(query, args...).Scan(&result).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &SeriesOutput{}, dbError
	}

	return &SeriesOutput{result}, nil
}

func rollingAverageSeriesQuery(p SeriesInput) (string, []interface{}) {
	emotes := getEmotes()
	sumStrings := buildSumStrings(
		emotes,
		p,
		func(s string) string {
			return fmt.Sprintf("SUM(%s) as %s", s, tempColumnSumName(s))
		})

	baseSelect := baseSeriesSelect(p, sumStrings).Prefix("WITH base_sum AS (").Suffix(")")

	baseSql, baseArgs, err := baseSelect.ToSql()

	if err != nil {
		fmt.Println(err)
		return "", nil
	}

	avgStrings := buildStringForEachColumn(func(fieldName string) string {
		return fmt.Sprintf(
			"AVG(%s) OVER (ROWS BETWEEN %d PRECEDING AND CURRENT ROW) as %s",
			tempColumnSumName(fieldName),
			p.RollingAverage,
			fieldName,
		)
	})

	avgStrings = append(avgStrings, "created_epoch")

	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	avgSelect := psql.Select(avgStrings...).From("base_sum").Prefix(baseSql)

	sql, args, err := avgSelect.ToSql()

	if err != nil {
		fmt.Println(err)
		return "", nil
	}

	allArgs := append(baseArgs, args...)

	return sql, allArgs
}

func buildStringForEachColumn(fn func(string) string) []string {
	val := reflect.ValueOf(ChatCounts{})
	typeOfS := val.Type()
	columnStrings := make([]string, 0, val.NumField())
	for i := 0; i < val.NumField(); i++ {
		fieldName := typeOfS.Field(i).Tag.Get("json")
		if fieldName != "-" && fieldName != "time" {
			columnStrings = append(columnStrings, fn(fieldName))
		}
	}
	return columnStrings
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

func getEmotes() []string {
	val := reflect.ValueOf(ChatCounts{})
	typeOfS := val.Type()
	columnStrings := make([]string, 0, val.NumField())
	for i := 0; i < val.NumField(); i++ {
		fieldName := typeOfS.Field(i).Tag.Get("json")
		if fieldName != "-" && fieldName != "time" {
			columnStrings = append(columnStrings, fieldName)
		}
	}
	return columnStrings
}

func buildSumStrings(
	emotes []string,
	p SeriesInput,
	buildString func(fieldName string) string,
) []string {
	sumStrings := make([]string, 0, len(emotes)+1)
	for _, emote := range emotes {
		sumStrings = append(sumStrings, buildString(emote))
	}
	sumStrings = append(sumStrings, fmt.Sprintf("EXTRACT(epoch from date_trunc('%s', created_at)) as created_epoch", p.Grouping))
	return sumStrings
}

func baseSeriesSelect(p SeriesInput, sumStrings []string) sq.SelectBuilder {
	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	series := psql.Select(sumStrings...).
		From("chat_counts")

	if !p.From.IsZero() && !p.To.IsZero() {
		series = series.
			Where(sq.LtOrEq{"created_at": p.To}).
			Where(sq.GtOrEq{"created_at": p.From})

	} else if p.Span != "" {
		series = series.Where(psql.Select(fmt.Sprintf("MAX(created_at) - '%s'::interval", p.Span)).From("chat_counts").Prefix("created_at >=(").Suffix(")"))
	}

	series = series.
		GroupBy(fmt.Sprintf("date_trunc('%s', created_at)", p.Grouping)).
		OrderBy(fmt.Sprintf("date_trunc('%s', created_at) asc", p.Grouping))

	return series
}

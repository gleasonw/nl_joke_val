package main

import (
	"fmt"
	"slices"
	"strconv"
	"time"

	sq "github.com/Masterminds/squirrel"

	"gorm.io/gorm"
)

type TimeSeries struct {
	Time   time.Time          `json:"time"`
	Series map[string]float64 `json:"series"`
}

type TimeSeriesOutput struct {
	Body []TimeSeries
}

type TimeSeriesRow struct {
	Count float64
	Time  time.Time
	Code  string
}

type SeriesInput struct {
	Span           string    `query:"span" enum:"1 minute,30 minutes,1 hour,9 hours,custom" default:"9 hours"`
	Grouping       string    `query:"grouping" enum:"second,minute,hour,day,week,month,year" default:"minute"`
	RollingAverage int       `query:"rollingAverage"`
	From           time.Time `query:"from"`
	To             time.Time `query:"to"`
}

func GetTimeSeries(p SeriesInput, db *gorm.DB) (*TimeSeriesOutput, error) {
	return queryGroupAndSort(baseSeriesSelect(p), db)
}

func GetTimeSeriesRollingAverage(p SeriesInput, db *gorm.DB) (*TimeSeriesOutput, error) {

	baseSeries := baseSeriesSelect(p)

	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	rollingSeries := psql.Select(
		"code",
		"time",
		"AVG(count) OVER (PARTITION BY code ORDER BY time ROWS BETWEEN "+strconv.Itoa(p.RollingAverage)+" PRECEDING AND CURRENT ROW) as count").
		FromSelect(baseSeries, "series")

	return queryGroupAndSort(rollingSeries, db)

}

func baseSeriesSelect(p SeriesInput) sq.SelectBuilder {
	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	series :=
		psql.Select("sum(count) as count, date_trunc('" + p.Grouping + "', emote_counts.created_at) as time, emote_id").
			From("emote_counts")

	if !p.From.IsZero() && !p.To.IsZero() {
		series = series.
			Where(sq.LtOrEq{"emote_counts.created_at": p.To}).
			Where(sq.GtOrEq{"emote_counts.created_at": p.From})
	} else if p.Span != "" {
		series = series.
			Where(psql.Select(fmt.Sprintf("MAX(created_at) - '%s'::interval", p.Span)).
				From("emote_counts").
				Prefix("emote_counts.created_at >=(").
				Suffix(")"))
	}

	series = series.
		GroupBy("emote_id", "time").
		OrderBy("time")

	seriesJoin := psql.
		Select("count", "time", "code").
		FromSelect(series, "series").
		Join("emotes on emotes.id = series.emote_id")

	return seriesJoin

}

func queryGroupAndSort(builder sq.SelectBuilder, db *gorm.DB) (*TimeSeriesOutput, error) {
	sql, args, err := builder.ToSql()

	if err != nil {
		fmt.Println(err)
		return &TimeSeriesOutput{}, nil
	}

	result := []TimeSeriesRow{}

	dbError := db.Raw(sql, args...).Scan(&result).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &TimeSeriesOutput{}, dbError
	}

	output := make(map[time.Time]TimeSeries)

	for _, row := range result {
		if _, ok := output[row.Time]; !ok {
			output[row.Time] = TimeSeries{Time: row.Time, Series: make(map[string]float64)}
		}
		output[row.Time].Series[row.Code] = row.Count
	}

	seriesOutput := make([]TimeSeries, 0, len(output))

	for _, series := range output {
		seriesOutput = append(seriesOutput, series)
	}

	slices.SortFunc(seriesOutput, func(i TimeSeries, j TimeSeries) int {
		if i.Time.Before(j.Time) {
			return -1
		}
		if i.Time.After(j.Time) {
			return 1
		}
		return 0
	})

	return &TimeSeriesOutput{seriesOutput}, nil
}

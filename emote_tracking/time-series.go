package main

import (
	"fmt"
	"time"

	sq "github.com/Masterminds/squirrel"

	"gorm.io/gorm"
)

// need to migrate this function to our new data model
// which is like count/emote_id/clip_id/created_at
// versus old model which was emote1_count/emote2_count/emote3_count/created_at

type TimeSeries map[string]float64

type TimeSeriesOutput struct {
	Body []TimeSeries
}

// the simple series query

// select sum(count), date_trunc('hour', created_at) as time, emote_id
// from emote_counts
// where created_at > (select max(created_at) - '9 hours'::interval from emote_counts)
// group by emote_id, date_trunc('hour', created_at);

// now we join that into the emotes table

type TimeSeriesRow struct {
	Count float64
	Time  time.Time
	Code  string
}

func GetTimeSeries(p SeriesInput, db *gorm.DB) (*TimeSeriesOutput, error) {

	series := buildSeriesSelect(p)

	sql, args, err := series.ToSql()

	if err != nil {
		fmt.Println(err)
		return &TimeSeriesOutput{}, nil
	}

	fmt.Println(sql, args)

	result := []TimeSeriesRow{}

	dbError := db.Raw(sql, args...).Scan(&result).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &TimeSeriesOutput{}, dbError
	}

	return &TimeSeriesOutput{}, nil

}

func buildSeriesSelect(p SeriesInput) sq.SelectBuilder {
	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	series :=
		sq.Select("sum(count) as count, date_trunc('" + p.Grouping + "', emote_counts.created_at) as time, emote_id").
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

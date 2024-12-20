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
	Sum    float64
	Bucket time.Time
	Code   string
}

type SeriesInput struct {
	Span           string    `query:"span" enum:"1 minute,30 minutes,1 hour,9 hours" default:"9 hours"`
	Grouping       string    `query:"grouping" enum:"second,minute,hour,day,week,month,year" default:"minute"`
	RollingAverage int       `query:"rollingAverage"`
	From           time.Time `query:"from"`
	To             time.Time `query:"to"`
}

type SeriesInputForEmotes struct {
	Span           string    `query:"span" enum:"1 minute,30 minutes,1 hour,9 hours" default:"9 hours"`
	Grouping       string    `query:"grouping" enum:"second,minute,hour,day,week,month,year" default:"minute"`
	RollingAverage int       `query:"rollingAverage"`
	From           time.Time `query:"from"`
	To             time.Time `query:"to"`
	EmoteIDs       []int     `query:"emote_ids"`
}

func selectLatestGreatestTimeSeries(p SeriesInputForEmotes, db *gorm.DB) (*TimeSeriesOutput, error) {
	topEmoteIds, err := topEmoteIds(db, EmoteSumInput{
		Grouping: p.Grouping,
		From:     p.From,
		Span:     p.Span,
		Limit:    5,
	})

	if err != nil {
		return &TimeSeriesOutput{}, err
	}

	return selectLatestSeries(SeriesInputForEmotes{
		Grouping: p.Grouping,
		Span:     p.Span,
		From:     p.From,
		EmoteIDs: topEmoteIds,
	}, db)
}

func selectLatestTrendiestTimeSeries(p SeriesInputForEmotes, db *gorm.DB) (*TimeSeriesOutput, error) {
	trendiestEmoteIDs, err := trendiestEmoteIDs(
		LatestEmotePerformanceInput{
			Limit:    5,
			Grouping: "hour",
		},
		db,
	)

	if err != nil {
		fmt.Println("Error fetching trendiest emotes")
		return &TimeSeriesOutput{}, err
	}

	return selectLatestSeries(
		SeriesInputForEmotes{
			Grouping: p.Grouping,
			Span:     p.Span,
			From:     p.From,
			EmoteIDs: trendiestEmoteIDs,
		},
		db,
	)

}

func selectLatestSeries(p SeriesInputForEmotes, db *gorm.DB) (*TimeSeriesOutput, error) {
	query := statementBuilder().
		Select("sum(count) as sum", fmt.Sprintf("time_bucket('1 %s', created_at) as bucket", p.Grouping), "emote_id").
		From("emote_counts")

	query = addFilterCreatedAtSpan(query, p.Span)

	query = query.
		Where(sq.Eq{"emote_id": p.EmoteIDs}).
		GroupBy("bucket, emote_id")

	seriesJoin := statementBuilder().
		Select("sum", "bucket", "code", "emote_id").
		FromSelect(query, "series").
		Join("emotes on emotes.id = series.emote_id")

	rollingSeries := statementBuilder().
		Select(
			"code",
			"bucket",
			"AVG(sum) OVER (PARTITION BY emote_id ORDER BY bucket ROWS BETWEEN "+strconv.Itoa(p.RollingAverage)+" PRECEDING AND CURRENT ROW) as sum").
		FromSelect(seriesJoin, "series_with_emotes")

	return queryGroupAndSort(rollingSeries, db)
}

func selectSeries(p SeriesInputForEmotes, db *gorm.DB) (*TimeSeriesOutput, error) {

	baseSeries := baseSeriesSelect(p)

	rollingSeries := statementBuilder().
		Select(
			"code",
			"bucket",
			"AVG(sum) OVER (PARTITION BY emote_id ORDER BY bucket ROWS BETWEEN "+strconv.Itoa(p.RollingAverage)+" PRECEDING AND CURRENT ROW) as sum").
		FromSelect(baseSeries, "series")

	return queryGroupAndSort(rollingSeries, db)

}

func selectSeriesForGreatest(p SeriesInput, db *gorm.DB) (*TimeSeriesOutput, error) {

	topEmoteIds, err := topEmoteIds(db, EmoteSumInput{
		Grouping: p.Grouping,
		From:     p.From,
		Span:     p.Span,
		Limit:    5,
	})

	if err != nil {
		return &TimeSeriesOutput{}, err
	}

	baseSeries := baseSeriesSelect(SeriesInputForEmotes{
		Grouping: p.Grouping,
		Span:     p.Span,
		From:     p.From,
		EmoteIDs: topEmoteIds,
	})

	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	rollingSeries := psql.Select(
		"code",
		"bucket",
		"AVG(sum) OVER (PARTITION BY emote_id ORDER BY bucket ROWS BETWEEN "+strconv.Itoa(p.RollingAverage)+" PRECEDING AND CURRENT ROW) as sum").
		FromSelect(baseSeries, "series")

	return queryGroupAndSort(rollingSeries, db)

}

// for live view queries
func addFilterCreatedAtSpan(query sq.SelectBuilder, span string) sq.SelectBuilder {
	switch span {
	case "30 minutes":
		query = query.Where("created_at >= now() - interval '30 minutes'")
	case "1 hour":
		query = query.Where("created_at >= now() - interval '1 hour'")
	case "9 hours":
		query = query.Where("created_at >= now() - interval '9 hours'")
	default:
		fmt.Println("unknown span", span)
		query = query.Where("created_at >= now() - interval '1 day'")
	}

	return query
}

func filterBucketByDay(query sq.SelectBuilder, day time.Time) sq.SelectBuilder {
	return query.
		Where(sq.GtOrEq{"bucket": day}).
		Where(sq.Lt{"bucket": day.Add(time.Hour * 24)})
}

// for historical view queries; from our aggregates
func filterBucketBySpan(query sq.SelectBuilder, span string) sq.SelectBuilder {
	switch span {
	case "1 minute":
		return query.Where(statementBuilder().Select("MAX(bucket) - '1 minute'::interval").
			From(minuteViewAggregate).
			Prefix("bucket >= (").
			Suffix(")"))
	case "30 minutes":
		return query.Where(statementBuilder().Select("MAX(bucket) - '30 minutes'::interval").
			From(minuteViewAggregate).
			Prefix("bucket >= (").
			Suffix(")"))
	case "1 hour":
		return query.Where(statementBuilder().Select("MAX(bucket) - '1 hour'::interval").
			From(hourlyViewAggregate).
			Prefix("bucket >= (").
			Suffix(")"))
	case "9 hours":
		return query.Where(statementBuilder().Select("MAX(bucket) - '9 hours'::interval").
			From(hourlyViewAggregate).
			Prefix("bucket >= (").
			Suffix(")"))
	case "1 week":
		return query.Where(statementBuilder().Select("MAX(bucket) - '1 week'::interval").
			From(dailyViewAggregate).
			Prefix("bucket >= (").
			Suffix(")"))
	case "1 month":
		return query.Where(statementBuilder().Select("MAX(bucket) - '1 month'::interval").
			From(dailyViewAggregate).
			Prefix("bucket >= (").
			Suffix(")"))
	case "1 year":
		return query.Where(statementBuilder().Select("MAX(bucket) - '1 year'::interval").
			From(dailyViewAggregate).
			Prefix("bucket >= (").
			Suffix(")"))
	case "all":
		return query
	default:
		panic("unknown span while trying to filter; huma should have caught this: " + span)
	}
}

var groupingToView = map[string]string{
	"second": secondViewAggregate,
	"minute": minuteViewAggregate,
	"hour":   hourlyViewAggregate,
	"day":    dailyViewAggregate,
}

func baseSeriesSelect(p SeriesInputForEmotes) sq.SelectBuilder {
	psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

	series := psql.Select("sum, bucket, emote_id").
		From(groupingToView[p.Grouping])

	if !p.From.IsZero() && !p.To.IsZero() {
		series = series.
			Where(sq.LtOrEq{"bucket": p.To}).
			Where(sq.GtOrEq{"bucket": p.From})
	} else if !p.From.IsZero() {
		series = filterBucketByDay(series, p.From)
	} else if p.Span != "" {
		series = filterBucketBySpan(series, p.Span)
	}

	series = series.Where(sq.Eq{"emote_id": p.EmoteIDs})

	seriesJoin := psql.
		Select("sum", "bucket", "code", "emote_id").
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

	result := make([]TimeSeriesRow, 0, 2000)

	dbError := db.Raw(sql, args...).Scan(&result).Error

	if dbError != nil {
		fmt.Println(dbError)
		return &TimeSeriesOutput{}, dbError
	}

	output := make(map[time.Time]TimeSeries)

	for _, row := range result {
		if _, ok := output[row.Bucket]; !ok {
			output[row.Bucket] = TimeSeries{Time: row.Bucket, Series: make(map[string]float64)}
		}
		output[row.Bucket].Series[row.Code] = row.Sum
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

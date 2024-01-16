package main

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

type ChatCount struct {
	created_at time.Time
	count      int
	clip_id    string
}

type RollingChatCount struct {
	ChatCount
	rolling_sum int
}

func findTopClipsThroughRollingSums(db *gorm.DB, input ClipCountsInput) []RollingChatCount {
	topClips := getTopClips(db, input.Column)
	intervals := makeIntervalsFromRollingSumClips(db, topClips)
	clipsFromLeftSideOfIntervals := make([]RollingChatCount, 0)
	for _, interval := range intervals {
		//TODO: maybe create a wait group and do this in parallel
		clipsFromLeftSideOfIntervals = append(clipsFromLeftSideOfIntervals, getClipBetween(db, interval.Time.Add(-30*time.Second), interval.Time, interval.int))
	}
	return clipsFromLeftSideOfIntervals
}

func getTopClips(db *gorm.DB, emote string) []RollingChatCount {
	var topClips []RollingChatCount
	query := fmt.Sprintf(`
		SELECT SUM(%s OVER (
			ORDER BY created_at
			RANGE BETWEEN INTERVAL '30 seconds' PRECEDING AND CURRENT ROW
		) as rolling_sum, %s as count, clip_id, created_at 
		from chat_counts 
		WHERE clip_id IS NOT NULL
		AND %s IS NOT NULL
		order by rolling_sum desc limit 10000;
	`, emote, emote, emote)
	err := db.Raw(query).Scan(&topClips).Error
	if err != nil {
		fmt.Println(err)
		return nil
	}
	return topClips
}

type Interval struct {
	time.Time
	int
}

// we might have rolling sums that refer to the same bit
// we assume a sorted list, rolling_sum desc, and we remove clips in duplicate intervals
func makeIntervalsFromRollingSumClips(db *gorm.DB, topWindows []RollingChatCount) []Interval {

	discoveredTopIntervals := make([]Interval, 0)
	for _, clip := range topWindows {
		if len(discoveredTopIntervals) == 10 {
			break
		}

		isNewInterval := true
		for _, interval := range discoveredTopIntervals {
			if clip.created_at.Before(interval.Time.Add(30*time.Second)) && clip.created_at.After(interval.Time.Add(-30*time.Second)) {
				isNewInterval = false
				break
			}
		}

		if isNewInterval {
			discoveredTopIntervals = append(discoveredTopIntervals, Interval{clip.created_at, clip.count})
		}

	}
	return discoveredTopIntervals
}

func getClipBetween(db *gorm.DB, from time.Time, to time.Time, sum int) RollingChatCount {
	var clip ChatCount
	err := db.Raw(`
		SELECT clip_id, EXTRACT(epoch from created_at) as time
		FROM chat_counts 
		WHERE created_at BETWEEN $1 AND $2
		ORDER BY created_at ASC
		LIMIT 1`, from, to).Scan(&clip).Error
	if err != nil {
		fmt.Println(err)
		panic(err)
	}
	return RollingChatCount{clip, sum}
}

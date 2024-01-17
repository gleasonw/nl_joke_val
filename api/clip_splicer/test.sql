WITH RollingSums AS (
    SELECT
        created_at,
        SUM(lol) OVER (
            ORDER BY created_at
            RANGE BETWEEN INTERVAL '30 second' PRECEDING AND CURRENT ROW
        ) AS rolling_sum
    FROM
        chat_counts
),
TopWindows AS (
    SELECT
        created_at AS window_end,
        created_at - INTERVAL '30 second' AS window_start,
        rolling_sum
    FROM
        RollingSums
    ORDER BY
        rolling_sum DESC
    LIMIT 10
),
NonOverlappingWindows AS (
    SELECT *,
        ROW_NUMBER() OVER (
            ORDER BY rolling_sum DESC, window_end
        ) AS window_rank,
        COUNT(*) OVER (
            PARTITION BY window_start, window_end
        ) AS overlap_count
    FROM TopWindows
),
FilteredWindows AS (
    SELECT *
    FROM NonOverlappingWindows
    WHERE overlap_count = 1 OR window_rank = 1
),
RankedClips AS (
    SELECT
        YT.*,
        FW.window_end, FW.rolling_sum,
        ROW_NUMBER() OVER (
            PARTITION BY FW.window_end
            ORDER BY FW.rolling_sum DESC
        ) AS rank
    FROM
        FilteredWindows FW
    JOIN
        chat_counts YT ON YT.created_at BETWEEN FW.window_start AND FW.window_end
)
SELECT *
FROM RankedClips
WHERE rank = 1
ORDER BY rolling_sum DESC, window_end;

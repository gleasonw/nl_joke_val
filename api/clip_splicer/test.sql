WITH RollingSums AS (
    SELECT
        created_at,
        SUM(two) OVER (
            ORDER BY created_at
            RANGE BETWEEN INTERVAL '30 seconds' PRECEDING AND CURRENT ROW
        ) AS rolling_sum
    FROM
        chat_counts
),
TopWindows AS (
    SELECT
        created_at AS window_end,
        created_at - INTERVAL '30 seconds' AS window_start,
        rolling_sum
    FROM
        RollingSums
    ORDER BY
        rolling_sum DESC
),
NonOverlappingWindows AS (
    SELECT *,
        LAG(window_end) OVER (ORDER BY rolling_sum desc, window_end) AS prev_window_end
    FROM TopWindows
),
FilteredWindows AS (
    SELECT *
    FROM NonOverlappingWindows
    WHERE NOT (window_end, window_start) OVERLAPS (prev_window_end - INTERVAL '2 minutes', prev_window_end + INTERVAL '2 minutes')
    LIMIT 10
),
RankedClips AS (
    SELECT
        YT.*,
        FW.window_end, FW.rolling_sum,
        ROW_NUMBER() OVER (
            PARTITION BY FW.window_end
            ORDER BY YT.created_at DESC
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

WITH RollingSums AS (
  SELECT
    created_at,
    SUM(lol) OVER (                                                   
      ORDER BY created_at                                                                     
      RANGE BETWEEN INTERVAL '20 seconds' PRECEDING AND CURRENT ROW
    ) AS rolling_sum
  FROM
    chat_counts
  ORDER BY
    rolling_sum DESC
  LIMIT 1000
),
RankedIntervals AS (
  SELECT
    created_at,
    rolling_sum,
    ROW_NUMBER() OVER (ORDER BY rolling_sum DESC, created_at DESC) AS rn
  FROM
    RollingSums
),
FilteredIntervals AS (
  SELECT
    r1.created_at AS max_created_at,
    r1.rolling_sum
  FROM
    RankedIntervals r1
  WHERE
    NOT EXISTS (
      SELECT 1
      FROM RankedIntervals r2
      WHERE
        r2.rn < r1.rn
        AND r2.created_at >= r1.created_at - INTERVAL '5 minutes'
        AND r2.created_at <= r1.created_at + INTERVAL '5 minutes'
    )
  LIMIT 50
)
  SELECT
    fi.max_created_at,
    fi.rolling_sum,
    cc.created_at AS closest_created_at,
    cc.clip_id,
    cc.lol
  FROM
    FilteredIntervals fi
  JOIN
    chat_counts cc
  ON
    cc.created_at = (
      SELECT created_at
      FROM chat_counts
      WHERE created_at BETWEEN fi.max_created_at - INTERVAL '22 seconds' AND fi.max_created_at + INTERVAL '1 second'
      ORDER BY lol DESC
      LIMIT 1
    );
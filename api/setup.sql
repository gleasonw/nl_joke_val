SELECT create_hypertable('emote_counts', 'created_at') IF NOT EXISTS;


CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sum
WITH (timescaledb.continuous) AS
SELECT emote_id, 
       sum(count) as day_sum, 
       time_bucket('1 day', created_at) as day_time
FROM emote_counts
GROUP BY 1, 3;

CREATE MATERIALIZED VIEW avg_daily_sum_three_months
WITH (timescaledb.continuous) AS 
SELECT time_bucket('3 months'::interval, date) as date, 
       avg(day_sum) as average, 
       emote_id
FROM daily_sum
GROUP BY 1, 3;

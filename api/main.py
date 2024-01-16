from contextlib import asynccontextmanager
import datetime
from typing import List, Literal

import api.clip_splicer.builder as clip_builder
from api.clip_splicer.builder import (
    RollingChatCount,
    get_top_clips,
    make_intervals_from_rolling_sums,
    fetch_clip_data,
    get_clip_between,
)
from psycopg import AsyncConnection
from psycopg.rows import class_row
import fastapi
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import class_row

load_dotenv()


app = fastapi.FastAPI()

database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise ValueError("DATABASE_URL not set")

pool = AsyncConnectionPool(
    database_url,
    open=False,
)


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    await pool.open()
    yield

    await pool.close()


# cors

span_type = Literal["day", "week", "month", "all"]
grouping_type = Literal["second", "minute", "week", "day", "month", "all"]
emote_type = Literal[
    "classic",
    "monka_giga",
    "two",
    "lol",
    "cereal",
    "monkas",
    "joel",
    "pog",
    "huh",
    "no",
    "cocka",
    "who_asked",
    "shock",
    "copium",
    "ratjam",
    "sure",
]


@app.get("/api/get_series")
async def get_series(
    span: span_type = "day",
    grouping: grouping_type = "minute",
    rolling_average: int = 0,
    start: datetime.datetime | None = None,
    end: datetime.datetime | None = None,
):
    pass


@app.get("/api/get_clips")
async def get_clips(
    emote: emote_type = "two",
    span: span_type = "day",
    sum_window: grouping_type = "minute",
    order: Literal["asc", "desc"] = "desc",
    limit: int = 10,
    cursor: int | None = None,
) -> List[RollingChatCount]:
    async with pool.connection() as conn:
        top_clips = await get_top_clips(
            conn,
            emote,
            span,
            sum_window,
            order,
            limit,
            cursor,
        )
        intervals = make_intervals_from_rolling_sums(
            top_clips,
        )
        left_shifted_clips: List[RollingChatCount] = []
        for interval in intervals:
            end, sum = interval
            left_shifted_clips.append(
                await get_clip_between(
                    conn,
                    end,
                    end,
                    sum,
                )
            )
        return left_shifted_clips


@app.get("/api/get_nearest_clip")
async def get_nearest_clip(
    epoch_time: int,
) -> RollingChatCount:
    time_from_epoch = datetime.datetime.fromtimestamp(epoch_time)

    # twitch clips record about 20 seconds before clip captured
    # should be a good context window

    async with pool.connection() as conn:
        return await get_clip_between(
            conn,
            time_from_epoch + datetime.timedelta(seconds=10),
            time_from_epoch + datetime.timedelta(minutes=20),
            0,
        )

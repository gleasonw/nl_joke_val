import asyncio
from contextlib import asynccontextmanager
import datetime
from typing import List, Literal

import clip_splicer.builder as clip_builder
from clip_splicer.builder import (
    GROUPING_TYPE,
    SPAN_TYPE,
    RollingChatCount,
    RollingChatCountWithThumbnail,
    get_clips_from_intervals,
    get_top_clips,
    make_intervals_from_rolling_sums,
    fetch_clip_data,
    get_clip_between,
    get_batched_twitch_clips,
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


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    await pool.open()
    yield

    await pool.close()


app = fastapi.FastAPI(lifespan=lifespan)
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise ValueError("DATABASE_URL not set")

pool = AsyncConnectionPool(
    database_url,
    open=False,
)

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


@app.get("/clips")
async def get_clips(
    emote: emote_type = "two",
    span: SPAN_TYPE = "1 day",
    sum_window: GROUPING_TYPE = "1 minute",
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
        )
        # TODO: ideally we could do this in SQL, but my wizardry is not yet that advanced
        intervals = make_intervals_from_rolling_sums(top_clips, limit, cursor)
        tasks = []
        async with asyncio.TaskGroup() as group:
            for interval in intervals:
                start, sum = interval
                tasks.append(
                    group.create_task(
                        get_clip_between(
                            conn,
                            start - datetime.timedelta(seconds=20),
                            start + datetime.timedelta(seconds=10),
                            sum,
                        )
                    )
                )
        return [task.result() for task in tasks if task.result()]


@app.get("/nearest_clip")
async def get_nearest_clip(
    epoch_time: int,
) -> RollingChatCount | None:
    time_from_epoch = datetime.datetime.fromtimestamp(epoch_time)

    # twitch clips record about 20 seconds before clip captured
    # should be a good context window

    async with pool.connection() as conn:
        return await get_clip_between(
            conn,
            time_from_epoch + datetime.timedelta(seconds=10),
            time_from_epoch + datetime.timedelta(seconds=20),
            0,
        )

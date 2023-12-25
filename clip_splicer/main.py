import math
import random
from typing import Annotated, Any, List, Literal, Optional, Dict, Sequence, Tuple, Set
from dotenv import load_dotenv
import os
from psycopg import AsyncConnection
from psycopg.rows import class_row
from pydantic import BaseModel, NaiveDatetime
from datetime import datetime, timedelta
import asyncio
import aiohttp
from moviepy.editor import (
    VideoFileClip,
    concatenate_videoclips,
)
import json

os.environ["IMAGEMAGICK_BINARY"] = "/usr/bin/convert"

load_dotenv()

BIT_WINDOW_SECONDS = 120
TOTAL_CLIPS = 15

# change the model as well
EMOTE = "ratjam"


class ChatCount(BaseModel):
    created_at: datetime
    ratjam: int
    clip_id: str | None


database_url = os.getenv("DATABASE_URL")
if database_url is None:
    raise Exception("DATABASE_URL not found")


class Clip(BaseModel):
    id: str
    url: str
    embed_url: str
    broadcaster_id: str
    broadcaster_name: str
    creator_id: str
    creator_name: str
    video_id: str
    game_id: str
    language: str
    title: str
    view_count: int
    created_at: datetime
    duration: float
    thumbnail_url: str
    vod_offset: int | None


class RollingChatCount(ChatCount):
    rolling_sum: int


class ClipWithTwitchData(ChatCount):
    clip: Clip


def main():
    # start an event loop
    asyncio.run(build_compilation())


missing_clips = set()


async def build_compilation():
    await create_video_no_intervals()


def merge_clips_from_json():
    clips = load_clips_from_json_file()
    merge_clips(clips)


async def download_and_merge_clips_from_json():
    clips = load_clips_from_json_file()
    await download_all_clips(clips)
    merge_clips(clips)


async def download_and_merge_clips():
    clips = await find_clips()
    await download_all_clips(clips)
    merge_clips(clips)


def merge_clips(clips: List[List[ClipWithTwitchData]]):
    reversed_clip_batches = clips[::-1]
    video_clips = []
    for batch in reversed_clip_batches:
        video_clips.extend(create_video_from_batch(batch))
    final_clip = concatenate_videoclips(video_clips)
    final_clip.write_videofile(
        f"{EMOTE} {TOTAL_CLIPS}.mp4", codec="libx264", audio_codec="aac"
    )


async def create_video_no_intervals():
    twitch_clips = await find_clips_single_moment()
    async with aiohttp.ClientSession(headers=headers) as session:
        await download_batch(twitch_clips, session)
    video_clips = create_video_from_batch_no_overlap(twitch_clips)

    # reverse the clips to build to top moment
    final_clip = concatenate_videoclips(video_clips[::-1])

    final_clip.write_videofile(
        f"{EMOTE} {TOTAL_CLIPS}.mp4", codec="libx264", audio_codec="aac"
    )


def create_video_from_batch_no_overlap(clip_batch: List[ClipWithTwitchData]):
    video_clips: List[VideoFileClip] = []
    for clip in clip_batch:
        try:
            video_clips.append(VideoFileClip(f"clips/{clip.clip_id}.mp4"))
        except Exception as e:
            print(e)
            continue
    return video_clips


def create_video_from_batch(clip_batch: List[ClipWithTwitchData]):
    video_clips: List[VideoFileClip] = []
    for i in range(len(clip_batch)):
        try:
            current_clip = clip_batch[i]
            if i == len(clip_batch) - 1:
                video_clips.append(VideoFileClip(f"clips/{current_clip.clip.id}.mp4"))
                break
            next_clip = clip_batch[i + 1]
            overlap_time = get_overlap_seconds(current_clip, next_clip)
            if overlap_time > 0:
                clip = VideoFileClip(f"clips/{current_clip.clip.id}.mp4")
                video_clips.append(clip.subclip(0, -overlap_time))
            else:
                video_clips.append(
                    VideoFileClip(f"clips/{current_clip.clip.id}.mp4").subclip(0, -0.6)
                )
        except Exception as e:
            print(e)
            continue
    return video_clips


def get_overlap_seconds(
    current_clip: ClipWithTwitchData, next_clip: ClipWithTwitchData
) -> float:
    if current_clip.clip.vod_offset and next_clip.clip.vod_offset:
        return (
            current_clip.clip.vod_offset
            + current_clip.clip.duration
            - next_clip.clip.vod_offset
        )
    return (
        current_clip.clip.created_at
        + timedelta(seconds=current_clip.clip.duration)
        - next_clip.clip.created_at
    ).total_seconds()


headers = {
    "Client-ID": "",
    "Authorization": "Bearer",
}


def load_clips_from_json_file() -> List[List[ClipWithTwitchData]]:
    with open("clips.json", "r") as f:
        clip_ids = json.load(f)
        return [
            [
                ClipWithTwitchData.model_validate_json(clip_json)
                for clip_json in clip_batch
            ]
            for clip_batch in clip_ids
            if len(clip_batch) > 0
        ]


async def download_all_clips(clips: List[List[ClipWithTwitchData]]):
    async with aiohttp.ClientSession(headers=headers) as session:
        for i in range(len(clips)):
            clip_batch = clips[i]
            await download_batch(clip_batch, session)
            print(f"Batch {i+1} of {len(clips)} downloaded")


async def download_batch(
    clip_batch: List[ClipWithTwitchData], session: aiohttp.ClientSession
):
    async with asyncio.TaskGroup() as group:
        for clip in clip_batch:
            group.create_task(download_clip(clip, session))


async def download_clip(clip: ClipWithTwitchData, session: aiohttp.ClientSession):
    download_url = clip.clip.thumbnail_url.replace("-preview-480x272.jpg", ".mp4")
    max_retries = 2
    retries = 0
    backoff = (2, 8)
    while retries < max_retries:
        try:
            async with session.get(download_url) as resp:
                if resp.status == 200:
                    with open(f"clips/{clip.clip.id}.mp4", "wb") as f:
                        f.write(await resp.read())
                        return
                else:
                    print(resp.status)
                    await asyncio.sleep(backoff[retries])
                    retries += 1
                    continue
        except Exception as e:
            print(e)
            await asyncio.sleep(backoff[retries])
            retries += 1
            continue
    if retries >= max_retries:
        print("Max retries exceeded")


async def fetch_clip_data(clip: ChatCount, session: aiohttp.ClientSession):
    clip_id = clip.clip_id
    try:
        async with session.get(
            f"https://api.twitch.tv/helix/clips?id={clip_id}"
        ) as resp:
            if resp.status == 200:
                data = (await resp.json())["data"]
                if len(data) == 0:
                    missing_clips.add(clip_id)
                    return
                twitch_clip = Clip.model_validate((await resp.json())["data"][0])
                return ClipWithTwitchData(**clip.model_dump(), clip=twitch_clip)

            else:
                print(resp.status)
                print(resp.headers.get("ratelimit-reset"))
                await asyncio.sleep(random.randint(1, 5))
    except Exception as e:
        print(e)
        missing_clips.add(clip_id)
        return


async def find_clips_and_write_to_json():
    clips_with_twitch_data = await find_clips()
    with open("clips.json", "w") as f:
        serialized_clips = [
            [clip.model_dump_json() for clip in clips if clip]
            for clips in clips_with_twitch_data
        ]
        json.dump(serialized_clips, f)


async def find_clips_single_moment() -> List[ClipWithTwitchData]:
    async with aiohttp.ClientSession(headers=headers) as session:
        async with await AsyncConnection.connect(database_url) as aconn:
            top_clips = await get_top_clips(aconn)
            intervals = make_intervals_from_rolling_sums(top_clips)
            left_shifted_clips = []
            for interval in intervals:
                end, sum = interval
                left_shifted_clips.append(
                    await get_clip_between(
                        aconn,
                        end - timedelta(seconds=20),
                        end,
                        sum,
                    )
                )
            async with asyncio.TaskGroup() as group:
                results = [
                    group.create_task(fetch_clip_data(clip, session))
                    for clip in left_shifted_clips
                ]
            return [task.result() for task in results if task.result()]


async def find_clips() -> List[List[ClipWithTwitchData]]:
    async with aiohttp.ClientSession(headers=headers) as session:
        async with await AsyncConnection.connect(database_url) as aconn:
            top_intervals = await get_top_intervals(aconn)
            top_clips_from_intervals = await get_clips_from_intervals(
                aconn, top_intervals
            )
            return [
                [
                    clip
                    for clip in await get_batched_twitch_clips(clip_batch, session)
                    if clip
                ]
                for clip_batch in top_clips_from_intervals
            ]


async def get_batched_twitch_clips(
    clips: Sequence[ChatCount], session: aiohttp.ClientSession
):
    async with asyncio.TaskGroup() as group:
        clip_tasks = [
            group.create_task(fetch_clip_data(clip, session)) for clip in clips
        ]
    return [task.result() for task in clip_tasks]


async def get_top_clips(conn: AsyncConnection) -> List[RollingChatCount]:
    async with conn.cursor(row_factory=class_row(RollingChatCount)) as cur:
        query = f"""
            SELECT SUM({EMOTE}) OVER (
                    ORDER BY created_at
                    RANGE BETWEEN INTERVAL '30 seconds' PRECEDING AND CURRENT ROW
                ) as rolling_sum, {EMOTE}, clip_id, created_at 
                from chat_counts 
                WHERE clip_id IS NOT NULL
                AND {EMOTE} IS NOT NULL
                order by rolling_sum desc limit 10000;
            """
        await cur.execute(query)
        return await cur.fetchall()


async def get_top_intervals(conn: AsyncConnection):
    async with conn.cursor(row_factory=class_row(RollingChatCount)) as cur:
        await cur.execute(
            f"""
            WITH TimeBasedRollingSums AS (
                SELECT 
                    created_at, 
                    {EMOTE}, clip_id,
                    SUM({EMOTE}) OVER (
                        ORDER BY created_at 
                        RANGE BETWEEN INTERVAL '{BIT_WINDOW_SECONDS} seconds' PRECEDING AND CURRENT ROW
                    ) AS rolling_sum
                FROM 
                    chat_counts
            )
            select * from TimeBasedRollingSums order by rolling_sum desc limit 1000;
            """
        )
        top_windows = await cur.fetchall()
        return make_intervals_from_rolling_sums(top_windows)


def make_intervals_from_rolling_sums(
    top_windows: List[RollingChatCount],
) -> List[Tuple[datetime, int]]:
    discovered_top_intervals: List[Tuple[datetime, int]] = []
    for count in top_windows:
        if len(discovered_top_intervals) == TOTAL_CLIPS:
            break

        is_new_window = True
        for interval in discovered_top_intervals:
            start, _ = interval
            if count.created_at < start + 2 * timedelta(
                seconds=BIT_WINDOW_SECONDS
            ) and count.created_at > start - 2 * timedelta(seconds=BIT_WINDOW_SECONDS):
                is_new_window = False
                break

        if is_new_window:
            discovered_top_intervals.append(
                (
                    count.created_at,
                    count.rolling_sum,
                )
            )
    return discovered_top_intervals


async def get_clips_from_intervals(
    conn: AsyncConnection, intervals: List[Tuple[datetime, int]]
) -> List[List[RollingChatCount]]:
    clips = []
    for interval in intervals:
        end, sum = interval
        clip_batch = []
        async with asyncio.TaskGroup() as group:
            start = end - timedelta(seconds=BIT_WINDOW_SECONDS)
            for i in range(0, BIT_WINDOW_SECONDS + 30, 30):
                clip_batch.append(
                    group.create_task(
                        get_clip_between(
                            conn,
                            start + timedelta(seconds=i - 10),
                            start + timedelta(seconds=i),
                            sum,
                        )
                    )
                )
        clips.append([task.result() for task in clip_batch if task.result()])
    return clips


async def get_clip_between(
    conn: AsyncConnection, start: datetime, end: datetime, sum: int
) -> Optional[RollingChatCount]:
    async with conn.cursor(row_factory=class_row(ChatCount)) as cur:
        await cur.execute(
            """
            SELECT * FROM chat_counts
            WHERE created_at BETWEEN %s AND %s
            ORDER BY created_at ASC
            LIMIT 1;
            """,
            (start, end),
        )
        clip = await cur.fetchone()
        if clip is not None:
            return RollingChatCount(**clip.model_dump(), rolling_sum=sum)
        return None


main()

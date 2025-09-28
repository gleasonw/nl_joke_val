from typing import Annotated, Any, List, Literal, Optional, Dict, Sequence, Tuple, Set
from dotenv import load_dotenv
import os
from psycopg import AsyncConnection
from psycopg.rows import class_row
from pydantic import BaseModel
from datetime import datetime, timedelta
import asyncio
import aiohttp
from moviepy import (
    VideoFileClip,
    concatenate_videoclips,
    ColorClip,
    TextClip,
    CompositeVideoClip,
)
from twitch import download_clip, refresh_twitch_token, twitch_get
import json

os.environ["IMAGEMAGICK_BINARY"] = "/usr/bin/convert"
SPAN_TYPE = Literal["1 minute", "9 hours", "1 day", "1 week", "1 month", "1 year"]
GROUPING_TYPE = Literal[
    "second",
    "30 seconds",
    "1 minute",
    "1 hour",
    "1 week",
    "1 day",
    "1 month",
    "1 year",
]

load_dotenv()

BIT_WINDOW_SECONDS = 120
TOTAL_CLIPS = 50
SPAN="1 year"

# change the model as well
EMOTE = "ICANT"


class ChatCount(BaseModel):
    created_at: datetime
    count: int
    clip_id: str | None


class ChatCountWithThumbnail(ChatCount):
    thumbnail: str | None


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


class RollingChatCountWithThumbnail(RollingChatCount):
    thumbnail: str | None


class ClipWithTwitchData(RollingChatCount):
    clip: Clip


def main():
    # start an event loop
    print('hello')
    asyncio.run(build_compilation())


missing_clips = set()


async def build_compilation():
    raw_twitch_clips = await find_clip_pairs(SPAN)
    # filter out any clip pairs with a null clip. need to just find a new section, but for now let's just ignore it
    twitch_clips = [pair for pair in raw_twitch_clips if len(pair) == 2 and pair[0] and pair[1]]
    print(f"Found {len(twitch_clips)} clip pairs, here's the first 5:")
    for clip in twitch_clips[:5]:
        print(f"first clip: {clip[0].clip.id}, second clip: {clip[1].clip.id}")
    # await download_all_clips(twitch_clips)
    merge_clips(twitch_clips)


def merge_clips(clips: List[List[ClipWithTwitchData]]):
    reversed_clip_batches = clips[::-1]
    video_clips = []
    for i in range(len(reversed_clip_batches)):
        batch = reversed_clip_batches[i]
        video_clips.extend(create_video_from_batch(batch, i + 1))
    final_clip = concatenate_videoclips(video_clips)
    final_clip.write_videofile(
	f"{EMOTE}_top_{TOTAL_CLIPS}_{SPAN}.mp4",
	codec="h264_videotoolbox",   # macOS HW encoder
	audio_codec="aac",
	bitrate="8M",                 # set a target; HW enc ignores CRF/preset knobs
	ffmpeg_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart"]
	# threads doesn’t matter for h264_videotoolbox
)


def create_video_from_batch_no_overlap(clip_batch: List[ClipWithTwitchData]):
    video_clips: List[CompositeVideoClip | VideoFileClip] = []
    for i in range(len(clip_batch)):
        clip = clip_batch[i]
        try:
            video_clip = VideoFileClip(f"clips/{clip.clip.id}.mp4")
            bg_clip = get_clip_title_text(clip, i + 1)

            # order will be reversed
            video_clips.append(video_clip)
            video_clips.append(bg_clip)
        except Exception as e:
            print(e)
            continue
    return video_clips[::-1]


def get_clip_title_text(clip: ClipWithTwitchData, place: int):
    text = TextClip(
        text=f"""

{clip.created_at.date()}

{clip.rolling_sum} {EMOTE}s
""",
        font="/Library/Fonts/Arial.ttf",
        font_size=80,
        color="white",
    )
    bg = ColorClip(size=(1920, 1080), color=(0, 0, 0))
    return CompositeVideoClip([bg, text]).with_duration(5)


def create_video_from_batch(clip_batch: List[ClipWithTwitchData], place: int):
    video_clips: List[VideoFileClip] = [
        get_clip_title_text(clip_batch[0], place),
    ]
    for i in range(len(clip_batch)):
        try:
            current_clip = clip_batch[i]
            if i == len(clip_batch) - 1:
                video_clips.append(VideoFileClip(f"clips/{current_clip.clip.id}.mp4"))
                break
            next_clip = clip_batch[i + 1]
            overlap_time = get_overlap_seconds(current_clip, next_clip)
            print(overlap_time)
            if overlap_time > 0:
                clip = VideoFileClip(f"clips/{current_clip.clip.id}.mp4")
                video_clips.append(clip.subclipped(0, -overlap_time))
            else:
                video_clips.append(
                    VideoFileClip(f"clips/{current_clip.clip.id}.mp4").subclipped(0, -0.6)
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
    "Client-ID": os.getenv("TWITCH_CLIENT_ID") or "",
    "Authorization": f"Bearer {os.getenv('TWITCH_OAUTH_TOKEN') or ''}",
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
            group.create_task(download_clip(clip_id=clip.clip_id, file_path=f"clips/{clip.clip_id}.mp4"))


async def fetch_clip_data(clip: ChatCount, session: aiohttp.ClientSession):
    clip_id = clip.clip_id
    async with await twitch_get(url=f"https://api.twitch.tv/helix/clips?id={clip_id}", session=session) as resp:
        if resp.status == 200:
            try:
                twitch_clip = Clip.model_validate((await resp.json())["data"][0])
                return ClipWithTwitchData(**clip.model_dump(), clip=twitch_clip)
            except Exception as e:
                print(f"Error parsing clip data for {clip_id}: {e}")
                print(await resp.json())
        else:
            print(resp.status)
            print(resp.headers.get("ratelimit-reset"))
            raise Exception("Error fetching clip data from twitch", clip_id)


async def find_clips_and_write_to_json():
    clips_with_twitch_data = await find_clips()
    with open("clips.json", "w") as f:
        serialized_clips = [
            [clip.model_dump_json() for clip in clips if clip]
            for clips in clips_with_twitch_data
        ]
        json.dump(serialized_clips, f)


async def find_clip_pairs(span: SPAN_TYPE) -> List[List[ClipWithTwitchData]]:
    async with aiohttp.ClientSession() as session:
        async with await AsyncConnection.connect(database_url) as aconn:
            top_clips = await get_top_clips(aconn, span=span)
            print(f"Found {len(top_clips)} top clips, here's the first 5:")
            for clip in top_clips[:5]:
                print(f" - {clip.clip_id}: {clip.count}")
            intervals = make_intervals_from_rolling_sums(top_clips)
            left_shifted_clips: List[List[RollingChatCount]] = []
            for interval in intervals:
                end, sum_count = interval
                first_30 = await get_clip_between(
                    aconn,
                    end - timedelta(seconds=30),
                    end,
                    sum_count,
                )
                last_30 = await get_clip_between(
                    aconn,
                    end,
                    end,
                    sum_count,
                )
                if first_30 is None or last_30 is None:
                    continue
                left_shifted_clips.append([first_30, last_30])
            async with asyncio.TaskGroup() as group:
                results = [
                    group.create_task(get_batched_twitch_clips(clip, session))
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
    await refresh_twitch_token(session)
    async with asyncio.TaskGroup() as group:
        clip_tasks = [
            group.create_task(fetch_clip_data(clip, session)) for clip in clips
        ]
    return [task.result() for task in clip_tasks]


async def get_top_clips(
    conn: AsyncConnection,
    emote: str | None = EMOTE,
    span: SPAN_TYPE | None = "9 hours",
    sum_window: GROUPING_TYPE | None = "second",
    order: Literal["asc", "desc"] | None = "desc",
) -> List[RollingChatCount]:
    emote_to_query = emote or EMOTE
    if sum_window == "second":
        sum_window = "30 seconds"
    async with conn.cursor(row_factory=class_row(RollingChatCount)) as cur:
        query = f"""
            SELECT SUM(emote_counts.count) OVER (
                    ORDER BY emote_counts.created_at
                    RANGE BETWEEN INTERVAL '{sum_window}' PRECEDING AND CURRENT ROW
                ) as rolling_sum, emote_counts.count, emote_counts.clip_id, emote_counts.created_at
                FROM emote_counts
                WHERE emote_counts.clip_id IS NOT NULL
                AND emote_counts.clip_id != ''
                AND emote_counts.emote_id = (SELECT id FROM emotes WHERE code = '{emote_to_query}')
                AND created_at > (
                    SELECT MAX(created_at)
                    FROM emote_counts
                ) - INTERVAL '{span}'
                AND count IS NOT NULL
                ORDER BY rolling_sum {order} limit 10000;
            """
        await cur.execute(query)
        return await cur.fetchall()


async def get_top_intervals(conn: AsyncConnection):
    async with conn.cursor(row_factory=class_row(RollingChatCount)) as cur:
        query = f"""
            WITH TimeBasedRollingSums AS (
                SELECT created_at, {EMOTE}, clip_id,
                    SUM({EMOTE}) OVER (
                        ORDER BY created_at
                        RANGE BETWEEN INTERVAL '{BIT_WINDOW_SECONDS} seconds' PRECEDING AND CURRENT ROW
                    ) AS rolling_sum
                FROM chat_counts
            )
            select * from TimeBasedRollingSums order by rolling_sum desc limit 1000;
            """
        await cur.execute(query)
        top_windows = await cur.fetchall()
        return make_intervals_from_rolling_sums(top_windows)


def grouping_type_to_seconds(grouping: GROUPING_TYPE) -> int:
    match grouping:
        case "second":
            return 1
        case "1 minute":
            return 60
        case "1 hour":
            return 60 * 60
        case "1 day":
            return 60 * 60 * 24
        case "1 week":
            return 60 * 60 * 24 * 7
        case "1 month":
            return 60 * 60 * 24 * 30
        case "1 year":
            return 60 * 60 * 24 * 365
        case "30 seconds":
            return 30


def make_intervals_from_rolling_sums(
    top_windows: List[RollingChatCount],
    limit: int = TOTAL_CLIPS,
    cursor: int | None = None,
    sum_window: GROUPING_TYPE | None = None,
) -> List[Tuple[datetime, int]]:
    discovered_top_intervals: List[Tuple[datetime, int]] = []
    window_seconds = grouping_type_to_seconds(sum_window or "1 minute")
    print(f"Using window of {window_seconds} seconds")

    for count in top_windows:
        if len(discovered_top_intervals) >= limit:
            break
        is_new_window = True
        for interval in discovered_top_intervals:
            start, _ = interval
            if count.created_at < start + 2 * timedelta(
                seconds=window_seconds
            ) and count.created_at > start - 2 * timedelta(seconds=window_seconds):
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
    conn: AsyncConnection,
    intervals: List[Tuple[datetime, int]],
    sum_window: GROUPING_TYPE | None = None,
) -> List[List[RollingChatCount]]:
    clips = []
    window_seconds = grouping_type_to_seconds(sum_window or "minute")
    for interval in intervals:
        end, sum = interval
        clip_batch = []
        async with asyncio.TaskGroup() as group:
            start = end - timedelta(seconds=window_seconds)
            for i in range(0, window_seconds + 30, 30):
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
) -> RollingChatCount | None:
    async with conn.cursor(row_factory=class_row(ChatCountWithThumbnail)) as cur:
        await cur.execute(
            """
            SELECT emote_counts.clip_id, emote_counts.created_at, fetched_clips.thumbnail, emote_counts.count
            FROM emote_counts JOIN fetched_clips on emote_counts.clip_id = fetched_clips.clip_id
            WHERE emote_counts.created_at BETWEEN %s AND %s
            AND emote_counts.clip_id IS NOT NULL
            AND emote_counts.clip_id != ''
            ORDER BY emote_counts.created_at ASC
            LIMIT 1;
            """,
            (start, end),
        )
        clip = await cur.fetchone()
        if clip is None:
            return None
        return RollingChatCountWithThumbnail(**clip.model_dump(), rolling_sum=sum)

main()
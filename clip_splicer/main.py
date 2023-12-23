from typing import Annotated, Any, List, Literal, Optional, Dict, Tuple, Set
from dotenv import load_dotenv
import os
from psycopg import AsyncConnection
from psycopg.rows import class_row
from pydantic import BaseModel, NaiveDatetime
from datetime import datetime
import asyncio

load_dotenv()

database_url = os.getenv("DATABASE_URL")
if database_url is None:
    raise Exception("DATABASE_URL not found")


def main():
    # start an event loop
    asyncio.run(create_vid())


def select_interval(id: str, start: str, end: str, prior: bool = False):
    val = f"""
    SELECT *
    FROM chat_counts
    WHERE created_at BETWEEN (
        SELECT created_at
        FROM chat_counts
        WHERE clip_id = '{id}'
    ) {"-" if prior else "+"} INTERVAL '{start} seconds'
    AND (
        SELECT created_at
        FROM chat_counts
        WHERE clip_id = '{id}'
    ) {"-" if prior else "+"} INTERVAL '{end} seconds'
    ORDER BY created_at {"ASC" if prior else "DESC"}
    LIMIT 1
    """
    return val


async def get_boundary_clips(id: str, conn: AsyncConnection):
    async with conn.cursor() as cur:
        await cur.execute(select_interval(id, "60", "55", prior=True))
        l1 = await cur.fetchall()
        await cur.execute(select_interval(id, "30", "25", prior=True))
        l2 = await cur.fetchall()
        await cur.execute(select_interval(id, "25", "30"))
        l3 = await cur.fetchall()
        await cur.execute(select_interval(id, "55", "60"))
        l4 = await cur.fetchall()
        return l1, l2, l3, l4


async def create_vid():
    async with await AsyncConnection.connect(database_url) as aconn:
        result = await get_boundary_clips(
            "AbstemiousBrightSeahorseResidentSleeper-zNmUDOMJHLZtXF4S", aconn
        )
        for res in result:
            print(res)


main()

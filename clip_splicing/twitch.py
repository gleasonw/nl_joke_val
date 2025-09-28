from typing import Dict
import aiohttp
import os
from yt_dlp import YoutubeDL

TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'

def twitch_headers() -> Dict[str, str]:
	return {
		'Client-ID': os.getenv('TWITCH_CLIENT_ID') or '',
		'Authorization': f"Bearer {os.getenv('TWITCH_OAUTH_TOKEN') or ''}",
	}

async def refresh_twitch_token(session: aiohttp.ClientSession) -> str:
	print("Refreshing Twitch token...")
	refresh_token = os.getenv('TWITCH_REFRESH_TOKEN') or ''
	client_id = os.getenv('TWITCH_CLIENT_ID') or ''
	client_secret = os.getenv('TWITCH_CLIENT_SECRET') or ''
	if not (refresh_token and client_id and client_secret):
		raise RuntimeError('Missing TWITCH_REFRESH_TOKEN / TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET')

	payload = {
		'grant_type': 'refresh_token',
		'refresh_token': refresh_token,
		'client_id': client_id,
		'client_secret': client_secret,
	}
	async with session.post(TWITCH_TOKEN_URL, data=payload) as resp:
		data = await resp.json()
		if resp.status != 200:
			raise RuntimeError(f"Failed to refresh token ({resp.status}): {data}")

		new_access = data['access_token']
		new_refresh = data.get('refresh_token')  # Twitch may rotate this
		os.environ['TWITCH_OAUTH_TOKEN'] = new_access
		print(f"New access token: {new_access}")
		if new_refresh:
			os.environ['TWITCH_REFRESH_TOKEN'] = new_refresh
		return new_access

async def twitch_get(session: aiohttp.ClientSession, url: str, *, attempt: int = 0) -> aiohttp.ClientResponse:
	print(f"GET {url} with headers {twitch_headers()}")
	resp = await session.get(url, headers=twitch_headers())
	if resp.status == 401 and attempt == 0:
		# Token likely expired; refresh and retry once
		await resp.release()
		await refresh_twitch_token(session)
		return await twitch_get(session, url, attempt=1)
	return resp


async def download_clip(clip_id: str, file_path: str) -> str:
	clip_url = f'https://clips.twitch.tv/{clip_id}'
	ydl_opts = {
		'outtmpl': file_path,
		'quiet': True,
		'no_warnings': True,
	}
	with YoutubeDL(ydl_opts) as ydl:
		info = ydl.extract_info(clip_url, download=True)
		return ydl.prepare_filename(info)
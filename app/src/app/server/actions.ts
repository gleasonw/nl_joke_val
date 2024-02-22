"use server";

import { ClipParams, SeriesParams } from "@/app/types";
import { GET } from "@/app/utils";
import { unstable_noStore } from "next/cache";

export async function getLiveStatus() {
  unstable_noStore();
  const response = await GET("/api/is_live");

  if (response.error) {
    console.error("Failed to fetch live status");
    return false;
  }

  return response.data;
}

export async function getSeries(params: SeriesParams) {
  unstable_noStore();
  const result = await GET("/api/series", {
    params: {
      query: params,
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch series");
  }

  return result.data;
}

export async function getClips(params: ClipParams) {
  unstable_noStore();
  const result = await GET("/api/clip_counts", {
    params: {
      query: params,
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch clips");
  }

  return result.data;
}

export async function getClipAtTime(params: { time?: number }) {
  unstable_noStore();
  const result = await GET("/api/clip", {
    params: {
      query: params,
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch clip at time");
  }

  return result.data;
}

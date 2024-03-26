import {
  ClipParams,
  EmoteDensityParams,
  EmotePerformanceParams,
  LatestEmotePerformanceParams,
  SeriesParams,
} from "./types";
import { GET } from "./utils";

export async function getLiveStatus() {
  const response = await GET("/api/is_live");

  if (response.error) {
    console.error("Failed to fetch live status");
    return false;
  }

  return response.data;
}

export async function getEmoteDensity(p: EmoteDensityParams) {
  const result = await GET("/api/emote_density", {
    params: {
      query: p,
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch emote density");
  }

  return result.data;
}

export async function getEmoteAveragePerformance(p: EmotePerformanceParams) {
  const result = await GET("/api/emote_average_performance", {
    params: {
      query: p,
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch emote average performance");
  }

  return result.data;
}

export async function getLatestEmotePerformance(
  p: LatestEmotePerformanceParams
) {
  const result = await GET("/api/latest_emote_performance", {
    params: {
      query: p,
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch latest emote average performance");
  }

  return result.data;
}

export async function getSeries(params: SeriesParams) {
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

/**
 * returns series data for top emotes by usage
 */
export async function getSeriesGreatest(params: SeriesParams) {
  const result = await GET("/api/series_greatest", {
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

export async function getClipAtTime(params: { time?: string }) {
  const result = await GET("/api/clip", {
    params: {
      query: params,
    },
  });

  if (result.error) {
    return undefined;
  }

  return result.data;
}

export async function getEmotes() {
  const result = await GET("/api/emotes");

  if (result.error) {
    throw new Error("Failed to fetch emotes");
  }

  return result.data;
}

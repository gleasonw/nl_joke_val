import { Chart } from "@/app/chart";
import { ClipParams, SeriesParams } from "./types";
import { GET } from "./utils";
import { MinClips, TopClips, TwitchClip } from "@/app/clip-clients";

export async function ChartFetcher({
  params,
}: {
  params: NonNullable<SeriesParams>;
}) {
  const result = await GET("/api/series", {
    params: {
      query: params,
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch series");
  }

  return <Chart chartData={result.data} />;
}

export async function TopClipFetcher({
  params,
}: {
  params: NonNullable<ClipParams>;
}) {
  const result = await GET("/api/clip_counts", {
    params: {
      query: {
        ...params,
        order: "DESC",
      },
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch top clips");
  }

  return <TopClips clips={result.data} />;
}

export async function MinClipFetcher({
  params,
}: {
  params: NonNullable<ClipParams>;
}) {
  const result = await GET("/api/clip_counts", {
    params: {
      query: {
        ...params,
        order: "ASC",
      },
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch min clips");
  }

  return <MinClips clips={result.data} />;
}

export async function ClipAtTimeFetcher({
  time: clickedUnixSeconds,
}: {
  time?: number;
}) {
  if (!clickedUnixSeconds) {
    return <div>Click on the chart to pull the nearest clip</div>;
  }

  const result = await GET("/api/clip", {
    params: {
      query: {
        time: clickedUnixSeconds,
      },
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch clip");
  }

  return (
    <TwitchClip
      clip_id={result.data.clip_id}
      time={new Date(clickedUnixSeconds * 1000).toLocaleString()}
    />
  );
}

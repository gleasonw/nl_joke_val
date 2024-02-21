import { Chart } from "@/app/chart";
import { ClipParams, SeriesParams } from "./types";
import { GET } from "./utils";
import { MinClips, TopClips, TwitchClip } from "@/app/clip-clients";
import { getLiveStatus } from "@/app/server/actions";

export async function ChartFetcher({
  params,
}: {
  params: NonNullable<SeriesParams> | undefined;
}) {
  const isStreamerLive = await getLiveStatus();

  const defaultSpan = isStreamerLive ? "30 minutes" : "9 hours";
  const defaultGrouping = isStreamerLive ? "second" : "minute";
  const defaultRollingAverage = isStreamerLive ? 5 : 0;

  const chartState: typeof params = {
    ...params,
    span: params?.span ?? defaultSpan,
    grouping: params?.grouping ?? defaultGrouping,
    rollingAverage: params?.rollingAverage ?? defaultRollingAverage,
  };

  const result = await GET("/api/series", {
    params: {
      query: chartState,
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch series");
  }

  return <Chart chartData={result.data} params={chartState} />;
}

export async function TopClipFetcher({ params }: { params: ClipParams }) {
  const isStreamerLive = await getLiveStatus();

  const defaultSpan = isStreamerLive ? "30 minutes" : "9 hours";
  const defaultGrouping = isStreamerLive ? "25 seconds" : "1 minute";

  const clipState: typeof params = {
    ...params,
    span: params?.span ?? defaultSpan,
    grouping: params?.grouping ?? defaultGrouping,
  } as const;

  const result = await GET("/api/clip_counts", {
    params: {
      query: {
        ...clipState,
        order: "DESC",
      },
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch top clips");
  }

  return <TopClips clips={result.data} params={clipState} />;
}

export async function MinClipFetcher({ params }: { params: ClipParams }) {
  const isStreamerLive = await getLiveStatus();

  const defaultSpan = isStreamerLive ? "30 minutes" : "9 hours";
  const defaultGrouping = isStreamerLive ? "25 seconds" : "1 minute";

  const clipState: typeof params = {
    ...params,
    span: params?.span ?? defaultSpan,
    grouping: params?.grouping ?? defaultGrouping,
  } as const;

  const result = await GET("/api/clip_counts", {
    params: {
      query: {
        ...clipState,
        order: "ASC",
        columns: ["two"],
      },
    },
  });

  if (result.error) {
    throw new Error("Failed to fetch min clips");
  }

  return <MinClips clips={result.data} params={clipState} />;
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

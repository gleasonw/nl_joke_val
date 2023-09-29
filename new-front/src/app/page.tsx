import Head from "next/head";
import Dashboard, { TimeSpans, TimeGroupings } from "@/app/dashboard";
import { z } from "zod";
import { addQueryParamsIfExist } from "@/app/utils";

export type SeriesData = z.infer<typeof SeriesDataSchema>;

export const SeriesKeys = {
  two: "two",
  lol: "lol",
  cereal: "cereal",
  monkas: "monkas",
  joel: "joel",
  pog: "pog",
  huh: "huh",
  no: "no",
  cocka: "cocka",
  shock: "shock",
  who_asked: "who_asked",
  copium: "copium",
  ratjam: "ratjam",
} as const;

export const SeriesDataSchema = z.object({
  [SeriesKeys.two]: z.number(),
  [SeriesKeys.lol]: z.number(),
  [SeriesKeys.cereal]: z.number(),
  [SeriesKeys.monkas]: z.number(),
  [SeriesKeys.joel]: z.number(),
  [SeriesKeys.pog]: z.number(),
  [SeriesKeys.huh]: z.number(),
  [SeriesKeys.no]: z.number(),
  [SeriesKeys.cocka]: z.number(),
  [SeriesKeys.shock]: z.number(),
  [SeriesKeys.who_asked]: z.number(),
  [SeriesKeys.copium]: z.number(),
  [SeriesKeys.ratjam]: z.number(),
  time: z.number(),
});

type ClipSpans = "day" | "week" | "month" | "year";

export type InitialArgState = {
  chart: {
    timeSpan: TimeSpans;
    timeGrouping: TimeGroupings;
    functionType: "instant" | "rolling";
    rollingAverage: string;
  };
  clips: {
    maxClipSpan: ClipSpans;
    minClipSpan: ClipSpans;
    maxClipGrouping: TimeGroupings;
    minClipGrouping: TimeGroupings;
    emote: keyof typeof SeriesKeys;
  };
};

export default async function Home({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const initialArgState = {
    chart: {
      timeSpan: searchParams.timeSpan ?? "9 hours",
      timeGrouping: searchParams.timeGrouping ?? "minute",
      functionType: searchParams.functionType ?? "instant",
      rollingAverage: searchParams.rollingAverage ?? "5",
    },
    clips: {
      maxClipSpan: searchParams.maxClipSpan ?? "day",
      minClipSpan: searchParams.minClipSpan ?? "day",
      maxClipGrouping: searchParams.clipTimeGrouping ?? "second",
      minClipGrouping: searchParams.clipTimeGrouping ?? "second",
      emote: searchParams.emote ?? "two",
    },
  };
  async function doFetch(label: string, url: string) {
    const res = await fetch(url, {
      next: {
        revalidate: 1,
      },
    });
    const data = await res.json();
    return { label, data };
  }

  const { emote, maxClipSpan, minClipGrouping, maxClipGrouping, minClipSpan } =
    initialArgState.clips;
  const { functionType, timeSpan, timeGrouping, rollingAverage } =
    initialArgState.chart;

  const urlsToFetch = {
    seriesData: addQueryParamsIfExist(
      `https://nljokeval-production.up.railway.app/api/${functionType}`,
      {
        span: timeSpan,
        grouping: timeGrouping,
        function: functionType,
        rolling_sum: rollingAverage,
      }
    ),
    maxClipData: addQueryParamsIfExist(
      "https://nljokeval-production.up.railway.app/api/clip_counts",
      {
        column: emote,
        span: maxClipSpan,
        grouping: maxClipGrouping,
        order: "desc",
      }
    ),
    minClipData: addQueryParamsIfExist(
      "https://nljokeval-production.up.railway.app/api/clip_counts",
      {
        column: "two",
        span: minClipSpan,
        grouping: minClipGrouping,
        order: "asc",
      }
    ),
  };

  const res = await Promise.allSettled(
    Object.entries(urlsToFetch).map(([label, url]) => doFetch(label, url))
  );

  console.log(res);

  const data = res.reduce((acc, curr) => {
    if (curr.status === "fulfilled") {
      acc[curr.value.label] = curr.value.data;
    }
    return acc;
  }, {} as Record<string, any>);

  return (
    <div>
      <Head>
        <title>NL Chat Dashboard</title>
      </Head>
      <Dashboard
        initialArgState={initialArgState}
        initialSeries={data.seriesData}
        initialMaxClips={data.maxClipData}
        initialMinClips={data.minClipData}
      />
    </div>
  );
}

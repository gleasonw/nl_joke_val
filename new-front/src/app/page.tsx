import Head from "next/head";
import Dashboard, { TimeSpans, TimeGroupings } from "@/app/dashboard";
import { z } from "zod";

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
      rollingSum: searchParams.rollingSum ?? "5",
    },
    clips: {
      clipTimeSpan: searchParams.clipTimeSpan ?? "day",
      clipTimeGrouping: searchParams.clipTimeGrouping ?? "second",
      emote: searchParams.emote ?? "two",
    },
  };
  async function doFetch(label: string, url: string) {
    const res = await fetch(
      "https://nljokeval-production.up.railway.app/api/" + url,
      {
        next: {
          revalidate: 1,
        },
      }
    );
    const data = await res.json();
    return { label, data };
  }

  const { emote, clipTimeSpan } = initialArgState.clips;
  const { functionType, timeSpan, timeGrouping, rollingSum } =
    initialArgState.chart;

  const paramsToFetch = {
    initialSeries: `${functionType}?span=${timeSpan}&grouping=${timeGrouping}&rolling_sum=${rollingSum}`,
    initialMaxClips: `clip_counts?column=two&span=${clipTimeSpan}&grouping=${initialArgState.clips.clipTimeGrouping}&order=asc`,
    initialMinClips: `clip_counts?column=${emote}&span=${clipTimeSpan}&grouping=${initialArgState.clips.clipTimeGrouping}&order=desc`,
  };

  const res = await Promise.allSettled(
    Object.entries(paramsToFetch).map(([label, url]) => doFetch(label, url))
  );

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
        initialSeries={data.initialSeries}
        initialMaxClips={data.initialMaxClips}
        initialMinClips={data.initialMinClips}
      />
    </div>
  );
}

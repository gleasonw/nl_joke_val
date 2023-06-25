import App from "@/components/App";
import Head from "next/head";
import { TimeSpans, TimeGroupings, SeriesData } from "@/components/Dashboard";

export type InitialArgState = {
  chart: {
    timeSpan: TimeSpans;
    timeGrouping: TimeGroupings;
    functionType: "rolling_sum" | "instant";
  };
  clips: {
    clipTimeSpan: "day" | "week" | "month" | "year";
    clipTimeGrouping: TimeGroupings;
    emote: "two";
  };
};

export default async function Home() {
  const initialArgState: InitialArgState = {
    chart: {
      timeSpan: "9 hours",
      timeGrouping: "minute",
      functionType: "instant",
    },
    clips: {
      clipTimeSpan: "day",
      clipTimeGrouping: "second",
      emote: "two",
    },
  };
  async function jsonFetcher(url: string) {
    const res = await fetch(url);
    return res.json();
  }
  const { emote, clipTimeSpan } = initialArgState.clips;
  const { functionType, timeSpan, timeGrouping } = initialArgState.chart;

  const initialSeries = await jsonFetcher(
    `https://nljokeval-production.up.railway.app/api/${functionType}?span=${timeSpan}&grouping=${timeGrouping}`
  );

  const initialMinClips = await jsonFetcher(
    `https://nljokeval-production.up.railway.app/api/clip_counts?column=two&span=${clipTimeSpan}&grouping=${initialArgState.clips.clipTimeGrouping}&order=asc`
  );

  const initialMaxClips = await jsonFetcher(
    `https://nljokeval-production.up.railway.app/api/clip_counts?column=${emote}&span=${clipTimeSpan}&grouping=${initialArgState.clips.clipTimeGrouping}&order=desc`
  );

  return (
    <div>
      <Head>
        <title>NL Chat Dashboard</title>
        <meta name="description" content="NL Chat Dashboard" />
      </Head>
      <App
        initialArgState={initialArgState}
        initialSeries={initialSeries}
        initialMaxClips={initialMaxClips}
        initialMinClips={initialMinClips}
      />
    </div>
  );
}

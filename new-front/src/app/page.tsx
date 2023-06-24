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
    clipTimeSpan: "day" | "week" | "month" | "year" | "";
    clipTimeGrouping: "10 seconds" | "minute";
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
      clipTimeGrouping: "10 seconds",
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
  const initialMaxClips = await jsonFetcher(
    `https://nljokeval-production.up.railway.app/api/max_clip?column=${emote}&span=${clipTimeSpan}`
  );
  const initialMinClips = await jsonFetcher(
    `https://nljokeval-production.up.railway.app/api/min_clip?span=${clipTimeSpan}`
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

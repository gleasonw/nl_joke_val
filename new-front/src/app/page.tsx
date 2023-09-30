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

export default async function Home() {
  return (
    <div>
      <Head>
        <title>NL Chat Dashboard</title>
      </Head>
      <Dashboard />
    </div>
  );
}

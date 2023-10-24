import { Series } from "highcharts";
import { z } from "zod";

export const timeGroupings = [
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;

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
  sure: "sure",
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
  [SeriesKeys.sure]: z.number(),
  [SeriesKeys.who_asked]: z.number(),
  [SeriesKeys.copium]: z.number(),
  [SeriesKeys.ratjam]: z.number(),
  time: z.number(),
});

export const timeSpans = [
  "1 minute",
  "1 hour",
  "9 hours",
  "1 week",
  "1 month",
  "1 year",
] as const;

export const seriesColors: Record<SeriesKey, string> = {
  [SeriesKeys.two]: "#7cb5ec",
  [SeriesKeys.lol]: "#434348",
  [SeriesKeys.cereal]: "#90ed7d",
  [SeriesKeys.monkas]: "#f7a35c",
  [SeriesKeys.joel]: "#8085e9",
  [SeriesKeys.pog]: "#f15c80",
  [SeriesKeys.huh]: "#e4d354",
  [SeriesKeys.no]: "#2b908f",
  [SeriesKeys.cocka]: "#f45b5b",
  [SeriesKeys.shock]: "#8d4654",
  [SeriesKeys.who_asked]: "#91e8e1",
  [SeriesKeys.copium]: "#696969",
  [SeriesKeys.ratjam]: "#000000",
  [SeriesKeys.sure]: "#000000",
} as const;

export type TimeSpans = (typeof timeSpans)[number];
export type TimeGroupings = (typeof timeGroupings)[number];
export type SeriesKey = keyof typeof SeriesKeys;
export type SeriesData = z.infer<typeof SeriesDataSchema>;

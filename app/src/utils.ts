import {
  ClipTimeGroupings,
  ClipTimeSpans,
  SeriesParams,
  TimeGroupings,
} from "./types";
import z from "zod";
import createClient from "openapi-fetch";
import { paths } from "./schema";

export type DashboardURLState = {
  seriesParams?: SeriesParams;
  clickedUnixSeconds?: number;
  series?: string[];
  from?: string;
  focusedEmote?: number;
};

const seriesParamsSchema = z.object({
  span: z
    .enum(["1 minute", "30 minutes", "1 hour", "9 hours", "custom"])
    .default("9 hours")
    .optional(),
  grouping: z
    .enum(["second", "minute", "hour", "day", "week", "month", "year"])
    .default("minute")
    .optional(),
  rollingAverage: z.coerce.number().optional(),
});

export const dashboardURLStateSchema: z.ZodType<DashboardURLState> = z.object({
  seriesParams: seriesParamsSchema.optional(),
  clickedUnixSeconds: z.number().optional(),
  series: z.array(z.string()).optional(),
  from: z.string().optional(),
  focusedEmote: z.coerce.number().optional(),
});

export const timeGroupings: NonNullable<TimeGroupings>[] = [
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;

export const clipTimeGroupings: NonNullable<ClipTimeGroupings>[] = [
  "25 seconds",
  "1 minute",
  "5 minutes",
  "15 minutes",
  "1 hour",
] as const;

export const clipTimeSpans: NonNullable<ClipTimeSpans>[] = [
  "9 hours",
  "1 week",
  "1 month",
  "1 year",
] as const;

let apiURL = "http://localhost:8000";

if (process.env.NODE_ENV === "production") {
  apiURL = "https://nljokeval-production.up.railway.app";
}

export { apiURL };

export const { GET } = createClient<paths>({
  baseUrl: apiURL,
});

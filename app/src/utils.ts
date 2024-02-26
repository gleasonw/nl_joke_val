import {
  ClipParams,
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
  minClipParams?: Omit<ClipParams, "column">;
  maxClipParams?: ClipParams;
  clickedUnixSeconds?: number;
  chartType?: "line" | "bar";
  series?: string[];
  maxClipIndex?: number;
  minClipIndex?: number;
};

const clipSpans = z
  .enum(["9 hours", "1 week", "1 month", "1 year"])
  .default("9 hours")
  .optional()
  .catch("9 hours");
const clipGroupings = z
  .enum([
    "25 seconds",
    "1 minute",
    "5 minutes",
    "15 minutes",
    "1 hour",
    "1 day",
  ])
  .default("1 hour")
  .optional()
  .catch("1 hour");

const seriesParamsSchema = z.object({
  span: z
    .enum(["1 minute", "30 minutes", "1 hour", "9 hours", "custom"])
    .default("9 hours")
    .optional()
    .catch("9 hours"),
  grouping: z
    .enum(["second", "minute", "hour", "day", "week", "month", "year"])
    .default("minute")
    .catch("minute")
    .optional(),
  rollingAverage: z.coerce.number().optional().catch(0),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
});

const clipParamsSchema = z.object({
  span: clipSpans,
  grouping: clipGroupings,
  index: z.number().optional().catch(0),
});

export const dashboardURLStateSchema = z.object({
  seriesParams: seriesParamsSchema.optional(),
  minClipParams: clipParamsSchema.optional(),
  maxClipParams: clipParamsSchema
    .extend({
      column: z.string().optional(),
    })
    .optional(),
  clickedUnixSeconds: z.number().optional(),
  chartType: z.enum(["line", "bar"]).optional().catch("line"),
  series: z.array(z.string()).optional().catch(["two"]),
  maxClipIndex: z.coerce.number().catch(0),
  minClipIndex: z.coerce.number().catch(0),
});

// ensure that the inferred type matches the type of the schema
// @ts-ignore
const parseParams = (params: Record<string, any>): DashboardURLState => {
  return dashboardURLStateSchema.parse(params);
};

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

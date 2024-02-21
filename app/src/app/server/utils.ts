import { ClipTimeGroupings, ClipTimeSpans, SeriesParams } from "@/app/types";
import z from "zod";

export type DashboardURLState = {
  seriesParams?: NonNullable<SeriesParams> & {
    series?: string[];
  };
  minClipParams?: {
    span?: ClipTimeSpans;
    grouping?: ClipTimeGroupings;
    index?: number;
  };
  maxClipParams?: {
    emote?: string;
    span?: ClipTimeSpans;
    grouping?: ClipTimeGroupings;
    index?: number;
  };
  clickedUnixSeconds?: number;
  chartType?: "line" | "bar";
  series?: string[];
  maxClipIndex?: number;
  minClipIndex?: number;
};

const clipSpans = z
  .enum(["9 hours", "1 week", "1 month", "1 year"])
  .default("9 hours")
  .optional();
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
  .optional();

const seriesParamsSchema = z.object({
  series: z.array(z.string()).optional(),
  span: z
    .enum(["1 minute", "30 minutes", "1 hour", "9 hours", "custom"])
    .default("9 hours")
    .optional(),
  grouping: z
    .enum(["second", "minute", "hour", "day", "week", "month", "year"])
    .default("minute")
    .optional(),
  rollingAverage: z.coerce.number().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  chartType: z.enum(["line", "bar"]).optional(),
});

const clipParamsSchema = z.object({
  span: clipSpans,
  grouping: clipGroupings,
  index: z.number().optional(),
});

const dashboardURLStateSchema = z.object({
  seriesParams: seriesParamsSchema.optional(),
  minClipParams: clipParamsSchema.optional(),
  maxClipParams: clipParamsSchema
    .extend({
      emote: z.string(),
    })
    .optional(),
  clickedUnixSeconds: z.number().optional(),
  chartType: z.enum(["line", "bar"]).optional(),
  series: z.array(z.string()).optional(),
  maxClipIndex: z.coerce.number().optional(),
  minClipIndex: z.coerce.number().optional(),
});

export function dashboardUrlState(
  jsonString: string | null
): DashboardURLState | null {
  if (!jsonString) {
    return null;
  }
  const params = JSON.parse(jsonString);
  const result = dashboardURLStateSchema.safeParse(params);

  if (!result.success) {
    console.error(result.error);
    throw new Error("Invalid params while parsing dashboard URL state");
  }

  return result.data;
}

export const dataQueryParam = "data";

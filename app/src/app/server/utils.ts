import { ClipTimeGroupings, ClipTimeSpans, SeriesParams } from "@/app/types";
import z from "zod";

export type DashboardURLState = {
  seriesParams: NonNullable<SeriesParams> & {
    series: string[];
    chartType: "line" | "bar";
  };
  minClipParams: {
    span: ClipTimeSpans;
    grouping: ClipTimeGroupings;
    index: number;
  };
  maxClipParams: {
    emote: string;
    span: ClipTimeSpans;
    grouping: ClipTimeGroupings;
    index: number;
  };
  clickedUnixSeconds?: number;
  chartType: "line" | "bar";
  series: string[];
  maxClipIndex?: number;
  minClipIndex?: number;
};

const clipSpans = z
  .enum(["9 hours", "1 week", "1 month", "1 year"])
  .default("9 hours");
const clipGroupings = z
  .enum([
    "25 seconds",
    "1 minute",
    "5 minutes",
    "15 minutes",
    "1 hour",
    "1 day",
  ])
  .default("1 hour");

const seriesParamsSchema = z.object({
  series: z.array(z.string()),
  span: z
    .enum(["1 minute", "30 minutes", "1 hour", "9 hours", "custom"])
    .default("9 hours"),
  grouping: z
    .enum(["second", "minute", "hour", "day", "week", "month", "year"])
    .default("minute"),
  rollingAverage: z.coerce.number(),
  from: z.string(),
  to: z.string(),
  chartType: z.enum(["line", "bar"]),
});

const clipParamsSchema = z.object({
  span: clipSpans,
  grouping: clipGroupings,
  index: z.number(),
});

const dashboardURLStateSchema = z.object({
  seriesParams: seriesParamsSchema,
  minClipParams: clipParamsSchema,
  maxClipParams: clipParamsSchema.extend({
    emote: z.string(),
  }),
  clickedUnixSeconds: z.number().optional(),
  chartType: z.enum(["line", "bar"]),
  series: z.array(z.string()),
  maxClipIndex: z.coerce.number().optional(),
  minClipIndex: z.coerce.number().optional(),
});

export function dashboardUrlState(
  params: Record<string, string>
): DashboardURLState {
  const result = dashboardURLStateSchema.safeParse(params);

  if (!result.success) {
    console.error(result.error);
    throw new Error("Invalid params while parsing dashboard URL state");
  }

  return result.data;
}

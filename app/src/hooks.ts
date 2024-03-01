import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Route, useLiveStatus } from "./routes/index.lazy";
import { ClipParams } from "./types";
import { getSeries } from "./api";

export function useDefaultClipParams(
  params?: Record<string, any>
): NonNullable<ClipParams> {
  const { data: isNlLive } = useLiveStatus();

  const defaultClipParams = {
    span: isNlLive ? "30 minutes" : "9 hours",
    grouping: "25 seconds",
  };

  const baseParams = params ? params : defaultClipParams;

  return {
    ...baseParams,
    grouping: baseParams?.grouping ?? defaultClipParams.grouping,
    span: baseParams?.span ?? defaultClipParams.span,
  };
}

export function useTimeSeries() {
  const { data: isNlLive } = useLiveStatus();
  const currentState = Route.useSearch();
  const { seriesParams } = currentState;

  const defaultSpan = isNlLive ? "30 minutes" : "9 hours";
  const defaultGrouping = isNlLive ? "second" : "minute";
  const defaultRollingAverage = isNlLive ? 0 : 5;

  const chartState: typeof seriesParams = {
    ...seriesParams,
    span: seriesParams?.span ?? defaultSpan,
    grouping: seriesParams?.grouping ?? defaultGrouping,
    rollingAverage: seriesParams?.rollingAverage ?? defaultRollingAverage,
  };

  return [
    useQuery({
      queryFn: () => getSeries(chartState),
      queryKey: ["series", chartState],
      refetchInterval: 1000 * 5,
      placeholderData: keepPreviousData,
    }),
    chartState,
  ] as const;
}

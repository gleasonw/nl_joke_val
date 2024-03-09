import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Route } from "./routes/index.lazy";
import { ClipParams } from "./types";
import { getEmotes, getSeries } from "./api";
import { DashboardURLState, apiURL } from "./utils";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

export function useLiveStatus() {
  return useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiURL}/api/is_live`);
      return response.json();
    },
    queryKey: ["liveStatus"],
  });
}

export function useEmotes() {
  return useQuery({
    queryFn: getEmotes,
    queryKey: ["emotes"],
  });
}

export function useSeriesState() {
  const currentSeries = Route.useSearch().series;
  const [, handleUpdateUrl] = useDashboardState();

  const handleUpdateSeries = useCallback((newSeries: string) => {
    let updatedSeries = [];

    if (!currentSeries) {
      updatedSeries = [newSeries];
    } else if (currentSeries?.includes(newSeries)) {
      updatedSeries = currentSeries.filter((series) => series !== newSeries);
    } else {
      updatedSeries = [...currentSeries, newSeries];
    }

    handleUpdateUrl({
      series: updatedSeries,
    });
  }, []);

  return [currentSeries, handleUpdateSeries] as const;
}

export function useDashboardState() {
  const currentState = Route.useSearch();
  const navigate = useNavigate();
  const handleUpdateUrl = useCallback((newParams: DashboardURLState) => {
    navigate({
      search: {
        ...currentState,
        ...newParams,
      },
    });
  }, []);

  return [currentState, handleUpdateUrl] as const;
}

export function useDefaultClipParams(
  params?: ClipParams
): NonNullable<ClipParams> {
  const { data: isNlLive } = useLiveStatus();

  const defaultClipParams = {
    span: isNlLive ? "30 minutes" : "9 hours",
    grouping: "25 seconds",
  } as const;

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

  const seriesData = useQuery({
    queryFn: () => getSeries(chartState),
    queryKey: ["series", chartState],
    refetchInterval: 1000 * 5,
    placeholderData: keepPreviousData,
  });

  return [seriesData, chartState] as const;
}

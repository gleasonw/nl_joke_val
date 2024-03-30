import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Route } from "./routes/index.lazy";
import { EmoteGrowthParams, LatestEmoteGrowthParams } from "./types";
import {
  getEmoteGrowth,
  getEmoteSums,
  getEmotes,
  getLatestEmoteGrowth as getLatestEmoteGrowth,
  getLatestEmoteSums,
  getLatestGreatestSeries,
  getLiveStatus,
  getSeriesGreatest,
} from "./api";
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DashboardURLState } from "@/utils";

export function useLiveStatus() {
  return useQuery({
    queryFn: async () => getLiveStatus(),
    queryKey: ["liveStatus"],
  });
}

export function useEmotes() {
  return useQuery({
    queryFn: getEmotes,
    queryKey: ["emotes"],
  });
}

export function useEmoteSums() {
  const { from } = Route.useSearch();
  const { seriesParams } = useDashboardState();
  return useQuery({
    queryFn: () => getEmoteSums({ from }),
    queryKey: ["emoteDensity", seriesParams, from],
    placeholderData: keepPreviousData,
  });
}

export function useLatestEmoteSums() {
  const { seriesParams } = useDashboardState();
  return useQuery({
    queryFn: () => getLatestEmoteSums({ span: "30 minutes" }),
    queryKey: ["latestEmoteSums", seriesParams],
    refetchInterval: 1000 * 10,
    placeholderData: keepPreviousData,
  });
}

export function useLatestSpan() {
  const { data: isNlLive } = useLiveStatus();

  return isNlLive ? "1 hour" : "9 hours";
}

export function useEmoteAveragePerformanceAtDay(p?: EmoteGrowthParams) {
  const { from } = useDashboardState();
  return useSuspenseQuery({
    queryFn: () => getEmoteGrowth({ ...p, date: from }),
    queryKey: ["emoteAveragePerformance", p, from],
  });
}

export function useEmoteGrowth(p?: EmoteGrowthParams) {
  const { from } = useDashboardState();
  return useQuery({
    queryFn: () => getEmoteGrowth({ ...p, date: from }),
    queryKey: ["emoteGrowth", p, from],
  });
}

export function useLatestEmoteGrowth(p?: LatestEmoteGrowthParams) {
  return useQuery({
    queryFn: () => getLatestEmoteGrowth({ ...p }),
    queryKey: ["latestEmotePerformance", p],
    refetchInterval: 1000 * 10,
  });
}

export function useDashboardNavigate() {
  const navigate = useNavigate();
  const currentState = useDashboardState();
  return useCallback((newParams: DashboardURLState) => {
    navigate({
      search: {
        ...currentState,
        ...newParams,
      },
    });
  }, []);
}

export function useSeriesState() {
  const currentSeries = Route.useSearch().series;
  const handleUpdateUrl = useDashboardNavigate();

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
  return Route.useSearch();
}

export function useLiveTimeSeries() {
  const { seriesParams } = useDashboardState();
  return useSuspenseQuery({
    queryFn: () => getLatestGreatestSeries(seriesParams),
    queryKey: ["liveTimeSeries", seriesParams],
    refetchInterval: 1000 * 10,
  });
}

export function useTimeSeries() {
  const currentState = Route.useSearch();
  const { seriesParams, from } = currentState;

  return useQuery({
    queryFn: () => getSeriesGreatest({ ...seriesParams, from }),
    queryKey: ["series", seriesParams, from],
    placeholderData: keepPreviousData,
  });
}

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
  getLatestTrendiestSeries,
  getLiveStatus,
  getNextStreamDate,
  getPreviousStreamDate,
  getSeriesGreatest,
} from "./api";
import { useCallback, useMemo } from "react";
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
  return useCallback(
    (newParams: DashboardURLState) => {
      navigate({
        search: {
          ...currentState,
          ...newParams,
        },
      });
    },
    [currentState, navigate]
  );
}

export function useSeriesState() {
  const currentSeries = Route.useSearch().series;
  const handleUpdateUrl = useDashboardNavigate();

  const handleUpdateSeries = useCallback(
    (newSeries: string) => {
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
    },
    [currentSeries, handleUpdateUrl]
  );

  return [currentSeries, handleUpdateSeries] as const;
}

export function useDashboardState() {
  return Route.useSearch();
}

export function useLiveTrendyTimeSeries() {
  const { seriesParams } = useDashboardState();
  return useSuspenseQuery({
    queryFn: () => getLatestTrendiestSeries(seriesParams),
    queryKey: ["latestTrendiestSeries", seriesParams],
    refetchInterval: 1000 * 10,
  });
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
  const { from } = useDashboardState();
  const seriesParams = useSeriesParams();

  return useQuery({
    queryFn: () => getSeriesGreatest({ ...seriesParams, from }),
    queryKey: ["series", seriesParams, from],
    placeholderData: keepPreviousData,
  });
}

export function useSeriesParams(): DashboardURLState["seriesParams"] {
  const { seriesParams } = useDashboardState();
  return {
    ...seriesParams,
    grouping: seriesParams?.grouping ?? "minute",
    rollingAverage: seriesParams?.rollingAverage ?? 30,
    span: seriesParams?.span ?? "9 hours",
  };
}

export function usePreviousStreamDate() {
  const { from } = useDashboardState();

  return useQuery({
    queryFn: () => getPreviousStreamDate(from),
    queryKey: ["previousStreamDate", from],
    placeholderData: keepPreviousData,
  });
}

export function useNextStreamDate() {
  const { from } = useDashboardState();

  return useQuery({
    queryFn: () => getNextStreamDate(from),
    queryKey: ["nextStreamDate", from],
    placeholderData: keepPreviousData,
  });
}

export type HighchartsInputs = {
  data: Highcharts.SeriesOptionsType[];
  chartType: "line" | "bar";
};

export function useTimeSeriesOptions(args: HighchartsInputs) {
  const { data, chartType } = args;
  const currentState = useDashboardState();
  const navigate = useNavigate();

  const { seriesParams } = currentState;

  return useMemo<Highcharts.Options>(
    () => ({
      time: {
        getTimezoneOffset: function (timestamp: number) {
          if (seriesParams?.grouping === "day") {
            // using an offset would throw off the day grouping
            return 0;
          }
          return new Date(timestamp).getTimezoneOffset();
        },
      },
      plotOptions: {
        series: {
          marker: {
            enabled: false,
          },
          cursor: "pointer",
        },
        line: {
          linecap: "round",
          lineWidth: 2,
        },
      },
      chart: {
        type: chartType,
        height: 600,
        zooming: {
          type: "x",
        },
        events: {
          click: function (e) {
            // @ts-expect-error - this is a valid event
            const xVal = e?.xAxis?.[0]?.value;
            if (xVal) {
              navigate({
                search: {
                  ...currentState,
                  clickedUnixSeconds: new Date().getTime(),
                },
              });
            }
          },
        },
      },
      title: {
        text: "",
      },
      xAxis: {
        type: "datetime",
        title: {
          text: "Time",
        },
      },
      yAxis: {
        title: {
          text: "Count",
        },
      },
      series: data,
    }),
    [currentState, data, navigate, chartType, seriesParams]
  );
}

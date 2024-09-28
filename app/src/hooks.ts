import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Route } from "./routes/index.lazy";
import {
  Emote,
  EmoteGrowthParams,
  EmoteSum,
  EmoteSumParams,
  LatestEmoteGrowthParams,
  TopClipSpan,
} from "./types";
import {
  getClipThumbnail,
  getEmoteGrowth,
  getEmoteSums,
  getEmotes,
  getHeroAllTimeClips,
  getLatestEmoteGrowth as getLatestEmoteGrowth,
  getLatestEmoteSums,
  getLatestGreatestSeries,
  getLatestTrendiestSeries,
  getLiveStatus,
  getNextStreamDate,
  getPreviousStreamDate,
  getSeries,
  getSeriesGreatest,
} from "./api";
import { useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DashboardURLState } from "@/utils";

export function useEmoteCountBarOptions(
  emotes: Pick<EmoteSum, "Code" | "HexColor" | "Sum" | "EmoteURL">[],
) {
  return useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "bar",
        height: 600,
      },
      xAxis: {
        categories: emotes?.map((e) => e.Code) ?? [],
        title: {
          text: "Emotes",
        },
      },
      yAxis: {
        min: 0,
        title: {
          text: "Sum",
        },
      },
      title: {
        text: "Top emotes last 30 minutes",
      },
      series: [
        {
          name: "Emote Usage",
          data:
            emotes?.map((e) => ({
              name: e.Code,
              color: e.HexColor,
              y: e.Sum,
            })) ?? [],
          type: "bar",
        },
      ],
      tooltip: {
        formatter() {
          const emote = emotes?.find((e) => e.Code === this.key);
          return `
            <strong>${this.key}</strong><br/>
            <img src="${emote?.EmoteURL}" width="20" height="20" /><br/>
            Sum: ${emote?.Sum}<br/>
          `;
        },
      },
      plotOptions: {
        series: {
          dataLabels: {
            enabled: true,
            useHTML: true,
            formatter() {
              const emote = emotes?.find((e) => e.Code === this.key);
              return `
                <div style="text-align: center; width: 20px; height: 20px; border-radius: 50%;">
                  <img src="${emote?.EmoteURL}" width="20" height="20" /><br/>
                </div>
              `;
            },
          },
        },
      },
    }),
    [emotes],
  );
}

export function useClipThumbnail(clip_id: string) {
  return useQuery({
    queryFn: () => getClipThumbnail({ clip_id }),
    queryKey: ["clipThumbnail", clip_id],
  });
}

export function useTopClipHero(props?: { span?: TopClipSpan }) {
  return useQuery({
    queryFn: () => getHeroAllTimeClips({ span: props?.span ?? "all" }),
    queryKey: ["topClipHero", props?.span],
  });
}

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

export function useEmoteSums(p?: EmoteSumParams) {
  const { from } = Route.useSearch();
  const { seriesParams } = useDashboardState();
  return useQuery({
    queryFn: () => getEmoteSums({ ...p, from }),
    queryKey: ["emoteDensity", seriesParams, from, p],
    placeholderData: keepPreviousData,
  });
}

export function useLatestEmoteSums(p?: EmoteSumParams) {
  const { seriesParams } = useDashboardState();
  return useQuery({
    queryFn: () => getLatestEmoteSums({ span: "30 minutes", limit: p?.limit }),
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
        to: "/",
        search: {
          ...currentState,
          ...newParams,
        },
      });
    },
    [currentState, navigate],
  );
}

export function useSeriesState() {
  const currentSeries = Route.useSearch().series;
  const handleUpdateUrl = useDashboardNavigate();

  const handleUpdateSeries = useCallback(
    (emoteID: number) => {
      let updatedSeries = [];

      if (!currentSeries) {
        updatedSeries = [emoteID];
      } else if (currentSeries?.includes(emoteID)) {
        updatedSeries = currentSeries.filter((series) => series !== emoteID);
      } else {
        updatedSeries = [...currentSeries, emoteID];
      }

      handleUpdateUrl({
        series: updatedSeries,
      });
    },
    [currentSeries, handleUpdateUrl],
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

export function useGreatestTimeSeries() {
  const { from } = useDashboardState();
  const seriesParams = useSeriesParams();

  return useQuery({
    queryFn: () => getSeriesGreatest({ ...seriesParams, from }),
    queryKey: ["greatestSeries", seriesParams, from],
    placeholderData: keepPreviousData,
  });
}

export function useTimeSeries(p?: { emote_ids?: number[] }) {
  const emote_ids = p ? p.emote_ids : [];
  const { from } = useDashboardState();
  const seriesParams = useSeriesParams();

  const params = { ...seriesParams, from, emote_ids } as const;

  return useQuery({
    queryFn: () => getSeries(params),
    queryKey: ["series", params],
    placeholderData: keepPreviousData,
  });
}

export function useLivePlottedEmotes() {
  const { data: topFive } = useLatestEmoteSums({ limit: 5 });
  return useSeriesPicker(topFive?.Emotes);
}

export function usePlottedEmotes() {
  const { data: topFive } = useEmoteSums({ limit: 3 });
  return useSeriesPicker(topFive?.Emotes);
}

function useSeriesPicker(
  topFive?: EmoteSum[],
): Pick<Emote, "Url" | "Code" | "HexColor" | "ID">[] {
  const { series } = useDashboardState();
  const { data: emotes } = useEmotes();

  if (!topFive) {
    return [];
  }

  if (!series || series.length === 0) {
    return topFive.map((e) => ({
      Url: e.EmoteURL,
      Code: e.Code,
      HexColor: e.HexColor,
      ID: e.EmoteID,
    }));
  }

  // we have to do some weirdness. If the user has selected a top five emote, we should no longer display it,
  // since the default is already displayed.
  // this is the most intuitive ux. not the most intuitive dx, for sure. Probably a better way.

  const defaultIds = topFive.map((e) => e.EmoteID);

  const defaultSet = new Set(defaultIds);
  const userSelectedSet = new Set(series);

  const userSeriesToDisplay = series.filter(
    (emoteID) => !defaultSet.has(emoteID),
  );

  const defaultSeriesToDisplay = defaultIds.filter(
    (id) => !userSelectedSet.has(id),
  );

  const mergedSeriesSet = new Set([
    ...userSeriesToDisplay,
    ...defaultSeriesToDisplay,
  ]);

  return emotes?.filter((e) => mergedSeriesSet.has(e.ID)) ?? [];
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
                to: "/",
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
    [currentState, data, navigate, chartType, seriesParams],
  );
}

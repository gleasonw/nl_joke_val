import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addQueryParamsIfExist } from "@/app/utils";
import { ClipTimeSpans, TimeGroupings, TimeSpans } from "@/app/types";
import { useQuery } from "@tanstack/react-query";
import { apiURL } from "@/app/apiURL";

export function useLiveStatus() {
  return useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiURL}/api/is_live`);
      return response.json();
    },
    queryKey: ["liveStatus"],
    cacheTime: 0,
  });
}
export function useDashboardUrl() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: nlIsLive } = useLiveStatus();

  const defaultSeriesGrouping = nlIsLive ? "minute" : "minute";
  const defaultRollingAverage = nlIsLive ? "0" : "5";
  const defaultChartType = nlIsLive ? "bar" : "line";

  const series =
    params.getAll("series").length > 0 ? params.getAll("series") : ["two"];
  const chartType = params.get("chartType") ?? defaultChartType;
  const seriesGrouping: TimeGroupings =
    (params.get("timeGrouping") as TimeGroupings) ?? defaultSeriesGrouping;
  const rollingAverage = params.get("rollingAverage") ?? defaultRollingAverage;
  const fromParam = params.get("from");
  const toParam = params.get("to");

  let seriesSpan: TimeSpans | undefined = params.get("span") as TimeSpans;
  if (!seriesSpan && nlIsLive) {
    seriesSpan = "30 minutes";
  }

  const minClipGrouping = (params.get("minClipGrouping") ??
    "second") as TimeGroupings;
  const minClipSpan: ClipTimeSpans =
    (params.get("minClipSpan") as ClipTimeSpans) ?? "9 hours";
  const minClipIndex = params.get("minClipIndex");

  const emotes =
    params.getAll("emote").length > 0 ? params.getAll("emote") : ["two"];
  const maxClipGrouping = (params.get("maxClipGrouping") ??
    "second") as TimeGroupings;
  const maxClipSpan: ClipTimeSpans =
    (params.get("maxClipSpan") as ClipTimeSpans) ?? "9 hours";
  const maxClipIndex = params.get("maxClipIndex");

  const handleNavigate = useCallback(
    (newParam: { [key: string]: string | string[] | undefined | number }) => {
      const paramsObject: {
        [key: string]: string | string[];
      } = {};
      params.forEach((value, key) => {
        const item = paramsObject[key];
        if (item) {
          if (Array.isArray(item)) {
            item.push(value);
          } else {
            paramsObject[key] = [item, value];
          }
        } else {
          paramsObject[key] = value;
        }
      });

      router.push(
        addQueryParamsIfExist("/", {
          ...paramsObject,
          ...newParam,
        }),
        { scroll: false }
      );
    },
    [params, router]
  );

  const currentParams = {
    series,
    chartType,
    seriesGrouping,
    rollingAverage,
    fromParam,
    toParam,
    minClipGrouping,
    minClipSpan,
    emotes,
    maxClipGrouping,
    maxClipSpan,
    seriesSpan,
    minClipIndex: minClipIndex ? parseInt(minClipIndex as string) : 0,
    maxClipIndex: maxClipIndex ? parseInt(maxClipIndex as string) : 0,
  };

  return { handleNavigate, currentParams };
}

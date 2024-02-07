import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addQueryParamsIfExist } from "@/app/utils";
import { ClipTimeSpans, TimeGroupings, TimeSpans } from "@/app/types";

export function useDashboardUrl() {
  const params = useSearchParams();
  const router = useRouter();

  const series =
    params.getAll("series").length > 0 ? params.getAll("series") : ["two"];
  const chartType = params.get("chartType") ?? "line";
  const seriesGrouping: TimeGroupings =
    (params.get("timeGrouping") as TimeGroupings) ?? "minute";
  const rollingAverage = params.get("rollingAverage") ?? "5";
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const minClipGrouping = (params.get("minClipGrouping") ??
    "second") as TimeGroupings;
  const minClipSpan: ClipTimeSpans =
    (params.get("minClipSpan") as ClipTimeSpans) ?? "9 hours";
  const emotes =
    params.getAll("emote").length > 0 ? params.getAll("emote") : ["two"];
  const maxClipGrouping = (params.get("maxClipGrouping") ??
    "second") as TimeGroupings;
  const maxClipSpan: ClipTimeSpans =
    (params.get("maxClipSpan") as ClipTimeSpans) ?? "9 hours";
  const seriesSpan = params.get("span") as TimeSpans;
  const minClipIndex = params.get("minClipIndex");
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

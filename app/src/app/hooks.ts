import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addQueryParamsIfExist } from "@/app/utils";
import { TimeSpans } from "@/app/types";
import { useQuery } from "@tanstack/react-query";
import { apiURL } from "@/app/apiURL";
import { dashboardUrlState } from "@/app/server/utils";

export function useLiveStatus() {
  return useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiURL}/api/is_live`);
      return response.json();
    },
    queryKey: ["liveStatus"],
  });
}
export function useDashboardUrl() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: nlIsLive } = useLiveStatus();

  const paramsAsRecord = Object.fromEntries(params);

  const validatedParams = dashboardUrlState(paramsAsRecord);

  const defaultSeriesGrouping = nlIsLive ? "minute" : "minute";
  const defaultRollingAverage = nlIsLive ? "0" : "5";
  const defaultChartType = nlIsLive ? "bar" : "line";

  let seriesSpan: TimeSpans | undefined = params.get("span") as TimeSpans;
  if (!seriesSpan && nlIsLive) {
    seriesSpan = "30 minutes";
  }

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

  return {
    handleNavigate,
    currentParams: {
      ...validatedParams,
      seriesParams: {
        grouping:
          validatedParams.seriesParams.grouping ?? defaultSeriesGrouping,
        rollingAverage:
          validatedParams.seriesParams.rolling_average ?? defaultRollingAverage,
        span: seriesSpan || "30 minutes",
      },
      chartType: validatedParams.chartType ?? defaultChartType,
    },
  };
}

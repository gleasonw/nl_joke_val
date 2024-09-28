import { useNavigate } from "@tanstack/react-router";
import { TimeSeries } from "../types";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
  useDashboardState,
  useTimeSeriesOptions as useTimeSeriesOptions,
  useLivePlottedEmotes,
} from "../hooks";
import React from "react";

export function LiveChart({
  data,
  isLoading,
  className,
}: {
  data?: TimeSeries[];
  isLoading: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const currentState = useDashboardState();
  const plottedEmotes = useLivePlottedEmotes();

  const highChartsOptions = useTimeSeriesOptions({
    data:
      plottedEmotes?.map((e) => ({
        name: e.Code,
        color: e.HexColor,
        data:
          data?.map((d) => [
            new Date(d.time).getTime(),
            d.series[e.Code] ?? 0,
          ]) ?? [],
        events: {
          click: function (e) {
            navigate({
              to: '/',
              search: { ...currentState, clickedUnixSeconds: e.point.x / 1000 },
            });
          },
        },
        type: "line",
      })) ?? ([] as Highcharts.SeriesOptionsType[]),
    chartType: "line",
  });

  return (
    <div className={className}>
      {isLoading ? (
        <div className="aspect-video animate-pulse bg-gray-100" />
      ) : (
        <HighchartsReact highcharts={Highcharts} options={highChartsOptions} />
      )}
    </div>
  );
}

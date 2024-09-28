import { Link, useNavigate } from "@tanstack/react-router";
import { TimeGroupings, TimeSeries } from "../types";
import { DashboardURLState, timeGroupings } from "../utils";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
  useDashboardState,
  useTimeSeriesOptions as useTimeSeriesOptions,
  useSeriesParams,
  usePlottedEmotes,
} from "../hooks";
import React from "react";
import { SettingsDropLayout } from "./SettingsDropLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function Chart({
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
  const plottedEmotes = usePlottedEmotes();

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
              to: "/",
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

export function ChartOptions() {
  const navigate = useNavigate();
  const currentState = useDashboardState();
  const { seriesParams } = currentState;

  const seriesParamsWithDefaults = useSeriesParams();

  function handleUpdateChart(newParams: DashboardURLState["seriesParams"]) {
    navigate({
      to: "/",
      search: {
        ...currentState,
        seriesParams: { ...seriesParams, ...newParams },
      },
    });
  }

  return (
    <>
      <ChartSpanOptions />
      <SettingsDropLayout>
        <label>
          Group By
          <Select
            onValueChange={(value) =>
              handleUpdateChart({
                grouping: value as TimeGroupings,
              })
            }
            value={seriesParamsWithDefaults?.grouping}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              {timeGroupings.map((grouping) => (
                <SelectItem value={grouping} key={grouping}>
                  {grouping}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label>
          Smoothing
          <Select
            onValueChange={(value) =>
              handleUpdateChart({
                rollingAverage: parseInt(value),
              })
            }
            value={(seriesParamsWithDefaults?.rollingAverage ?? 0).toString()}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Smoothing" />
            </SelectTrigger>
            <SelectContent>
              {[0, 5, 10, 15, 30, 60].map((smoothing) => (
                <SelectItem value={smoothing.toString()} key={smoothing}>
                  {smoothing === 0 ? "None" : smoothing}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </SettingsDropLayout>
    </>
  );
}

export function ChartSpanOptions() {
  const { from } = useDashboardState();

  const seriesParams = useSeriesParams();

  const span = seriesParams?.span;

  function pushNewSpan(
    previous: DashboardURLState,
    span: NonNullable<DashboardURLState["seriesParams"]>["span"],
  ) {
    return {
      ...previous,
      seriesParams: {
        ...previous.seriesParams,
        span,
      },
    };
  }

  if (from) {
    return (
      <Link to={"/"}>
        <Button>Return to latest stream data</Button>
      </Link>
    );
  }

  return (
    <SettingsDropLayout>
      <Link to="/" search={(prev) => pushNewSpan(prev, "1 minute")}>
        <Button
          className={span === "1 minute" ? "border-b-4 border-gray-700" : ""}
          variant="ghost"
        >
          1 m
        </Button>
      </Link>
      <Link to="/" search={(prev) => pushNewSpan(prev, "30 minutes")}>
        <Button
          className={span === "30 minutes" ? "border-b-4 border-gray-700" : ""}
          variant="ghost"
        >
          30 m
        </Button>
      </Link>
      <Link to="/" search={(prev) => pushNewSpan(prev, "1 hour")}>
        <Button
          className={span === "1 hour" ? "border-b-4 border-gray-700" : ""}
          variant="ghost"
        >
          1 h
        </Button>
      </Link>
      <Link to="/" search={(prev) => pushNewSpan(prev, "9 hours")}>
        <Button
          className={
            span === "9 hours" || span === null
              ? "border-b-4 border-gray-700"
              : ""
          }
          variant="ghost"
        >
          9 h
        </Button>
      </Link>
    </SettingsDropLayout>
  );
}

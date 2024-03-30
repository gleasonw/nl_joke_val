import { Link, useNavigate } from "@tanstack/react-router";
import { TimeGroupings, TimeSeries } from "../types";
import { DashboardURLState, timeGroupings } from "../utils";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useDashboardState } from "../hooks";
import React from "react";
import { Route } from "../routes/index.lazy";
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
}: {
  data?: TimeSeries[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();
  const currentState = Route.useSearch();
  const { seriesParams } = currentState;

  function handleUpdateChart(newParams: DashboardURLState["seriesParams"]) {
    navigate({
      search: {
        ...currentState,
        seriesParams: { ...seriesParams, ...newParams },
      },
    });
  }

  const seriesToDisplay = Object.keys(data?.at(0)?.series ?? {});

  const emoteSeries:
    | Highcharts.SeriesLineOptions[]
    | Highcharts.SeriesBarOptions[] =
    seriesToDisplay?.map((key) => ({
      name: key,
      data:
        data?.map((d) => [new Date(d.time).getTime(), d.series[key] ?? 0]) ??
        [],
      events: {
        click: function (e) {
          navigate({
            search: { ...currentState, clickedUnixSeconds: e.point.x / 1000 },
          });
        },
      },
      type: "line",
    })) ?? ([] as Highcharts.SeriesOptionsType[]);

  const highChartsOptions: Highcharts.Options = {
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
      type: "line",
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
    series: emoteSeries,
  };

  return (
    <div className="flex flex-col gap-2">
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
            value={seriesParams?.grouping}
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
            value={(seriesParams?.rollingAverage ?? 0).toString()}
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
      {isLoading ? (
        <div className="aspect-video bg-gray-100 animate-pulse" />
      ) : (
        <HighchartsReact highcharts={Highcharts} options={highChartsOptions} />
      )}
    </div>
  );
}

export function ChartSpanOptions() {
  const { from, seriesParams } = useDashboardState();

  const span = seriesParams?.span;

  function pushNewSpan(previous: DashboardURLState, span: string) {
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
      <Link
        to="/"
        search={(prev) => pushNewSpan(prev, "1 minute")}
        className={span === "1 minute" ? "border-b-4 border-gray-700" : ""}
      >
        1 m
      </Link>
      <Link
        to="/"
        search={(prev) => pushNewSpan(prev, "30 minutes")}
        className={span === "30 minutes" ? "border-b-4 border-gray-700" : ""}
      >
        30 m
      </Link>
      <Link
        to="/"
        search={(prev) => pushNewSpan(prev, "1 hour")}
        className={span === "1 hour" ? "border-b-4 border-gray-700" : ""}
      >
        1 h
      </Link>
      <Link
        to="/"
        search={(prev) => pushNewSpan(prev, "9 hours")}
        className={
          span === "9 hours" || span === null
            ? "border-b-4 border-gray-700"
            : ""
        }
      >
        9 h
      </Link>
    </SettingsDropLayout>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { TimeGroupings } from "../types";
import { DashboardURLState, timeGroupings } from "../utils";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useDashboardState, useDefaultSeries, useTimeSeries } from "../hooks";
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

const last9HoursRange = {
  from: undefined,
  to: undefined,
  span: "9 hours",
} as const;

const lastHourRange = {
  from: undefined,
  to: undefined,
  span: "1 hour",
} as const;

const lastMinuteRange = {
  from: undefined,
  to: undefined,
  span: "1 minute",
} as const;

export function Chart() {
  const navigate = useNavigate();
  const currentState = Route.useSearch();
  const { seriesParams, chartType: urlChartType, series } = currentState;

  function handleUpdateChart(newParams: DashboardURLState["seriesParams"]) {
    navigate({
      search: {
        ...currentState,
        seriesParams: { ...seriesParams, ...newParams },
      },
    });
  }

  const [
    { data: localFetchedSeries, isLoading },
    { grouping, rollingAverage },
  ] = useTimeSeries();

  const defaultSeries = useDefaultSeries();
  const seriesToDisplay = series?.length
    ? [...series, ...defaultSeries]
    : defaultSeries;

  const chartType = urlChartType ?? "line";

  const emoteSeries:
    | Highcharts.SeriesLineOptions[]
    | Highcharts.SeriesBarOptions[] =
    seriesToDisplay?.map((key) => ({
      name: key,
      data:
        localFetchedSeries?.map((d) => [
          new Date(d.time).getTime(),
          d.series[key] ?? 0,
        ]) ?? [],
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
        if (grouping === "day") {
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
      type: chartType as string,
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
      {isLoading ? (
        <div className="text-center w-full h-full">Loading series...</div>
      ) : (
        <HighchartsReact highcharts={Highcharts} options={highChartsOptions} />
      )}
      <SettingsDropLayout>
        <label>
          Group By
          <Select
            onValueChange={(value) =>
              handleUpdateChart({
                grouping: value as TimeGroupings,
              })
            }
            value={grouping}
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
            value={(rollingAverage ?? 0).toString()}
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
    </div>
  );
}

export function ChartSpanOptions() {
  const [{ from }, handleUpdateChart] = useDashboardState();
  const [, { span }] = useTimeSeries();

  if (from) {
    return (
      <Button onClick={() => handleUpdateChart({ from: undefined })}>
        Return to latest stream data
      </Button>
    );
  }
  return (
    <SettingsDropLayout>
      <Button
        onClick={() => handleUpdateChart(lastMinuteRange)}
        variant={span === "1 minute" ? "default" : "outline"}
      >
        Last minute of stream
      </Button>
      <Button
        onClick={() => handleUpdateChart(lastHourRange)}
        variant={span === "1 hour" ? "default" : "outline"}
      >
        Last hour of stream
      </Button>
      <Button
        onClick={() => handleUpdateChart(last9HoursRange)}
        variant={span === "9 hours" || span === null ? "default" : "outline"}
      >
        Last 9 hours of stream
      </Button>
    </SettingsDropLayout>
  );
}

export function LiveChart() {
  return <div>hello</div>;
}

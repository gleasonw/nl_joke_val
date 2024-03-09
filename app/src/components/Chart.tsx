import { useNavigate } from "@tanstack/react-router";
import { TimeGroupings } from "../types";
import { DashboardURLState, timeGroupings } from "../utils";
import {
  Select,
  SelectItem,
  Button,
  DateRangePickerValue,
  DateRangePicker,
  DateRangePickerItem,
} from "@tremor/react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useTimeSeries } from "../hooks";
import React from "react";
import { Route } from "../routes/index.lazy";
import { SettingsDropLayout } from "./SettingsDropLayout";

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
    { grouping, from, to, rollingAverage, span },
  ] = useTimeSeries();

  const seriesToDisplay = series?.length ? series : ["two"];

  const chartType = urlChartType ?? "line";

  const emoteSeries:
    | Highcharts.SeriesLineOptions[]
    | Highcharts.SeriesBarOptions[] =
    seriesToDisplay?.map((key) => ({
      name: key,
      data:
        localFetchedSeries?.map((d) => [
          new Date(d.time).getTime(),
          d.series[key] ?? "",
        ]) ?? [],
      events: {
        click: function (e) {
          navigate({
            search: { ...currentState, clickedUnixSeconds: e.point.x / 1000 },
          });
        },
      },
      type: chartType as "line",
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

  const fromTo = {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  } as DateRangePickerValue;

  return (
    <div className="flex flex-col gap-2">
      <SettingsDropLayout>
        <Button
          onClick={() => handleUpdateChart(lastMinuteRange)}
          variant={span === "1 minute" ? "primary" : "secondary"}
        >
          Last minute of stream
        </Button>
        <Button
          onClick={() => handleUpdateChart(lastHourRange)}
          variant={span === "1 hour" ? "primary" : "secondary"}
        >
          Last hour of stream
        </Button>
        <Button
          onClick={() => handleUpdateChart(last9HoursRange)}
          variant={
            span === "9 hours" || span === null ? "primary" : "secondary"
          }
        >
          Last 9 hours of stream
        </Button>
      </SettingsDropLayout>
      {isLoading ? (
        <div className="text-center w-full h-full">Loading series...</div>
      ) : (
        <HighchartsReact highcharts={Highcharts} options={highChartsOptions} />
      )}
      <span className="text-center">
        Select a point in the graph to pull the nearest clip
      </span>
      <SettingsDropLayout>
        <label>
          Group By
          <Select
            id="groupBySelect"
            value={grouping}
            placeholder={"Group by"}
            onValueChange={(value) =>
              handleUpdateChart({
                grouping: value as TimeGroupings,
              })
            }
          >
            {timeGroupings.map((grouping) => (
              <SelectItem value={grouping} key={grouping} />
            ))}
          </Select>
        </label>
        <label>
          Smoothing
          <Select
            id="smoothing"
            value={rollingAverage?.toString()}
            placeholder={"Smoothing"}
            onValueChange={(value) =>
              handleUpdateChart({
                rollingAverage: parseInt(value),
              })
            }
          >
            {[0, 5, 10, 15, 30, 60].map((smoothing) => (
              <SelectItem value={smoothing.toString()} key={smoothing}>
                {smoothing === 0 ? "None" : smoothing}
              </SelectItem>
            ))}
          </Select>
        </label>
        <label>
          Chart Type
          <Select
            id="chartTypeSelect"
            value={chartType}
            placeholder={"Chart type"}
            onValueChange={(value) =>
              navigate({
                search: {
                  chartType: value as "line" | "bar",
                },
              })
            }
          >
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="bar">Bar</SelectItem>
          </Select>
        </label>
      </SettingsDropLayout>
    </div>
  );
}

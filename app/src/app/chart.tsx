"use client";

import { seriesEmotes } from "@/app/clip-clients";
import { useDashboardUrl, useLiveStatus } from "@/app/hooks";
import { LiveStatus, SettingsDropLayout } from "@/app/page";
import { DashboardURLState } from "@/app/server/utils";
import { FullChatCountStruct, SeriesData, SeriesKey } from "@/app/types";
import { timeGroupings } from "@/app/utils";
import {
  Button,
  DateRangePicker,
  DateRangePickerValue,
  DateRangePickerItem,
  Select,
  SelectItem,
  Card,
} from "@tremor/react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

const seriesColors: Record<SeriesKey, string> = {
  two: "#7cb5ec",
  lol: "#434348",
  cereal: "#90ed7d",
  monkas: "#f7a35c",
  joel: "#8085e9",
  pog: "#f15c80",
  huh: "#e4d354",
  no: "#2b908f",
  cocka: "#f45b5b",
  shock: "#8d4654",
  who_asked: "#91e8e1",
  copium: "#696969",
  ratjam: "#000000",
  sure: "#000000",
  classic: "#ffff00",
  monka_giga: "#808080",
  caught: "#0000ff",
  life: "#ff0000",
} as const;

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

type LocalChartState = NonNullable<DashboardURLState["seriesParams"]>;

export function Chart({
  chartData,
  params: { span, grouping, rollingAverage, series, from, to },
}: {
  chartData: FullChatCountStruct[];
  params: LocalChartState;
}) {
  const { handleNavigate, currentParams } = useDashboardUrl();
  const { data: isNlLive } = useLiveStatus();

  let chartType = "line";

  // depends on there being fewer datapoints... bar easier to read. More of a client side
  // concern, but I could see it making sense to set the default higher up
  if (!currentParams?.chartType && isNlLive) {
    chartType = "bar";
  }

  const seriesToDisplay = series ?? ["two"];

  function handleUpdateChart(newParams: DashboardURLState["seriesParams"]) {
    return handleNavigate({
      seriesParams: {
        ...newParams,
      },
    });
  }

  const emoteSeries =
    seriesToDisplay?.map((key) => ({
      name: key,
      data:
        chartData?.map((d) => [
          d.time * 1000 ?? 0,
          d[key as keyof SeriesData] ?? "",
        ]) ?? [],
      color: seriesColors[key as unknown as SeriesKey],
      events: {
        click: function (e: any) {
          handleNavigate({ clickedUnixSeconds: e.point.x / 1000 });
        },
      },
    })) || ([] as Highcharts.SeriesOptionsType[]);

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
      type: chartType,
      height: 600,
      zooming: {
        type: "x",
      },
      events: {
        click: function (e: any) {
          console.log(e);
          let xVal = e?.xAxis?.[0]?.value;
          if (xVal) {
            handleNavigate({ clickedUnixSeconds: xVal / 1000 });
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
    // @ts-ignore
    series: emoteSeries,
  };

  let timeRangeString = "";

  const lowestTime = chartData?.[0]?.time;
  const highestTime = chartData?.[chartData.length - 1]?.time;

  if (lowestTime && highestTime) {
    const lowestDate = new Date(lowestTime * 1000);
    const highestDate = new Date(highestTime * 1000);
    timeRangeString = `${lowestDate.toLocaleString()} - ${highestDate.toLocaleString()}`;
  }

  function getNewSeriesList(emote: string) {
    if (!series) {
      return [emote];
    }

    if (series?.includes(emote)) {
      return series.filter((item) => item !== emote);
    }

    return [...series, emote];
  }

  const fromTo = {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  } as DateRangePickerValue;

  return (
    <Card className="flex flex-col gap-2">
      <h1 className={"text-2xl m-5 font-semibold flex flex-col gap-4"}>
        <span className="flex justify-between">
          NL chat emote usage <LiveStatus />
        </span>
        <span className="text-gray-600 text-base">{timeRangeString}</span>
      </h1>
      <div className="flex flex-row flex-wrap gap-3 m-2">
        {Object.keys(seriesColors).map((key) => (
          <button
            className={"w-auto hover:shadow-lg rounded-lg p-3"}
            style={
              seriesToDisplay?.includes(key as SeriesKey)
                ? {
                    boxShadow: `0 0 0 4px ${seriesColors[key as SeriesKey]}`,
                  }
                : {}
            }
            key={key}
            onClick={() => {
              handleNavigate({
                series: getNewSeriesList(key),
              });
            }}
          >
            {seriesEmotes[key as SeriesKey]}
          </button>
        ))}
      </div>
      <span className="text-center">
        Select a point in the graph to pull the nearest clip
      </span>
      <HighchartsReact highcharts={Highcharts} options={highChartsOptions} />
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
        <DateRangePicker
          value={fromTo}
          onValueChange={(value: DateRangePickerValue) =>
            handleUpdateChart({
              from: value.from?.toISOString(),
              to: value.to?.toISOString(),
              span: "custom",
            })
          }
          selectPlaceholder="Select a range"
        >
          <DateRangePickerItem
            key="day"
            value="day"
            from={new Date(new Date().getTime() - 24 * 60 * 60 * 1000)}
            to={new Date()}
          >
            Past day
          </DateRangePickerItem>
          <DateRangePickerItem
            key="week"
            value="week"
            from={new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)}
            to={new Date()}
          >
            Past week
          </DateRangePickerItem>
          <DateRangePickerItem
            key="half"
            value="half"
            from={new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000)}
            to={new Date()}
          >
            Past 30 days
          </DateRangePickerItem>

          <DateRangePickerItem
            key="ytd"
            value="ytd"
            from={new Date(2023, 3, 18)}
            to={new Date()}
          >
            To date
          </DateRangePickerItem>
        </DateRangePicker>
      </SettingsDropLayout>
      <SettingsDropLayout>
        <label>
          Group By
          <Select
            id="groupBySelect"
            value={grouping}
            placeholder={"Group by"}
            onValueChange={(value) =>
              handleUpdateChart({
                grouping: value as any,
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
                rollingAverage: value as any,
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
              handleNavigate({
                chartType: value as any,
              })
            }
          >
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="bar">Bar</SelectItem>
          </Select>
        </label>
      </SettingsDropLayout>
    </Card>
  );
}

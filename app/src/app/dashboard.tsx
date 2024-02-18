"use client";

import {
  Select,
  SelectItem,
  Card,
  DateRangePicker,
  DateRangePickerItem,
  DateRangePickerValue,
} from "@tremor/react";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import Image from "next/image";
import {
  SeriesKey,
  SeriesData,
  FullChatCountStruct,
  SeriesParams,
  Clip,
} from "./types";
import { MostMinusTwosClips } from "./minus-two-clips";
import { TopTwitchClips } from "./top-twitch-clips";
import { useDashboardUrl, useLiveStatus } from "@/app/hooks";
import { timeGroupings, addQueryParamsIfExist } from "@/app/utils";
import { apiURL } from "@/app/apiURL";

const timeSinceLiveSet = new Set<"1 minute" | "1 hour" | "9 hours">([
  "1 minute",
  "1 hour",
  "9 hours",
]);

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

export default function Dashboard() {
  const {
    handleNavigate,
    currentParams: {
      series,
      seriesGrouping: grouping,
      rollingAverage,
      fromParam,
      toParam,
      chartType,
      seriesSpan: span,
    },
  } = useDashboardUrl();

  function getFromParam(): string | undefined {
    if (fromParam) {
      return new Date(fromParam).toISOString();
    } else {
      return undefined;
    }
  }

  function getToParam(): string | undefined {
    if (toParam) {
      return new Date(toParam).toISOString();
    } else {
      return undefined;
    }
  }

  const { data: chartData } = useQuery({
    queryKey: [
      "chart",
      series,
      grouping,
      rollingAverage,
      fromParam,
      toParam,
      span,
    ],
    queryFn: async () => {
      const res = await fetch(
        addQueryParamsIfExist(`${apiURL}/api/series`, {
          grouping,
          rolling_average: parseInt(rollingAverage),
          from: getFromParam(),
          to: getToParam(),
          span,
        } satisfies SeriesParams)
      );
      return (await res.json()) as FullChatCountStruct[];
    },
    refetchInterval: 10000,
    keepPreviousData: true,
  });

  const chartRef = useRef<HTMLDivElement | null>(null);

  const emoteSeries =
    series.map((key) => ({
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

  const lowestTime = chartData?.[0]?.time ?? 0;
  const highestTime = chartData?.[chartData.length - 1]?.time ?? 0;

  let timeRangeString = "";
  if (lowestTime && highestTime) {
    const lowestDate = new Date(lowestTime * 1000);
    const highestDate = new Date(highestTime * 1000);
    timeRangeString = `${lowestDate.toLocaleString()} - ${highestDate.toLocaleString()}`;
  }

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

  function getNewSeriesList(emote: string) {
    if (series.includes(emote)) {
      return series.filter((item) => item !== emote);
    } else {
      return [...series, emote];
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 lg:p-5 flex flex-col gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="flex flex-col gap-3">
          <h1 className={"text-2xl m-5 font-semibold flex flex-col gap-4"}>
            <span className="flex justify-between">
              NL chat emote usage <LiveStatus />
            </span>
            <span className="text-gray-600 text-base">{timeRangeString}</span>
          </h1>
          <div ref={chartRef}>
            <HighchartsReact
              highcharts={Highcharts}
              options={highChartsOptions}
            />
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <label>
              Time range
              <DateRangePicker
                value={{
                  from: getFromParam(),
                  to: getToParam(),
                }}
                onValueChange={(value: DateRangePickerValue) => {
                  if (
                    value.selectValue &&
                    timeSinceLiveSet.has(
                      value.selectValue as "1 minute" | "1 hour" | "9 hours"
                    )
                  ) {
                    return handleNavigate({
                      from: undefined,
                      to: undefined,
                      span: value.selectValue,
                    });
                  }
                  return handleNavigate({
                    from: value.from?.toISOString(),
                    to: value.to?.toISOString(),
                    span: "custom",
                  });
                }}
                selectPlaceholder="Select a range"
              >
                {
                  ["1 minute", "1 hour", "9 hours"].map((s) => (
                    <DateRangePickerItem
                      key={s}
                      value={s}
                      from={new Date()}
                      to={new Date()}
                    >
                      {s}
                    </DateRangePickerItem>
                  )) as any
                }
                <DateRangePickerItem
                  key="week"
                  value="week"
                  from={
                    new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000)
                  }
                  to={new Date()}
                >
                  Past week
                </DateRangePickerItem>
                <DateRangePickerItem
                  key="half"
                  value="half"
                  from={
                    new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000)
                  }
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
            </label>
            <label>
              Group By
              <Select
                className="w-40"
                id="groupBySelect"
                value={grouping}
                placeholder={"Group by"}
                onValueChange={(value) =>
                  handleNavigate({
                    timeGrouping: value,
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
                className="w-40"
                id="smoothing"
                value={rollingAverage.toString()}
                placeholder={"Smoothing"}
                onValueChange={(value) =>
                  handleNavigate({
                    rollingAverage: value,
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
                className="w-40"
                id="chartTypeSelect"
                value={chartType}
                placeholder={"Chart type"}
                onValueChange={(value) =>
                  handleNavigate({
                    chartType: value,
                  })
                }
              >
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
              </Select>
            </label>
          </div>

          <div className="flex flex-col p-3">
            <div className="flex flex-row flex-wrap gap-3 m-2">
              {Object.keys(seriesColors).map((key) => (
                <button
                  className={"w-auto hover:shadow-lg rounded-lg p-3"}
                  style={
                    series.includes(key as SeriesKey)
                      ? {
                          boxShadow: `0 0 0 4px ${
                            seriesColors[key as SeriesKey]
                          }`,
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
          </div>
        </Card>

        <div className={"flex flex-col gap-8"}>
          <TwitchClipAtTime />
          <TopTwitchClips />
          <MostMinusTwosClips />
        </div>
      </div>
    </div>
  );
}

export interface SettingsDropLayoutProps {
  children?: React.ReactNode;
}

export function SettingsDropLayout({ children }: SettingsDropLayoutProps) {
  return <div className="flex gap-8 flex-wrap">{children}</div>;
}

function TwitchClipAtTime() {
  const {
    currentParams: { clickedUnixSeconds },
  } = useDashboardUrl();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["clip", clickedUnixSeconds],
    queryFn: async () => {
      const res = await fetch(`${apiURL}/api/clip?time=${clickedUnixSeconds}`);
      return (await res.json()) as Clip;
    },
    keepPreviousData: true,
  });

  if (!clickedUnixSeconds) {
    return <div>Select a point on the graph to pull the nearest clip.</div>;
  }

  if (isLoading) {
    return <div className="text-center">Loading...</div>;
  }

  if (isError) {
    return <div className="text-center">Error loading clip</div>;
  }

  return <TwitchClip clip_id={data.clip_id} time={data.time} />;
}

export function TwitchClip({
  clip_id,
  time,
}: {
  clip_id: string;
  time?: string;
}) {
  return (
    <span>
      {time && (
        <span className={"m-5 text-center text-gray-500"}>
          {new Date(time).toLocaleString()}
        </span>
      )}
      <iframe
        src={`https://clips.twitch.tv/embed?clip=${clip_id}&parent=${window.location.hostname}`}
        width="100%"
        className="aspect-video"
        allowFullScreen={true}
      />
    </span>
  );
}

export const seriesEmotes: Record<SeriesKey, React.ReactNode> = {
  two: <div className={"text-xl "}>∑ ± 2</div>,
  lol: <Emote src={"lul.jpg"} />,
  cereal: <Emote src={"cereal.webp"} />,
  monkas: <Emote src={"monkaS.webp"} />,
  joel: <Emote src={"Joel.webp"} />,
  pog: <Emote src={"Pog.webp"} />,
  huh: <Emote src={"huhh.webp"} />,
  no: <Emote src={"nooo.webp"} />,
  cocka: <Emote src={"cocka.webp"} />,
  shock: <Emote src={"shockface.png"} />,
  who_asked: <Emote src={"whoasked.webp"} />,
  copium: <Emote src={"copium.webp"} />,
  ratjam: <Emote src={"ratJAM.webp"} />,
  sure: <Emote src={"sure.webp"} />,
  classic: <Emote src={"classic.webp"} />,
  monka_giga: <Emote src={"monkaGiga.webp"} />,
  caught: <Emote src={"caught.webp"} />,
  life: <Emote src={"life.webp"} />,
} as const;

export function Emote({ src }: { src: string }) {
  return <Image src={`/${src}`} alt={src} width={32} height={32} />;
}

export function LiveStatus() {
  const { data: nlIsLive } = useLiveStatus();
  if (nlIsLive) {
    return (
      <span className="flex gap-2 items-center">
        <span className="bg-green-500 rounded rounded-full w-4 h-4" />
        <a
          href="https://twitch.tv/northernlion"
          target="_blank"
          className="underline"
        >
          Live
        </a>
      </span>
    );
  }
  return <span className="text-gray-500">Offline</span>;
}

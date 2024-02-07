"use client";

import {
  Tab,
  Select,
  SelectItem,
  Card,
  Button,
  DateRangePicker,
  DateRangePickerItem,
  DateRangePickerValue,
} from "@tremor/react";
import { CSSProperties, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import Image from "next/image";
import { useClickAway } from "react-use";
import {
  SeriesKey,
  SeriesData,
  FullChatCountStruct,
  SeriesParams,
} from "./types";
import { MostMinusTwosClips } from "./minus-two-clips";
import { TopTwitchClips } from "./top-twitch-clips";
import { useDashboardUrl } from "@/app/hooks";
import { timeGroupings, GET, addQueryParamsIfExist } from "@/app/utils";
import { apiURL } from "@/app/apiURL";

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
  const [clickedUnixSeconds, setClickedUnixSeconds] = useState<
    number | undefined
  >(undefined);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | undefined>(
    undefined
  );

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

  function getFromParam(): Date {
    if (fromParam) {
      return new Date(fromParam);
    } else {
      return new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    }
  }

  function getToParam(): Date {
    if (toParam) {
      return new Date(toParam);
    } else {
      return new Date();
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
          from: getFromParam().toISOString(),
          to: getToParam().toISOString(),
          span,
        } satisfies SeriesParams)
      );
      return (await res.json()) as FullChatCountStruct[];
    },
    refetchInterval: 10000,
    keepPreviousData: true,
  });

  const chartRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  useClickAway(chartRef, () => setTooltip(undefined));

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
          setClickedUnixSeconds(e.point.x / 1000);
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
        point: {
          events: {
            click: function (e: any) {
              const chart = this.series.chart;
              if (this.plotX && this.plotY) {
                setTooltip({
                  x: this.plotX + chart.plotLeft,
                  y: this.plotY + chart.plotTop,
                });
              }
            },
          },
        },
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
            setClickedUnixSeconds(xVal / 1000);
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

  function getTooltipStyle(): CSSProperties {
    if (window.innerWidth < 768) {
      return {
        position: "absolute",
        top: tooltip?.y ?? 0,
        left: "0",
        transform: "translate('-50%', '-50%')",
      };
    }
    let xDistance = "-50%";
    let yDistance = "-10%";
    if (tooltip && tooltipRef.current) {
      if (tooltip.x + tooltipRef.current.clientWidth > window.innerWidth) {
        xDistance = "-100%";
      } else if (tooltip.x - tooltipRef.current.clientWidth < 0) {
        xDistance = "0%";
      }
    }
    return {
      position: "absolute",
      top: tooltip?.y,
      left: tooltip?.x,
      transform: `translate(${xDistance}, ${yDistance})`,
    };
  }

  function getNewSeriesList(emote: string) {
    if (series.includes(emote)) {
      return series.filter((item) => item !== emote);
    } else {
      return [...series, emote];
    }
  }

  const last9HoursRange = {
    from: undefined,
    to: undefined,
    span: "9 hours",
  };

  const lastHourRange = {
    from: undefined,
    to: undefined,
    span: "1 hour",
  };

  const lastMinuteRange = {
    from: undefined,
    to: undefined,
    span: "1 minute",
  };

  return (
    <div className="min-h-screen bg-gray-100 lg:p-8 flex flex-col gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="flex flex-col gap-3">
          <h1 className={"text-2xl m-5 font-semibold flex flex-col gap-4"}>
            NL chat emote usage{" "}
            <span className="text-gray-600 text-base">{timeRangeString}</span>
          </h1>
          <div ref={chartRef}>
            <HighchartsReact
              highcharts={Highcharts}
              options={highChartsOptions}
            />

            {tooltip && (
              <div
                className={"w-96 transition-all"}
                style={getTooltipStyle()}
                ref={tooltipRef}
              >
                <button
                  onClick={() => setTooltip(undefined)}
                  className={"absolute -top-10 right-0 p-5 bg-white rounded"}
                >
                  X
                </button>
                {clickedUnixSeconds ? (
                  <TwitchClipAtTime time={clickedUnixSeconds} />
                ) : null}
              </div>
            )}
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
          <SettingsDropLayout>
            <Button
              onClick={() => handleNavigate(lastMinuteRange)}
              variant={span === "1 minute" ? "primary" : "secondary"}
            >
              Last minute of stream
            </Button>
            <Button
              onClick={() => handleNavigate(lastHourRange)}
              variant={span === "1 hour" ? "primary" : "secondary"}
            >
              Last hour of stream
            </Button>
            <Button
              onClick={() => handleNavigate(last9HoursRange)}
              variant={
                span === "9 hours" || span === null ? "primary" : "secondary"
              }
            >
              Last 9 hours of stream
            </Button>
            <DateRangePicker
              value={{
                from: getFromParam(),
                to: getToParam(),
              }}
              onValueChange={(value: DateRangePickerValue) =>
                handleNavigate({
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
          </SettingsDropLayout>

          <span className="text-center">
            Select a point in the graph to pull the nearest clip
          </span>
        </Card>

        <div className={"flex flex-col gap-8"}>
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

type ClipData = {
  clip_id: string;
  time: number;
};

function TwitchClipAtTime(props: { time: number }) {
  const { isSuccess, data } = useQuery({
    queryKey: ["clip", props.time],
    queryFn: async () => {
      const res = await fetch(
        `https://nljokeval-production.up.railway.app/api/clip?time=${props.time}`
      );
      return (await res.json()) as ClipData;
    },
    keepPreviousData: true,
  });
  return (
    data &&
    isSuccess &&
    props.time &&
    data.clip_id && <TwitchClip clip_id={data.clip_id} time={props.time} />
  );
}

export function TwitchClip({
  clip_id,
  time,
}: {
  clip_id: string;
  time?: number;
}) {
  return (
    <span>
      {time && (
        <span className={"m-5 text-center text-gray-500"}>
          {new Date(time * 1000).toLocaleString()}
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

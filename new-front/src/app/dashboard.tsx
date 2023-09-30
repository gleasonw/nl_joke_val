"use client";

import {
  Title,
  Tab,
  Text,
  Select,
  SelectItem,
  Card,
  List,
  ListItem,
  Button,
  DateRangePicker,
  DateRangePickerItem,
  DateRangePickerValue,
} from "@tremor/react";
import { CSSProperties, useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import Image from "next/image";
import { useClickAway } from "react-use";
import { useSearchParams, useRouter } from "next/navigation";
import { addQueryParamsIfExist } from "@/app/utils";
import {
  SeriesDataSchema,
  SeriesKeys,
  timeGroupings,
  seriesColors,
  SeriesKey,
  SeriesData,
} from "./types";

export default function Dashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const series =
    params.getAll("series").length > 0 ? params.getAll("series") : ["two"];

  const chartType = params.get("chartType") ?? "line";
  const grouping = params.get("timeGrouping") ?? "minute";
  const rollingAverage = params.get("rollingAverage") ?? "5";
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const trailingSpan = params.get("span") ?? "9 hours";

  const [clickedUnixSeconds, setClickedUnixSeconds] = useState<
    number | undefined
  >(undefined);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | undefined>(
    undefined
  );

  const handleNavigate = useCallback(
    (newParam: { [key: string]: string | string[] | undefined }) => {
      const paramsObject: { [key: string]: string | string[] } = {};
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

  const SeriesData = SeriesDataSchema.array();

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

  const queryClient = useQueryClient();
  console.log(queryClient.getQueryCache());

  const { data: chartData } = useQuery({
    queryKey: ["chart", series, grouping, rollingAverage, fromParam, toParam],
    queryFn: async () => {
      const res = await fetch(
        addQueryParamsIfExist(
          `https://nljokeval-production.up.railway.app/api/series`,
          {
            grouping,
            rolling_average: rollingAverage,
            from: getFromParam().toISOString(),
            to: getToParam().toISOString(),
            span: trailingSpan,
          }
        )
      );
      const jsonResponse = await res.json();
      const zodParse = SeriesData.safeParse(jsonResponse);

      if (zodParse.success) {
        return zodParse.data;
      } else {
        console.error(zodParse.error);
        throw new Error("Failed to parse data");
      }
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
      color: seriesColors[key as keyof typeof SeriesKeys],
      events: {
        click: function (e: any) {
          setClickedUnixSeconds(e.point.x / 1000);
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

  const span = params.get("span");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={"text-2xl m-5 font-semibold"}>
          NL Chat Dashboard (est. 4/18/23)
        </h1>
        <div className="flex gap-5 justify-center">
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
            value={{ from: getFromParam(), to: getToParam() }}
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
        </div>

        <div className="flex flex-col p-3">
          <div className="flex flex-row flex-wrap gap-3 m-2">
            {Object.keys(SeriesKeys).map((key) => (
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
          <div className={"flex flex-row gap-5 flex-wrap items-center w-full"}>
            <div className="flex flex-col">
              <label htmlFor="chartTypeSelect">Chart Type</label>
              <Select
                id="chartTypeSelect"
                value={params.get("chartType") ?? "line"}
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
            </div>

            <div className="flex flex-col">
              <label htmlFor="groupBySelect">Group By</label>
              <Select
                id="groupBySelect"
                value={params.get("timeGrouping") ?? "minute"}
                placeholder={"Group by"}
                onValueChange={(value) =>
                  handleNavigate({ timeGrouping: value })
                }
              >
                {timeGroupings.map((grouping) => (
                  <SelectItem value={grouping} key={grouping} />
                ))}
              </Select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="groupBySelect">Smoothing</label>
              <Select
                id="smoothing"
                value={params.get("rollingAverage") ?? "5"}
                placeholder={"Smoothing"}
                onValueChange={(value) =>
                  handleNavigate({ rollingAverage: value })
                }
              >
                {[0, 5, 10, 15, 30, 60].map((smoothing) => (
                  <SelectItem value={smoothing.toString()} key={smoothing}>
                    {smoothing === 0 ? "None" : smoothing}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <span className="text-center">
              Select a point in the graph to pull the nearest clip
            </span>
          </div>
        </div>
      </div>
      <div ref={chartRef}>
        <HighchartsReact highcharts={Highcharts} options={highChartsOptions} />
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
            <TwitchClipAtTime time={clickedUnixSeconds} />
          </div>
        )}
      </div>

      <div className={"flex flex-wrap md:flex-nowrap md:gap-5"}>
        <TopTwitchClips onNavigate={handleNavigate} />
        <MostMinusTwosClips onNavigate={handleNavigate} />
      </div>
    </div>
  );
}

function TwitchClipAtTime(props: { time?: number }) {
  type ClipData = {
    clip_id: string;
    time: number;
  };

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
    props.time && <TwitchClip clip_id={data.clip_id} time={props.time} />
  );
}

type Clip = {
  clip_id: string;
  count: number;
  time: number;
  thumbnail: string;
};

export type ClipBatch = {
  clips: Clip[];
};

function TopTwitchClips({
  onNavigate,
}: {
  onNavigate: (newParam: { [key: string]: string | string[] }) => void;
}) {
  const [sumEmotes, setSumEmotes] = useState(false);
  const params = useSearchParams();
  const emotes =
    params.getAll("emote").length > 0 ? params.getAll("emote") : ["two"];
  const grouping = params.get("maxClipGrouping") ?? "second";
  const span = params.get("maxClipSpan") ?? "day";

  const {
    isSuccess,
    data: topClips,
    isLoading,
  } = useQuery({
    queryKey: ["top_clips", span, grouping, emotes],
    queryFn: async () => {
      const res = await fetch(
        addQueryParamsIfExist(
          "https://nljokeval-production.up.railway.app/api/clip_counts",
          {
            column: emotes,
            span,
            grouping,
            order: "desc",
          }
        )
      );
      return (await res.json()) as ClipBatch;
    },
    keepPreviousData: true,
  });

  return (
    <Card>
      <div className={"flex flex-col gap-2"}>
        <Title>Top</Title>
        <div className="flex flex-row flex-wrap gap-3">
          {Object.keys(SeriesKeys).map((key) => (
            <button
              className={"w-auto hover:shadow-lg rounded-lg p-3"}
              style={
                emotes.includes(key as SeriesKey)
                  ? {
                      boxShadow: `0 0 0 4px ${seriesColors[key as SeriesKey]}`,
                    }
                  : {}
              }
              key={key}
              onClick={() =>
                onNavigate(
                  emotes.includes(key as SeriesKey)
                    ? {
                        emote: emotes.filter((item) => item !== key),
                      }
                    : sumEmotes
                    ? { emote: [...emotes, key] }
                    : { emote: [key] }
                )
              }
            >
              {seriesEmotes[key as SeriesKey]}
            </button>
          ))}
        </div>
        <Button
          onClick={() => setSumEmotes(!sumEmotes)}
          variant={sumEmotes ? "primary" : "secondary"}
        >
          Sum multiple emotes
        </Button>
        <Title>grouped by</Title>
        <Select
          value={grouping}
          onValueChange={(value) => onNavigate({ maxClipGrouping: value })}
        >
          {timeGroupings.map((grouping) => (
            <SelectItem value={grouping} key={grouping}>
              {grouping == "second" ? "10 seconds" : grouping}
            </SelectItem>
          ))}
        </Select>
        <Title>over the past</Title>
        <Select
          value={span}
          onValueChange={(value) => onNavigate({ maxClipSpan: value })}
        >
          {["day", "week", "month", "year"].map((span) => (
            <SelectItem value={span} key={span}>
              {span}
            </SelectItem>
          ))}
        </Select>
      </div>
      <div>
        <List>
          {topClips?.clips
            .sort((a, b) => b.count - a.count)
            .map((clip) => (
              <ListItem key={clip.clip_id} className={"flex flex-col"}>
                <span className={"text-3xl"}>{clip.count}</span>
                <TwitchClipThumbnail
                  clip_id={clip.clip_id}
                  time={clip.time}
                  thumbnail={clip.thumbnail}
                  count={clip.count}
                />
              </ListItem>
            ))}
        </List>
      </div>
    </Card>
  );
}

function MostMinusTwosClips({
  onNavigate,
}: {
  onNavigate: (newParam: { [key: string]: string | string[] }) => void;
}) {
  const params = useSearchParams();
  const grouping = params.get("minClipGrouping") ?? "second";
  const span = params.get("minClipSpan") ?? "day";

  const {
    isSuccess,
    data: minClips,
    isLoading,
  } = useQuery({
    queryKey: ["minus_twos", span, grouping],
    queryFn: async () => {
      const rest = await fetch(
        addQueryParamsIfExist(
          "https://nljokeval-production.up.railway.app/api/clip_counts",
          {
            column: "two",
            span,
            grouping,
            order: "asc",
          }
        )
      );
      return (await rest.json()) as ClipBatch;
    },
    keepPreviousData: true,
  });

  return (
    <Card>
      <div className={"flex flex-row gap-2 flex-wrap"}>
        <Title>Lowest 2 count grouped by</Title>
        <Select
          value={grouping}
          onValueChange={(value) => onNavigate({ minClipGrouping: value })}
        >
          {["second", "minute", "hour"].map((grouping) => (
            <SelectItem value={grouping} key={grouping}>
              {grouping == "second" ? "10 seconds" : grouping}
            </SelectItem>
          ))}
        </Select>
        <Title>over the past</Title>
        <Select
          value={span}
          onValueChange={(value) => onNavigate({ minClipSpan: value })}
        >
          {["day", "week", "month", "year"].map((span) => (
            <SelectItem value={span} key={span}>
              {span}
            </SelectItem>
          ))}
        </Select>
      </div>
      <div>
        <List>
          {minClips?.clips.map((clip) => (
            <ListItem key={clip.clip_id} className={"flex flex-col"}>
              <span className={"text-3xl"}>{clip.count}</span>
              <TwitchClipThumbnail
                clip_id={clip.clip_id}
                time={clip.time}
                thumbnail={clip.thumbnail}
                count={clip.count}
              />
            </ListItem>
          ))}
        </List>
      </div>
    </Card>
  );
}

function TwitchClipThumbnail({ clip_id, count, time, thumbnail }: Clip) {
  const [isClipRevealed, setIsClipRevealed] = useState(false);
  const timeString = new Date(time * 1000).toLocaleString();
  if (isClipRevealed) {
    return <TwitchClip clip_id={clip_id} time={time} />;
  } else {
    return (
      <button
        className={"flex flex-col items-center justify-between"}
        onClick={() => setIsClipRevealed(true)}
      >
        <Text className={"text-lg"}>{timeString}</Text>
        <Image
          alt={`Twitch clip thumbnail at ${timeString}, with ${count} ${
            count === 1 ? "emote" : "emotes"
          }`}
          src={thumbnail}
          onClick={() => setIsClipRevealed(true)}
          width={384}
          height={218}
        />
      </button>
    );
  }
}

function TwitchClip({ clip_id, time }: { clip_id: string; time?: number }) {
  return (
    <>
      {time && (
        <span className={"m-5 text-center text-xl"}>
          {new Date(time * 1000).toLocaleString()}
        </span>
      )}
      <iframe
        src={`https://clips.twitch.tv/embed?clip=${clip_id}&parent=${window.location.hostname}`}
        width="100%"
        className="aspect-video"
        allowFullScreen={true}
      />
    </>
  );
}

export const seriesEmotes: Record<SeriesKey, React.ReactNode> = {
  [SeriesKeys.two]: <div className={"text-xl "}>∑ ± 2</div>,
  [SeriesKeys.lol]: <Emote src={"lul.jpg"} />,
  [SeriesKeys.cereal]: <Emote src={"cereal.webp"} />,
  [SeriesKeys.monkas]: <Emote src={"monkaS.webp"} />,
  [SeriesKeys.joel]: <Emote src={"Joel.webp"} />,
  [SeriesKeys.pog]: <Emote src={"Pog.webp"} />,
  [SeriesKeys.huh]: <Emote src={"huhh.webp"} />,
  [SeriesKeys.no]: <Emote src={"nooo.webp"} />,
  [SeriesKeys.cocka]: <Emote src={"cocka.webp"} />,
  [SeriesKeys.shock]: <Emote src={"shockface.png"} />,
  [SeriesKeys.who_asked]: <Emote src={"whoasked.webp"} />,
  [SeriesKeys.copium]: <Emote src={"copium.webp"} />,
  [SeriesKeys.ratjam]: <Emote src={"ratJAM.webp"} />,
} as const;

export function Emote({ src }: { src: string }) {
  return <Image src={`/${src}`} alt={src} width={32} height={32} />;
}

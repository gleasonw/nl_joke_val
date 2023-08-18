"use client";

import {
  Grid,
  Col,
  Title,
  TabGroup,
  TabList,
  Tab,
  Text,
  Select,
  SelectItem,
  MultiSelect,
  MultiSelectItem,
  Card,
  List,
  ListItem,
} from "@tremor/react";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import Highcharts, { RectangleObject } from "highcharts";
import HighchartsReact from "highcharts-react-official";
import Image from "next/image";
import { DataProps } from "@/components/App";
import { InitialArgState } from "@/app/page";
import { useClickAway } from "react-use";

const SeriesKeys = {
  two: "two",
  lol: "lol",
  cereal: "cereal",
  monkas: "monkas",
  joel: "joel",
  pog: "pog",
  huh: "huh",
  no: "no",
  cocka: "cocka",
  shock: "shock",
  who_asked: "who_asked",
  copium: "copium",
  ratjam: "ratjam",
} as const;

type SeriesKey = (typeof SeriesKeys)[keyof typeof SeriesKeys];

const seriesColors: Record<SeriesKey, string> = {
  [SeriesKeys.two]: "#7cb5ec",
  [SeriesKeys.lol]: "#434348",
  [SeriesKeys.cereal]: "#90ed7d",
  [SeriesKeys.monkas]: "#f7a35c",
  [SeriesKeys.joel]: "#8085e9",
  [SeriesKeys.pog]: "#f15c80",
  [SeriesKeys.huh]: "#e4d354",
  [SeriesKeys.no]: "#2b908f",
  [SeriesKeys.cocka]: "#f45b5b",
  [SeriesKeys.shock]: "#8d4654",
  [SeriesKeys.who_asked]: "#91e8e1",
  [SeriesKeys.copium]: "#696969",
  [SeriesKeys.ratjam]: "#000000",
} as const;

const seriesEmotes: Record<SeriesKey, React.ReactNode> = {
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

function Emote({ src }: { src: string }) {
  return <Image src={`/${src}`} alt={src} width={32} height={32} />;
}

const SeriesDataSchema = z.object({
  [SeriesKeys.two]: z.number(),
  [SeriesKeys.lol]: z.number(),
  [SeriesKeys.cereal]: z.number(),
  [SeriesKeys.monkas]: z.number(),
  [SeriesKeys.joel]: z.number(),
  [SeriesKeys.pog]: z.number(),
  [SeriesKeys.huh]: z.number(),
  [SeriesKeys.no]: z.number(),
  [SeriesKeys.cocka]: z.number(),
  [SeriesKeys.shock]: z.number(),
  [SeriesKeys.who_asked]: z.number(),
  [SeriesKeys.copium]: z.number(),
  [SeriesKeys.ratjam]: z.number(),
  time: z.number(),
});

export type SeriesData = z.infer<typeof SeriesDataSchema>;

const timeSpans = [
  "1 minute",
  "1 hour",
  "9 hours",
  "1 week",
  "1 month",
  "1 year",
] as const;

const timeGroupings = [
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;

export type TimeSpans = (typeof timeSpans)[number];
export type TimeGroupings = (typeof timeGroupings)[number];

export default function Dashboard(props: DataProps) {
  const initArgs = props.initialArgState.chart;
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [functionType, setFunctionType] = useState<"rolling_sum" | "instant">(
    initArgs.functionType
  );
  const [series, setSeries] = useState<SeriesKey[]>([SeriesKeys.two]);

  const [timeSpan, setTimeSpan] = useState<TimeSpans>(initArgs.timeSpan);
  const [grouping, setGrouping] = useState<
    "second" | "minute" | "hour" | "day" | "week" | "month" | "year"
  >(initArgs.timeGrouping);
  const [clickedUnixSeconds, setClickedUnixSeconds] = useState<
    number | undefined
  >(undefined);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | undefined>(
    undefined
  );

  const SeriesData = SeriesDataSchema.array();
  const chartData = useQuery({
    queryKey: [functionType, timeSpan, grouping],
    queryFn: async () => {
      const res = await fetch(
        `https://nljokeval-production.up.railway.app/api/${functionType}?span=${timeSpan}&grouping=${grouping}`
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
    placeholderData: props.initialSeries,
  });

  const chartRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  useClickAway(chartRef, () => setTooltip(undefined));

  const emoteSeries =
    series.map((key) => ({
      name: key,
      data:
        chartData.data?.map((d) => [d.time * 1000 ?? 0, d[key] ?? ""]) ?? [],
      color: seriesColors[key as keyof typeof seriesColors],
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

  function getTooltipStyle() {
    if (window.innerWidth < 768) {
      return {
        position: "absolute",
        top: tooltip?.y,
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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className={"text-2xl m-5 font-semibold"}>
          NL Chat Dashboard (est. 4/18/23)
        </h1>
        <TabGroup
          defaultIndex={1}
          onIndexChange={(i) => {
            setTimeSpan(timeSpans[i]);
            if (["1 week", "1 month", "1 year"].includes(timeSpans[i])) {
              setGrouping("day");
            }
          }}
        >
          <TabList>
            <Tab>1M</Tab>
            <Tab>1H</Tab>
            <Tab>9H</Tab>
            <Tab>1W</Tab>
            <Tab>1M</Tab>
            <Tab>6M</Tab>
          </TabList>
        </TabGroup>
        <div className="flex flex-col">
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
                  series.includes(key as SeriesKey)
                    ? setSeries(series.filter((series) => series !== key))
                    : setSeries([...series, key as SeriesKey]);
                }}
              >
                {seriesEmotes[key as SeriesKey]}
              </button>
            ))}
          </div>
          <span className="text-center w-full m-5">
            Select a point in the graph to pull the nearest clip
          </span>
        </div>
        {chartData.isSuccess && (
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
                <TwitchClipAtTime time={clickedUnixSeconds} />
              </div>
            )}
          </div>
        )}
        <div
          className={
            "flex flex-row gap-5 justify-center flex-wrap items-center w-full"
          }
        >
          <div className="flex flex-col">
            <label htmlFor="chartTypeSelect">Chart Type</label>
            <Select
              id="chartTypeSelect"
              value={chartType}
              placeholder={"Chart type"}
              onValueChange={(value) => setChartType(value as "line" | "bar")}
            >
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
            </Select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="sumTypeSelect">Sum Type</label>
            <Select
              id="sumTypeSelect"
              value={functionType}
              placeholder={"Sum type"}
              onValueChange={(value) =>
                setFunctionType(value as "rolling_sum" | "instant")
              }
            >
              <SelectItem value="rolling_sum">Rolling sum</SelectItem>
              <SelectItem value="instant">Instant</SelectItem>
            </Select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="groupBySelect">Group By</label>
            <Select
              id="groupBySelect"
              value={grouping}
              placeholder={"Group by"}
              onValueChange={(value) => setGrouping(value as TimeGroupings)}
            >
              {timeGroupings.map((grouping) => (
                <SelectItem value={grouping} key={grouping} />
              ))}
            </Select>
          </div>
        </div>
      </div>
      <div className={"flex flex-wrap md:flex-nowrap md:gap-5"}>
        <TopTwitchClips
          initialClips={props.initialMaxClips}
          initialState={props.initialArgState.clips}
        />
        <MostMinusTwosClips
          initialClips={props.initialMinClips}
          initialState={props.initialArgState.clips}
        />
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
  initialClips,
  initialState,
}: {
  initialClips: ClipBatch;
  initialState: InitialArgState["clips"];
}) {
  const [timeSpan, setTimeSpan] = useState<
    "day" | "week" | "month" | "year" | ""
  >(initialState.clipTimeSpan);
  const [grouping, setGrouping] = useState<TimeGroupings>("second");
  const [emote, setEmote] = useState<keyof typeof SeriesKeys>(
    initialState.emote
  );

  const { isSuccess, data, isLoading } = useQuery({
    queryKey: ["top_clips", timeSpan, grouping, emote],
    queryFn: async () => {
      const res = await fetch(
        `https://nljokeval-production.up.railway.app/api/clip_counts?column=${emote}&span=${timeSpan}&grouping=${grouping}&order=desc`
      );
      return (await res.json()) as ClipBatch;
    },
    placeholderData: initialClips,
    keepPreviousData: true,
  });

  return (
    <Card>
      {isLoading && <Text>Loading...</Text>}
      <div className={"flex flex-row gap-2 flex-wrap"}>
        <Title>Top</Title>
        <div className="flex flex-row flex-wrap gap-3">
          {Object.keys(SeriesKeys).map((key) => (
            <button
              className={"w-auto hover:shadow-lg rounded-lg p-3"}
              style={
                emote === key
                  ? {
                      boxShadow: `0 0 0 4px ${seriesColors[key as SeriesKey]}`,
                    }
                  : {}
              }
              key={key}
              onClick={() => setEmote(key as SeriesKey)}
            >
              {seriesEmotes[key as SeriesKey]}
            </button>
          ))}
        </div>
        <Title>grouped by</Title>
        <Select
          value={grouping}
          onValueChange={(value) => setGrouping(value as any)}
        >
          {timeGroupings.map((grouping) => (
            <SelectItem value={grouping} key={grouping}>
              {grouping == "second" ? "10 seconds" : grouping}
            </SelectItem>
          ))}
        </Select>
        <Title>over the past</Title>
        <Select
          value={timeSpan}
          onValueChange={(value) => setTimeSpan(value as any)}
        >
          {["day", "week", "month", "year"].map((span) => (
            <SelectItem value={span} key={span}>
              {span}
            </SelectItem>
          ))}
        </Select>
      </div>
      <div>
        {isSuccess && (
          <List>
            {data?.clips
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
        )}
      </div>
    </Card>
  );
}

function MostMinusTwosClips({
  initialClips,
  initialState,
}: {
  initialClips: ClipBatch;
  initialState: InitialArgState["clips"];
}) {
  const [timeSpan, setTimeSpan] = useState<
    "day" | "week" | "month" | "year" | ""
  >(initialState.clipTimeSpan);
  const [grouping, setGrouping] = useState<TimeGroupings>("second");

  const { isSuccess, data, isLoading } = useQuery({
    queryKey: ["minus_twos", timeSpan, grouping],
    queryFn: async () => {
      const rest = await fetch(
        `https://nljokeval-production.up.railway.app/api/clip_counts?span=${timeSpan}&grouping=${grouping}&column=two&order=asc`
      );
      return (await rest.json()) as ClipBatch;
    },
    initialData: initialClips,
    keepPreviousData: true,
  });

  if (isLoading) {
    return <Text>Loading...</Text>;
  } else if (isSuccess) {
    return (
      <Card>
        <div className={"flex flex-row gap-2 flex-wrap"}>
          <Title>Lowest 2 count grouped by</Title>
          <Select
            value={grouping}
            onValueChange={(value) => setGrouping(value as any)}
          >
            {["second", "minute", "hour"].map((grouping) => (
              <SelectItem value={grouping} key={grouping}>
                {grouping == "second" ? "10 seconds" : grouping}
              </SelectItem>
            ))}
          </Select>
          <Title>over the past</Title>
          <Select
            value={timeSpan}
            onValueChange={(value) => setTimeSpan(value as any)}
          >
            {["day", "week", "month", "year"].map((span) => (
              <SelectItem value={span} key={span}>
                {span}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div>
          {isSuccess && (
            <List>
              {data?.clips.map((clip) => (
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
          )}
        </div>
      </Card>
    );
  }
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

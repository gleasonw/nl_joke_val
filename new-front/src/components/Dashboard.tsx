"use client";

import {
  Grid,
  Col,
  Title,
  TabGroup,
  TabList,
  Tab,
  Text,
  Flex,
  Select,
  SelectItem,
  MultiSelect,
  MultiSelectItem,
  Card,
  Metric,
  List,
  ListItem,
} from "@tremor/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import Image from "next/image";
import { DataProps } from "@/components/App";
import { InitialArgState } from "@/app/page";
import { init } from "next/dist/compiled/@vercel/og/satori";

enum SeriesKeys {
  two = "two",
  lol = "lol",
  cereal = "cereal",
  monkas = "monkas",
  joel = "joel",
  pog = "pog",
  huh = "huh",
  no = "no",
  cocka = "cocka",
  shock = "shock",
  who_asked = "who_asked",
  copium = "copium",
}

const seriesColors: Record<SeriesKeys, string> = {
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
};

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
  const [series, setSeries] = useState<SeriesKeys[]>([SeriesKeys.two]);

  const [timeSpan, setTimeSpan] = useState<TimeSpans>(initArgs.timeSpan);
  const [grouping, setGrouping] = useState<
    "second" | "minute" | "hour" | "day" | "week" | "month" | "year"
  >(initArgs.timeGrouping);
  const [clickedUnixSeconds, setClickedUnixSeconds] = useState<
    number | undefined
  >(Date.now() / 1000);

  const SeriesData = SeriesDataSchema.array();
  const chartData = useQuery({
    queryKey: [functionType, timeSpan, grouping],
    queryFn: async () => {
      const res = await fetch(
        `https://nljokeval-production.up.railway.app/api/${functionType}?span=${timeSpan}&grouping=${grouping}`
      );
      const jsonResponse = await res.json();
      const data = SeriesData.safeParse(jsonResponse);
      if (data.success) {
        return data.data;
      } else {
        console.error(data.error);
        throw new Error("Failed to parse data");
      }
    },
    refetchInterval: 10000,
    keepPreviousData: true,
    initialData: props.initialSeries,
  });

  const emoteSeries =
    series.map((key) => ({
      name: key,
      data: chartData.data?.map((d) => [d.time * 1000 ?? 0, d[key] ?? ""]),
      color: seriesColors[key as keyof typeof seriesColors],
      events: {
        click: function (e: any) {
          setClickedUnixSeconds(e.point.x / 1000);
        },
      },
    })) || ([] as Highcharts.SeriesOptionsType[]);

  console.log(emoteSeries);

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

  return (
    <Grid numItems={1} numItemsLg={2} className="gap-5">
      <Col numColSpan={1}>
        <h1 className={"text-2xl m-5 font-semibold"}>
          NL Chat Dashboard (est. 4/18/23)
        </h1>
        <TabGroup
          defaultIndex={2}
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
        <div className={"flex flex-row gap-5 m-5 flex-wrap"}>
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

          <div className="flex flex-col">
            <label htmlFor="seriesMultiSelect">Series</label>
            <MultiSelect
              id="seriesMultiSelect"
              placeholder={"Series"}
              value={series}
              onValueChange={(value) => setSeries(value as SeriesKeys[])}
            >
              {Object.keys(SeriesKeys).map((series) => (
                <MultiSelectItem value={series} key={series}>
                  {series}
                </MultiSelectItem>
              ))}
            </MultiSelect>
          </div>
        </div>
        <div className={chartData.isRefetching ? "opacity-50" : ""}>
          {chartData.isSuccess && (
            <HighchartsReact
              highcharts={Highcharts}
              options={highChartsOptions}
            />
          )}
        </div>
      </Col>
      <TwitchClipAtTime time={clickedUnixSeconds} />
      <TopTwitchClips
        initialClips={props.initialMaxClips}
        initialState={props.initialArgState.clips}
      />
      <MostMinusTwosClips
        initialClips={props.initialMinClips}
        initialState={props.initialArgState.clips}
      />
    </Grid>
  );
}

function TwitchClipAtTime(props: { time?: number }) {
  type ClipData = {
    clip_id: string;
    time: number;
  };

  const { isSuccess, data, isLoading } = useQuery({
    queryKey: ["clip", props.time],
    queryFn: async () => {
      const res = await fetch(
        `https://nljokeval-production.up.railway.app/api/clip?time=${props.time}`
      );
      return (await res.json()) as ClipData;
    },
  });
  if (isLoading) {
    return <Text>Loading...</Text>;
  } else if (isSuccess && data) {
    return (
      <Card className={"flex flex-col items-center justify-between"}>
        <Title>Click on the graph to pull the nearest clip</Title>
        <TwitchClip clip_id={data.clip_id} time={data.time} />;
      </Card>
    );
  } else {
    return <Text>Clip not found</Text>;
  }
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

  const { isSuccess, data, isLoading, isFetching } = useQuery({
    queryKey: ["top_clips", timeSpan, grouping, emote],
    queryFn: async () => {
      const res = await fetch(
        `https://nljokeval-production.up.railway.app/api/max_clip?column=${emote}&span=${timeSpan}&grouping=${grouping}`
      );
      return (await res.json()) as ClipBatch;
    },
    placeholderData: initialClips,
    keepPreviousData: true,
  });

  return (
    <Card className={isFetching ? "opacity-50" : ""}>
      {isLoading && <Text>Loading...</Text>}
      <div className={"flex flex-row gap-2 flex-wrap"}>
        <Title>Top</Title>
        <Select value={emote} onValueChange={(value) => setEmote(value as any)}>
          {Object.keys(SeriesKeys).map((e) => (
            <SelectItem value={e} key={e}>
              {e}
            </SelectItem>
          ))}
        </Select>
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

  const { isSuccess, data, isLoading, isFetching } = useQuery({
    queryKey: ["minus_twos", timeSpan, grouping],
    queryFn: async () => {
      const rest = await fetch(
        `https://nljokeval-production.up.railway.app/api/min_clip?span=${timeSpan}&grouping=${grouping}`
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
      <Card className={isFetching ? "opacity-50" : ""}>
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

function TwitchClipThumbnail(props: Clip) {
  const [isClipRevealed, setIsClipRevealed] = useState(false);
  const { clip_id, count, time, thumbnail } = props;
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

function TwitchClip({ clip_id, time }: { clip_id: string; time: number }) {
  return (
    <>
      <Text className={"text-lg"}>
        {new Date(time * 1000).toLocaleString()}
      </Text>
      <iframe
        src={`https://clips.twitch.tv/embed?clip=${clip_id}&parent=${window.location.hostname}`}
        width="100%"
        className="aspect-video max-w-2xl"
        allowFullScreen={true}
      />
    </>
  );
}

import { createLazyFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { getClipAtTime, getClips, getSeries } from "../api";
import {
  Clip,
  ClipTimeGroupings,
  ClipTimeSpans,
  SeriesKey,
  TimeGroupings,
} from "../types";
import {
  apiURL,
  clipTimeGroupings,
  clipTimeSpans,
  DashboardURLState,
  timeGroupings,
} from "../utils";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Card,
  Title,
  Select,
  SelectItem,
  Button,
  SelectProps,
  DateRangePickerValue,
  DateRangePicker,
  DateRangePickerItem,
} from "@tremor/react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useDefaultClipParams } from "../hooks";
import React from "react";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-gray-100 lg:p-8 flex flex-col gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Chart />
        <div className={"flex flex-col gap-8"}>
          <ClipAtTime />
          <TopClips />
          <MinClips />
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

type LocalClipState = NonNullable<DashboardURLState["maxClipParams"]>;

export interface TopClipsProps {
  clips: Clip[];
  params: LocalClipState;
}

export function TopClips() {
  const currentState = Route.useSearch();

  const { maxClipParams, maxClipIndex } = currentState;

  const navigate = useNavigate();

  function handleTopClipNavigate(newParams: LocalClipState) {
    navigate({
      search: {
        ...currentState,
        maxClipParams: {
          ...maxClipParams,
          ...newParams,
        },
      },
    });
  }

  const fetchParams = useDefaultClipParams(maxClipParams);

  const { data: localFetchedClips, isLoading } = useQuery({
    queryFn: () => getClips(fetchParams),
    queryKey: ["clips", maxClipParams],
    refetchInterval: 1000 * 30,
  });

  const sortedClips = localFetchedClips
    ?.sort((a, b) => b.count - a.count)
    .filter((clip) => !!clip.clip_id);

  const { column, grouping, span } = fetchParams;

  return (
    <Card className="flex flex-col gap-5">
      <div className={"flex flex-col gap-3"}>
        <Title>Clips from Top Windows</Title>
        <SettingsDropLayout>
          <LabeledSelect
            label="Emote"
            value={column?.[0]}
            onValueChange={(value) => handleTopClipNavigate({ column: value })}
          >
            {Object.keys(seriesEmotes).map((emote) => (
              <SelectItem value={emote} key={emote}>
                {emote}
              </SelectItem>
            ))}
          </LabeledSelect>
          <ClipBinSizeSelect
            value={grouping}
            onValueChange={(value) =>
              handleTopClipNavigate({ grouping: value as ClipTimeGroupings })
            }
          />
          <LabeledSelect
            label="Over the past"
            value={span}
            onValueChange={(value) =>
              handleTopClipNavigate({ span: value as ClipTimeSpans })
            }
          >
            {clipTimeSpans.map((span) => (
              <SelectItem value={span} key={span}>
                {span}
              </SelectItem>
            ))}
          </LabeledSelect>
        </SettingsDropLayout>
      </div>
      {isLoading ? (
        <span className="w-full aspect-video bg-gray-200 flex flex-col justify-center items-center animate-pulse" />
      ) : (
        <ClipClicker
          clips={sortedClips ?? []}
          index={maxClipIndex}
          setIndex={(index) =>
            navigate({ search: { ...currentState, maxClipIndex: index } })
          }
        />
      )}
    </Card>
  );
}

export type LocalMinClipState = NonNullable<DashboardURLState["minClipParams"]>;

export function MinClips() {
  const navigate = useNavigate();

  const currentState = Route.useSearch();

  const { minClipParams, minClipIndex } = currentState;

  function handleMinClipNavigate(newParams: LocalMinClipState) {
    navigate({
      search: {
        ...currentState,
        minClipParams: {
          ...minClipParams,
          ...newParams,
        },
      },
    });
  }

  const fetchParams = useDefaultClipParams(minClipParams);

  const { data: localFetchedClips } = useQuery({
    queryFn: () =>
      getClips({
        ...fetchParams,
        order: "ASC",
      }),
    queryKey: ["clips", fetchParams],
    refetchInterval: 1000 * 30,
  });

  const { grouping, span } = fetchParams;

  const sortedClips = localFetchedClips?.sort((a, b) => a.count - b.count);

  return (
    <Card className="flex gap-5 flex-col">
      <div className={"flex flex-col gap-5"}>
        <Title>Lowest 2 count</Title>
        <SettingsDropLayout>
          <ClipBinSizeSelect
            value={grouping}
            onValueChange={(value) =>
              handleMinClipNavigate({ grouping: value as ClipTimeGroupings })
            }
          />
          <LabeledSelect
            value={span}
            onValueChange={(value) =>
              handleMinClipNavigate({ span: value as ClipTimeSpans })
            }
            label="Over the past"
          >
            {clipTimeSpans.map((span) => (
              <SelectItem value={span} key={span}>
                {span}
              </SelectItem>
            ))}
          </LabeledSelect>
        </SettingsDropLayout>
      </div>
      <ClipClicker
        clips={sortedClips ?? []}
        index={minClipIndex}
        setIndex={(index) =>
          navigate({ search: { ...currentState, minClipIndex: index } })
        }
      />
    </Card>
  );
}

export interface LabeledSelectProps extends SelectProps {
  children: React.ReactNode;
  label: string;
}

export function LabeledSelect({
  children,
  label,
  ...props
}: LabeledSelectProps) {
  return (
    <label>
      {label}
      <Select {...props}>{children}</Select>
    </label>
  );
}

function ClipBinSizeSelect({
  onValueChange,
  value,
}: {
  onValueChange: (value: string) => void;
  value: ClipTimeGroupings;
}) {
  return (
    <LabeledSelect label="Bin size" value={value} onValueChange={onValueChange}>
      {clipTimeGroupings.map((grouping) => (
        <SelectItem value={grouping} key={grouping}>
          {grouping}
        </SelectItem>
      ))}
    </LabeledSelect>
  );
}

export interface ClipClickerProps {
  children?: React.ReactNode;
  clips: Clip[];
  index: number;
  setIndex: (index: number) => void;
}

export function ClipClicker({ clips, index, setIndex }: ClipClickerProps) {
  if (!clips || clips.length === 0) {
    return <div className="w-full aspect-video bg-gray-100 animate-pulse" />;
  }

  const clip = clips[index];
  if (!clip) {
    return <div>No clip found</div>;
  }
  const totalClipCount = clips.length;

  return (
    <div className={`flex flex-col gap-5 `}>
      <div>
        <span className={"text-3xl"}>#{index + 1}</span>
        <span className="pl-2 text-xl">({clip.count})</span>
        <TwitchClip clip_id={clip.clip_id!} time={clip.time} />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => setIndex(index - 1)} disabled={index === 0}>
          Previous
        </Button>
        <Button
          onClick={() => setIndex(index + 1)}
          disabled={index === totalClipCount - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function TwitchClip({
  clip_id,
  time,
}: {
  clip_id: string;
  time?: string;
}) {
  const formattedTime = time ? new Date(time).toLocaleString() : "";

  return (
    <span>
      {time && (
        <span className={"m-5 text-center text-gray-500"}>{formattedTime}</span>
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

export function useLiveStatus() {
  return useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiURL}/api/is_live`);
      return response.json();
    },
    queryKey: ["liveStatus"],
  });
}

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
  const { data: isNlLive } = useLiveStatus();

  const defaultSpan = isNlLive ? "30 minutes" : "9 hours";
  const defaultGrouping = isNlLive ? "second" : "minute";
  const defaultRollingAverage = isNlLive ? 5 : 0;

  const chartState: typeof seriesParams = {
    ...seriesParams,
    span: seriesParams?.span ?? defaultSpan,
    grouping: seriesParams?.grouping ?? defaultGrouping,
    rollingAverage: seriesParams?.rollingAverage ?? defaultRollingAverage,
  };

  const { grouping, span, rollingAverage, from, to } = chartState;

  const { data: localFetchedSeries, isLoading } = useQuery({
    queryFn: () => getSeries(chartState),
    queryKey: ["series", chartState],
    refetchInterval: 1000 * 5,
    placeholderData: keepPreviousData,
  });

  let chartType = "line";

  // depends on there being fewer datapoints... bar easier to read. More of a client side
  // concern, but I could see it making sense to set the default higher up
  if (urlChartType && isNlLive) {
    chartType = "bar";
  }

  const seriesToDisplay = series?.length ? series : ["two"];

  const emoteSeries: Highcharts.SeriesLineOptions[] =
    seriesToDisplay?.map((key) => ({
      name: key,
      data:
        localFetchedSeries?.map((d) => [
          d.time * 1000 ?? 0,
          d[key as unknown as SeriesKey] ?? "",
        ]) ?? [],
      color: seriesColors[key as unknown as SeriesKey],
      events: {
        click: function (e) {
          navigate({ search: { clickedUnixSeconds: e.point.x / 1000 } });
        },
      },
      type: chartType,
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
      type: chartType,
      height: 600,
      zooming: {
        type: "x",
      },
      events: {
        click: function (e) {
          console.log(e);
          const xVal = e?.xAxis?.[0]?.value;
          if (xVal) {
            navigate({ search: { clickedUnixSeconds: new Date().getTime() } });
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

  let timeRangeString = "";

  const lowestTime = localFetchedSeries?.[0]?.time;
  const highestTime = localFetchedSeries?.[localFetchedSeries.length - 1]?.time;

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
          NL chat emote usage
          <LiveStatus />
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
              navigate({ search: { series: getNewSeriesList(key) } });
            }}
          >
            {seriesEmotes[key as SeriesKey]}
          </button>
        ))}
      </div>
      <span className="text-center">
        Select a point in the graph to pull the nearest clip
      </span>
      {isLoading ? (
        <div className="text-center w-full h-full">Loading series...</div>
      ) : (
        <HighchartsReact highcharts={Highcharts} options={highChartsOptions} />
      )}
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
    </Card>
  );
}

export function LiveStatus() {
  const { data: nlIsLive } = useLiveStatus();
  if (nlIsLive) {
    return (
      <span className="flex gap-2 items-center">
        <span className="bg-green-500 rounded-full w-4 h-4" />
        <a
          href="https://twitch.tv/northernlion"
          target="_blank"
          className="underline"
          rel="noreferrer"
        >
          Live
        </a>
      </span>
    );
  }
  return <span className="text-gray-500">Offline</span>;
}

export function ClipAtTime() {
  const { clickedUnixSeconds } = Route.useSearch();

  const { data: clip } = useQuery({
    queryFn: () => getClipAtTime({ time: clickedUnixSeconds }),
    queryKey: ["clip", clickedUnixSeconds],
    refetchInterval: 1000 * 30,
  });

  if (!clickedUnixSeconds) {
    return <div>Click on the chart to pull the nearest clip</div>;
  }

  if (!clip) {
    return <div>No clip found</div>;
  }

  return (
    <TwitchClip
      clip_id={clip.clip_id}
      time={new Date(clickedUnixSeconds * 1000).toLocaleString()}
    />
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
  return <img src={`/${src}`} alt={src} width={32} height={32} />;
}

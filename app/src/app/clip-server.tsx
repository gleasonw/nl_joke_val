import { Chart } from "@/app/chart";
import { ClipParams, SeriesKey, SeriesParams } from "./types";
import { MinClips, TopClips, TwitchClip } from "@/app/clip-clients";
import {
  getClipAtTime,
  getClips,
  getLiveStatus,
  getSeries,
} from "@/app/server/actions";
import Image from "next/image";

export async function ChartFetcher({ params }: { params: SeriesParams }) {
  const isStreamerLive = await getLiveStatus();

  const defaultSpan = isStreamerLive ? "30 minutes" : "9 hours";
  const defaultGrouping = isStreamerLive ? "second" : "minute";
  const defaultRollingAverage = isStreamerLive ? 5 : 0;

  const chartState: typeof params = {
    ...params,
    span: params?.span ?? defaultSpan,
    grouping: params?.grouping ?? defaultGrouping,
    rollingAverage: params?.rollingAverage ?? defaultRollingAverage,
  };

  const chartData = await getSeries(chartState);

  return <Chart chartData={chartData} params={chartState} />;
}

export async function TopClipFetcher({ params }: { params: ClipParams }) {
  const isStreamerLive = await getLiveStatus();

  const defaultSpan = isStreamerLive ? "30 minutes" : "9 hours";
  const defaultGrouping = isStreamerLive ? "25 seconds" : "1 minute";

  const clipState: typeof params = {
    ...params,
    span: params?.span ?? defaultSpan,
    grouping: params?.grouping ?? defaultGrouping,
    order: "DESC",
  } as const;

  const clips = await getClips(clipState);

  return <TopClips clips={clips} params={clipState} />;
}

export async function MinClipFetcher({ params }: { params: ClipParams }) {
  const isStreamerLive = await getLiveStatus();

  const defaultSpan = isStreamerLive ? "30 minutes" : "9 hours";
  const defaultGrouping = isStreamerLive ? "25 seconds" : "1 minute";

  const clipState: typeof params = {
    ...params,
    span: params?.span ?? defaultSpan,
    grouping: params?.grouping ?? defaultGrouping,
    order: "ASC",
  } as const;

  const clips = await getClips(clipState);

  return <MinClips clips={clips} params={clipState} />;
}

export async function ClipAtTimeFetcher({
  time: clickedUnixSeconds,
}: {
  time?: number;
}) {
  if (!clickedUnixSeconds) {
    return <div>Click on the chart to pull the nearest clip</div>;
  }

  const clip = await getClipAtTime({ time: clickedUnixSeconds });

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
  return <Image src={`/${src}`} alt={src} width={32} height={32} />;
}

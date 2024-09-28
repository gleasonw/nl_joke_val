import { TwitchClip } from "@/components/TwitchClip";
import { useClipThumbnail, useTopClipHero } from "@/hooks";
import { EmoteClipResponse, TopClip } from "@/types";
import { createFileRoute, Link } from "@tanstack/react-router";
import clsx from "clsx";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { ArrowRight } from "lucide-react";
import React, { useMemo } from "react";
import { z } from "zod";

const spans = ["9 hours", "1 week", "1 month", "1 year", "all"] as const;

const allTimeSearchParams = z.object({
  span: z.enum(spans).default("all").optional(),
});

export const Route = createFileRoute("/all-time")({
  component: AllTimeClips,
  validateSearch: allTimeSearchParams,
});

const spanToLabel = new Map([
  ["9 hours", "Last stream"],
  ["1 week", "Last week"],
  ["1 month", "Last month"],
  ["1 year", "Last year"],
  ["all", "All time"],
]);

function AllTimeClips() {
  const { span } = Route.useSearch();
  const { data: heroClips } = useTopClipHero({ span });
  const emotes = heroClips
    ?.slice()
    .sort((a, b) => b.sum - a.sum)
    .map((e) => ({
      Code: e.clips[0]?.Emote.Code ?? "",
      HexColor: e.clips[0]?.Emote.HexColor ?? "",
      Sum: Math.log10(e.sum),
      EmoteURL: e.emote_url,
    }));
  const highChartsOptions = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "bar",
        height: 600,
      },
      xAxis: {
        categories: emotes?.map((e) => e.Code) ?? [],
        title: {
          text: "Emotes",
        },
      },
      yAxis: {
        min: 0,
        title: {
          text: "Sum",
        },
      },
      title: {
        text: `Top emotes for ${spanToLabel.get(span ?? "all")} (log scale)`,
      },
      series: [
        {
          name: "Emote Usage",
          data:
            emotes?.map((e) => ({
              name: e.Code,
              color: e.HexColor,
              y: e.Sum,
            })) ?? [],
          type: "bar",
        },
      ],
      tooltip: {
        formatter() {
          const emote = emotes?.find((e) => e.Code === this.key);
          return `
            <strong>${this.key}</strong><br/>
            <img src="${emote?.EmoteURL}" width="20" height="20" /><br/>
            Sum: ${emote?.Sum}<br/>
          `;
        },
      },
      plotOptions: {
        series: {
          dataLabels: {
            enabled: true,
            useHTML: true,
            formatter() {
              const emote = emotes?.find((e) => e.Code === this.key);
              return `
                <div style="text-align: center; width: 20px; height: 20px; border-radius: 50%;">
                  <img src="${emote?.EmoteURL}" width="20" height="20" /><br/>
                </div>
              `;
            },
          },
        },
      },
    }),
    [emotes, span],
  );
  return (
    <div className="flex flex-col gap-10">
      <span className="flex items-center justify-center gap-2 p-3">
        {spans.map((s) => (
          <Link
            search={{ span: s }}
            to="/all-time"
            key={s}
            className="border p-3 shadow-md"
            activeProps={{ style: { outline: "2px solid" } }}
          >
            {spanToLabel.get(s)}
          </Link>
        ))}
      </span>
      {span === "1 year" || span === "all" ? (
        <span className="text-sm italic text-gray-500">
          lul_kekw_icant and pog_pogcrazy_letsgo are old tracking stocks for
          grouped emotes -- I now track each emote separately
        </span>
      ) : null}

      <HighchartsReact highcharts={Highcharts} options={highChartsOptions} />
      <div className="grid grid-cols-3">
        {heroClips
          ?.slice()
          .sort((a, b) => a.emote_id - b.emote_id)
          .map((e) => <EmoteClipsDisplay key={e.emote_id} topEmotes={e} />)}
      </div>
    </div>
  );
}

function EmoteClipsDisplay({ topEmotes }: { topEmotes: EmoteClipResponse }) {
  const [playingIndex, setPlayingIndex] = React.useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2 border" data-id={topEmotes.emote_id}>
      <span className="flex">
        <img src={topEmotes.emote_url} width="50" height="50" />
        <button
          className=" ml-auto flex items-center gap-2 opacity-50"
          disabled
        >
          More
          <ArrowRight />
        </button>
      </span>

      <span className="flex gap-2 p-5">
        {topEmotes.clips.slice(0, 3).map((clip, index) => (
          <button
            key={index}
            onClick={() => setPlayingIndex(index)}
            className="flex flex-col"
          >
            <span
              className={clsx({
                "text-gray-500": playingIndex === index,
                "scale-90": index === 1,
                "scale-75": index === 2,
              })}
            >
              <MaybeFetchThumbnail clip={clip} />
            </span>
            <span>{clip.Count}</span>
          </button>
        ))}
      </span>
      {playingIndex !== null ? (
        !topEmotes.clips[playingIndex] ? null : (
          <TwitchClip clip_id={topEmotes.clips[playingIndex].ClipID} />
        )
      ) : null}
    </div>
  );
}

function MaybeFetchThumbnail({ clip }: { clip?: TopClip }) {
  if (!clip) {
    return <span>No clip</span>;
  }
  if (!clip.Clip.Thumbnail) {
    return <FetchThumbnailForClip clip={clip} />;
  }
  return <ClipThumbnail thumbnail={clip.Clip.Thumbnail} />;
}

function FetchThumbnailForClip({ clip }: { clip: TopClip }) {
  const { data: thumbnail } = useClipThumbnail(clip.ClipID);
  if (!thumbnail) {
    return <span>Loading thumbnail...</span>;
  }
  return <ClipThumbnail thumbnail={thumbnail.thumbnail_url} />;
}

function ClipThumbnail({ thumbnail }: { thumbnail: string }) {
  return (
    <img
      src={thumbnail}
      width="309"
      height="174"
      data-loading="true"
      onLoad={(e) => e.currentTarget.removeAttribute("data-loading")}
      className={"[data-loading=true]:animate-pulse bg-gray-100"}
    />
  );
}

"use client";
import { Title, Select, SelectItem, Card, Button } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import { Clip, ClipParams, SeriesKey } from "./types";
import { SettingsDropLayout, TwitchClip, seriesEmotes } from "./dashboard";
import {
  addQueryParamsIfExist,
  clipTimeSpans,
  timeGroupings,
  GET,
} from "@/app/utils";
import { useDashboardUrl } from "@/app/hooks";
import { apiURL } from "@/app/apiURL";

export function TopTwitchClips() {
  const {
    handleNavigate: onNavigate,
    currentParams: {
      maxClipGrouping: grouping,
      maxClipSpan: span,
      emotes,
      maxClipIndex,
    },
  } = useDashboardUrl();

  const {
    data: topClips,
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: ["top_clips", span, grouping, emotes],
    queryFn: async () => {
      const res = await fetch(
        addQueryParamsIfExist(`${apiURL}/api/clip_counts`, {
          column: emotes,
          span,
          grouping,
          order: "DESC",
        } satisfies ClipParams)
      );

      return (await res.json()) as Clip[];
    },
    keepPreviousData: true,
  });

  const sortedClips = topClips
    ?.sort((a, b) => b.count - a.count)
    .filter((clip) => !!clip.clip_id);

  return (
    <Card className="flex flex-col gap-5">
      <div className={"flex flex-col gap-3"}>
        <Title>Clips from Top Windows</Title>
        <SettingsDropLayout>
          <label>
            Emote
            <Select
              value={emotes?.[0]}
              onValueChange={(value) => onNavigate({ emote: value })}
            >
              {Object.keys(seriesEmotes).map((emote) => (
                <SelectItem value={emote} key={emote}>
                  {seriesEmotes[emote as SeriesKey]}
                </SelectItem>
              ))}
            </Select>
          </label>
          <label>
            Bin size
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
          </label>

          <label>
            Over the past
            <Select
              value={span}
              onValueChange={(value) => onNavigate({ maxClipSpan: value })}
            >
              {clipTimeSpans.map((span) => (
                <SelectItem value={span} key={span}>
                  {span}
                </SelectItem>
              ))}
            </Select>
          </label>
        </SettingsDropLayout>
      </div>
      <ClipClicker
        clips={sortedClips ?? []}
        isLoading={isLoading || isRefetching}
        index={maxClipIndex}
        setIndex={(index) => onNavigate({ maxClipIndex: index })}
      />
    </Card>
  );
}

export interface ClipClickerProps {
  children?: React.ReactNode;
  clips: Clip[];
  isLoading: boolean;
  index: number;
  setIndex: (index: number) => void;
}

export function ClipClicker({
  clips,
  isLoading,
  index,
  setIndex,
}: ClipClickerProps) {
  if (!clips || clips.length === 0) {
    return <div className="w-full h-96 bg-gray-100 animate-pulse" />;
  }

  const clip = clips[index];
  if (!clip) {
    return <div>No clip found</div>;
  }
  const totalClipCount = clips.length;

  return (
    <div className={`flex flex-col gap-5 ${isLoading && "opacity-50"}`}>
      <div>
        <span className={"text-3xl"}>#{index + 1}</span>
        <span className="pl-2 text-xl">({clip.count})</span>
        <TwitchClip
          clip_id={clip.clip_id!}
          time={new Date(clip.time).getTime()}
        />
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

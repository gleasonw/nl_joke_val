"use client";

import { seriesEmotes } from "@/app/clip-server";
import { useDashboardUrl } from "@/app/hooks";
import { SettingsDropLayout } from "@/app/page";
import { getClips } from "@/app/server/actions";
import { DashboardURLState } from "@/app/server/utils";
import { Clip, ClipTimeGroupings } from "@/app/types";
import { clipTimeGroupings, clipTimeSpans } from "@/app/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Title,
  Select,
  SelectItem,
  Button,
  SelectProps,
} from "@tremor/react";
import { useEffect, useState } from "react";

type LocalClipState = NonNullable<DashboardURLState["maxClipParams"]>;

export interface TopClipsProps {
  clips: Clip[];
  params: LocalClipState;
}

export function TopClips({
  clips,
  params: { emote, grouping, span },
}: TopClipsProps) {
  const { handleNavigate, currentParams } = useDashboardUrl();

  function handleTopClipNavigate(newParams: LocalClipState) {
    handleNavigate({ maxClipParams: newParams });
  }

  const { data: localFetchedClips } = useQuery({
    queryFn: () => getClips(currentParams?.maxClipParams),
    queryKey: ["clips", currentParams?.maxClipParams],
    initialData: clips,
    refetchInterval: 1000 * 30,
  });

  const maxClipIndex = currentParams?.maxClipIndex ?? 0;

  const sortedClips = localFetchedClips
    ?.sort((a, b) => b.count - a.count)
    .filter((clip) => !!clip.clip_id);

  return (
    <Card className="flex flex-col gap-5">
      <div className={"flex flex-col gap-3"}>
        <Title>Clips from Top Windows</Title>
        <SettingsDropLayout>
          <LabeledSelect
            label="Emote"
            value={emote?.[0]}
            onValueChange={(value) => handleTopClipNavigate({ emote: value })}
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
              handleTopClipNavigate({ grouping: value as any })
            }
          />
          <LabeledSelect
            label="Over the past"
            value={span}
            onValueChange={(value) =>
              handleTopClipNavigate({ span: value as any })
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
      <ClipClicker
        clips={sortedClips ?? []}
        index={maxClipIndex}
        setIndex={(index) => handleNavigate({ maxClipIndex: index })}
      />
    </Card>
  );
}

export type LocalMinClipState = NonNullable<DashboardURLState["minClipParams"]>;

export function MinClips({
  clips,
  params: { grouping, span },
}: {
  clips: Clip[];
  params: LocalMinClipState;
}) {
  const { handleNavigate, currentParams } = useDashboardUrl();

  function handleMinClipNavigate(newParams: LocalMinClipState) {
    handleNavigate({ minClipParams: newParams });
  }

  const { data: localFetchedClips } = useQuery({
    queryFn: () => getClips(currentParams?.minClipParams),
    queryKey: ["clips", currentParams?.minClipParams],
    initialData: clips,
    refetchInterval: 1000 * 30,
  });

  const minClipIndex = currentParams?.minClipIndex ?? 0;

  const sortedClips = localFetchedClips?.sort((a, b) => a.count - b.count);

  return (
    <Card className="flex gap-5 flex-col">
      <div className={"flex flex-col gap-5"}>
        <Title>Lowest 2 count</Title>
        <SettingsDropLayout>
          <ClipBinSizeSelect
            value={grouping}
            onValueChange={(value) =>
              handleMinClipNavigate({ grouping: value as any })
            }
          />
          <LabeledSelect
            value={span}
            onValueChange={(value) =>
              handleMinClipNavigate({ span: value as any })
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
        setIndex={(index) => handleNavigate({ minClipIndex: index })}
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
    return <div className="w-full h-96 bg-gray-100 animate-pulse" />;
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
  const [parentName, setParentName] = useState<string>("");

  useEffect(() => {
    setParentName(window.location.hostname);
  }, []);

  return (
    <span>
      {time && <span className={"m-5 text-center text-gray-500"}>{time}</span>}
      <iframe
        src={`https://clips.twitch.tv/embed?clip=${clip_id}&parent=${parentName}`}
        width="100%"
        className="aspect-video"
        allowFullScreen={true}
      />
    </span>
  );
}

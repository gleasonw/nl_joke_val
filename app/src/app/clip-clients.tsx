"use client";

import { useDashboardUrl } from "@/app/hooks";
import { SettingsDropLayout } from "@/app/page";
import { Clip, ClipTimeGroupings, SeriesKey } from "@/app/types";
import { clipTimeGroupings, clipTimeSpans } from "@/app/utils";
import { Card, Title, Select, SelectItem, Button } from "@tremor/react";

export interface TopClipsProps {
  clips: Clip[];
}

export function TopClips({ clips }: TopClipsProps) {
  const {
    handleNavigate,
    currentParams: {
      maxClipParams: { emote, span, grouping },
    },
  } = useDashboardUrl();
  const sortedClips = clips
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
              value={emote?.[0]}
              onValueChange={(value) => handleNavigate({ emote: value })}
            >
              {Object.keys(seriesEmotes).map((emote) => (
                <SelectItem value={emote} key={emote}>
                  {seriesEmotes[emote as SeriesKey]}
                </SelectItem>
              ))}
            </Select>
          </label>
          <ClipBinSizeSelect
            value={grouping}
            onValueChange={(value) =>
              handleNavigate({ maxClipGrouping: value })
            }
          />
          <label>
            Over the past
            <Select
              value={span}
              onValueChange={(value) => handleNavigate({ maxClipSpan: value })}
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
        index={maxClipIndex}
        setIndex={(index) => handleNavigate({ maxClipIndex: index })}
      />
    </Card>
  );
}

export function MinClips({ clips }: { clips: Clip[] }) {
  const {
    handleNavigate: onNavigate,
    currentParams: {
      minClipParams: { grouping, span },
      minClipIndex,
    },
  } = useDashboardUrl();

  const sortedClips = clips?.sort((a, b) => a.count - b.count);

  return (
    <Card className="flex gap-5 flex-col">
      <div className={"flex flex-col gap-5"}>
        <Title>Lowest 2 count</Title>
        <SettingsDropLayout>
          <ClipBinSizeSelect
            value={grouping}
            onValueChange={(value) => onNavigate({ minClipGrouping: value })}
          />
          <label>
            Over the past
            <Select
              value={span}
              onValueChange={(value) => onNavigate({ minClipSpan: value })}
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
        index={minClipIndex}
        setIndex={(index) => onNavigate({ minClipIndex: index })}
      />
    </Card>
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
    <label>
      Bin size
      <Select value={value} onValueChange={onValueChange}>
        {clipTimeGroupings.map((grouping) => (
          <SelectItem value={grouping} key={grouping}>
            {grouping}
          </SelectItem>
        ))}
      </Select>
    </label>
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
  return (
    <span>
      {time && <span className={"m-5 text-center text-gray-500"}>{time}</span>}
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

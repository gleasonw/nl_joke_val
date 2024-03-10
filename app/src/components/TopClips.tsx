import { getClips } from "../api";
import { Clip } from "../types";
import { DashboardURLState } from "../utils";
import { useQuery } from "@tanstack/react-query";
import {
  useEmoteAveragePerformance,
  useEmoteDensity,
  useLiveStatus,
  usePerformanceGrouping,
} from "../hooks";
import React from "react";
import { ClipClicker } from "./ClipClicker";
import { Card, CardTitle } from "@/components/ui/card";

type LocalClipState = NonNullable<DashboardURLState["maxClipParams"]>;

export interface TopClipsProps {
  clips: Clip[];
  params: LocalClipState;
}
export function TopClips() {
  return <TopClipsByDensity />;
}

function TopClipsByRelativePerformance() {
  const grouping = usePerformanceGrouping();

  const { data: topPerformingEmotes } = useEmoteAveragePerformance({
    grouping,
  });

  const topEmoteCodes = topPerformingEmotes?.Emotes?.slice()
    .sort((a, b) => b.PercentDifference - a.PercentDifference)
    .slice(0, 5)
    .map((e) => ({
      id: e.EmoteID,
      code: e.Code,
    }));

  return (
    <Card className="flex flex-col gap-5">
      <CardTitle>Clips from Top Windows</CardTitle>
      {topEmoteCodes?.map((e) => (
        <TopClip emoteId={e.id} key={e.id} emoteCode={e.code} />
      ))}
    </Card>
  );
}

function TopClipsByDensity() {
  const { data: isNlLive } = useLiveStatus();
  const span = isNlLive ? "30 minutes" : "9 hours";

  const { data: topPerformingEmotes } = useEmoteDensity({
    span,
  });

  const topEmoteCodes = topPerformingEmotes?.Emotes?.slice(0, 10).map((e) => ({
    id: e.EmoteID,
    code: e.Code,
    percentOfTotal: e.Percent,
  }));

  return (
    <Card className="flex flex-col gap-5">
      <CardTitle>Clips from Top Windows</CardTitle>
      {topEmoteCodes?.map((e) => (
        <TopClip emoteId={e.id} key={e.id} emoteCode={e.code}>
          {Math.round(e.percentOfTotal * 100)}% of tracked emotes
        </TopClip>
      ))}
    </Card>
  );
}

export interface TopClipProps {
  emoteId: number;
  emoteCode: string;
  children?: React.ReactNode;
}

export function TopClip({ emoteId, emoteCode, children }: TopClipProps) {
  const { data: isNlLive } = useLiveStatus();

  const [index, setIndex] = React.useState(0);

  const params = {
    span: isNlLive ? "30 minutes" : "9 hours",
    grouping: "25 seconds",
    limit: 10,
    emote_id: emoteId,
  } as const;

  const { data: fetchedClips, isLoading } = useQuery({
    queryFn: () => getClips(params),
    queryKey: ["clips", params],
    refetchInterval: 1000 * 30,
  });

  if (isLoading) {
    return (
      <span className="w-full aspect-video bg-gray-200 flex flex-col justify-center items-center animate-pulse" />
    );
  }

  return (
    <div>
      {emoteCode}
      {children}

      <ClipClicker
        clips={fetchedClips ?? []}
        index={index}
        setIndex={(index) => setIndex(index)}
      />
    </div>
  );
}

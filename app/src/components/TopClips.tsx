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
import { Route } from "@/routes/index.lazy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LocalClipState = NonNullable<DashboardURLState["maxClipParams"]>;

export interface TopClipsProps {
  clips: Clip[];
  params: LocalClipState;
}
export function TopClips() {
  return (
    <div>
      <CardTitle>Clips from Top Windows</CardTitle>
      <Tabs defaultValue="relative">
        <TabsList>
          <TabsTrigger value="relative">Relative perf</TabsTrigger>
          <TabsTrigger value="density">Share of tracked emotes</TabsTrigger>
        </TabsList>
        <TabsContent value="relative">
          <TopClipsByRelativePerformance />
        </TabsContent>
        <TabsContent value="density">
          <TopClipsByDensity />
        </TabsContent>
      </Tabs>
    </div>
  );
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
    <div className="flex flex-col gap-5">
      {topEmoteCodes?.map((e) => (
        <TopClip emoteId={e.id} key={e.id} emoteCode={e.code} />
      ))}
    </div>
  );
}

function TopClipsByDensity() {
  const { data: isNlLive } = useLiveStatus();
  const span = isNlLive ? "30 minutes" : "9 hours";

  const { data: topPerformingEmotes } = useEmoteDensity({
    span,
  });

  const topEmoteCodes = topPerformingEmotes?.Emotes?.slice(0, 5).map((e) => ({
    id: e.EmoteID,
    code: e.Code,
    percentOfTotal: e.Percent,
  }));

  return (
    <div className="flex flex-col gap-5">
      {topEmoteCodes?.map((e) => (
        <TopClip emoteId={e.id} key={e.id} emoteCode={e.code}>
          {Math.round(e.percentOfTotal * 100)}% of tracked emotes
        </TopClip>
      ))}
    </div>
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
  const { from } = Route.useSearch();

  const params = {
    span: isNlLive ? "30 minutes" : "9 hours",
    grouping: "25 seconds",
    limit: 10,
    emote_id: emoteId,
  } as const;

  // todo: this is a bad waterfall, we should go parallel on server
  const { data: fetchedClips, isLoading } = useQuery({
    queryFn: () => getClips({ ...params, from }),
    queryKey: ["clips", params, from],
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

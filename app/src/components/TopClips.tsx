import { getClips } from "../api";
import { useQuery } from "@tanstack/react-query";
import {
  useEmotePerformance,
  useEmoteSums,
  useLiveStatus,
  useLatestSpan,
} from "../hooks";
import React from "react";
import { ClipClicker } from "./ClipClicker";
import { CardTitle } from "@/components/ui/card";
import { Route } from "@/routes/index.lazy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const topPerformingEmotes = useEmotePerformance();

  const topEmoteCodes = topPerformingEmotes?.Emotes?.slice()
    .sort((a, b) => b.PercentDifference - a.PercentDifference)
    .slice(0, 3)
    .map((e) => ({
      id: e.EmoteID,
      code: e.Code,
    }));

  return (
    <div className="flex flex-col gap-5">
      {topEmoteCodes?.map((e) => <TopClip emoteId={e.id} key={e.id} />)}
    </div>
  );
}

function TopClipsByDensity() {
  const { data: isNlLive } = useLiveStatus();
  const span = isNlLive ? "30 minutes" : "9 hours";

  const { data: topPerformingEmotes } = useEmoteSums({
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
        <TopClip emoteId={e.id} key={e.id}>
          {Math.round(e.percentOfTotal)}% of tracked emotes{" "}
        </TopClip>
      ))}
    </div>
  );
}

export interface TopClipProps {
  emoteId: number;
  children?: React.ReactNode;
}

export function TopClip({ emoteId, children }: TopClipProps) {
  const span = useLatestSpan();

  const [index, setIndex] = React.useState(0);
  const { from } = Route.useSearch();

  const params = {
    span,
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
      {children}

      <ClipClicker
        clips={fetchedClips ?? []}
        index={index}
        setIndex={(index) => setIndex(index)}
      />
    </div>
  );
}

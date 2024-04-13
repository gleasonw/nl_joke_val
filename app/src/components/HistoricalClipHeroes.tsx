import { DayFocusClip } from "@/components/DayFocusClip";
import { TopClip } from "@/components/TopClip";
import { useDashboardState, useEmotes } from "@/hooks";
import React from "react";

export function HistoricalClipHeroes() {
  return <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"></div>;
}

export function HistoricalPlusTwoClip() {
  const { data: emotes } = useEmotes();
  const { from } = useDashboardState();

  const twoEmoteId = emotes?.find((e) => e.Code === "two")?.ID;
  return (
    <TopClip
      title={<span className="text-xl">Greatest Σ ± 2</span>}
      clipParams={{
        from,
        grouping: "25 seconds",
        limit: 5,
        emote_id: twoEmoteId,
      }}
    />
  );
}

export function HistoricalMinusTwoClip() {
  const { data: emotes } = useEmotes();
  const { from } = useDashboardState();

  const twoEmoteId = emotes?.find((e) => e.Code === "two")?.ID;
  return (
    <TopClip
      title={<span className="text-xl">Lowest Σ ± 2</span>}
      clipParams={{
        from,
        grouping: "25 seconds",
        limit: 5,
        emote_id: twoEmoteId,
        order: "ASC",
      }}
    />
  );
}

import { TopClip } from "./TopClip";
import { useDashboardState, useEmoteGrowth } from "@/hooks";
import { Route } from "@/routes/index.lazy";
import { EmotePerformance } from "@/types";
import React from "react";

export interface DayFocusClipProps {}

export function DayFocusClip() {
  const { focusedEmote } = Route.useSearch();
  const { from } = useDashboardState();

  const { data: emotePerformance } = useEmoteGrowth();

  // days with 0 difference are not interesting
  const emotes = emotePerformance?.Emotes.filter(
    (e) => e.Difference != 0 && e.Count > 0
  );

  const emoteData =
    emotes?.find((e) => e.EmoteID === focusedEmote) ?? emotes?.at(0);

  if (!emoteData) {
    return <div>No data</div>;
  }

  return (
    <section className="flex flex-col gap-2">
      <TopClip
        title={<FocusTitle emote={emoteData} />}
        clipParams={{
          emote_id: emoteData.EmoteID,
          from,
          grouping: "25 seconds",
          limit: 5,
        }}
      />
    </section>
  );
}

export function FocusTitle({ emote }: { emote: EmotePerformance }) {
  const { data: emotePerformance } = useEmoteGrowth();
  const isLatestHourView =
    emotePerformance?.Input?.Grouping === "hour" &&
    !("Date" in emotePerformance.Input);

  if (!emote) {
    return <div>No data</div>;
  }

  const positive = emote.Difference > 0;
  const emoteCode = emote.Code;

  if (isLatestHourView && positive) {
    return (
      <span className="flex gap-2 items-center">
        A strong past hour for
        <span className="font-bold text-lg">{emoteCode}</span>!
      </span>
    );
  }

  if (isLatestHourView && !positive) {
    return (
      <span className="flex gap-2 items-center">
        <span className="font-bold text-lg">{emoteCode}</span>
        is trending down in the past hour.
      </span>
    );
  }

  if (positive) {
    return (
      <span className="flex gap-2 items-center">
        Strong day for
        <span className="font-bold text-lg">{emoteCode}</span>!
      </span>
    );
  }

  return (
    <span className="flex gap-2 items-center">
      <span className="font-bold text-lg">{emoteCode}</span> trended down on
      this day.
    </span>
  );
}

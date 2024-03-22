import { TopClip } from "@/components/TopClips";
import { useEmoteAveragePerformance } from "@/hooks";
import { Route } from "@/routes/index.lazy";
import React from "react";

export interface DayFocusClipProps {}

export function DayFocusClip() {
  const { focusedEmote } = Route.useSearch();
  const { data } = useEmoteAveragePerformance();
  const emotes = data?.Emotes;

  const emoteData =
    emotes?.find((e) => e.EmoteID === focusedEmote) ?? emotes?.at(0);

  if (!emoteData) {
    return <div>No data</div>;
  }

  const title = emoteData.Difference > 0 ? `A great day for` : `Sell`;

  return (
    <section>
      {title} <span className="font-bold text-lg">{emoteData.Code}</span>!
      <TopClip emoteId={emoteData.EmoteID} />
    </section>
  );
}

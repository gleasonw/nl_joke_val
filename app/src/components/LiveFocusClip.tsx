import { TopClip } from "./TopClip";
import { useDashboardState, useLatestEmoteGrowth } from "@/hooks";
import { Route } from "@/routes/index.lazy";
import { EmotePerformance } from "@/types";
import React from "react";

export function LiveFocusClip() {
  const { focusedEmote } = Route.useSearch();
  const { from } = useDashboardState();

  const { data: emotePerformance } = useLatestEmoteGrowth();

  // days with 0 difference are not interesting
  const emotes = emotePerformance?.Emotes.filter(
    (e) => e.Difference != 0 && e.Count > 0,
  );

  const emoteData =
    emotes?.find((e) => e.EmoteID === focusedEmote) ?? emotes?.at(0);

  if (!emoteData) {
    return <div>No data</div>;
  }

  return (
    <section className="flex flex-col gap-2">
      <TopClip
        title={<LiveFocusTitle emote={emoteData} />}
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

function LiveFocusTitle({ emote }: { emote: EmotePerformance }) {
  if (!emote) {
    return <div>No data</div>;
  }

  const positive = emote.Difference > 0;
  const emoteCode = emote.Code;

  if (positive) {
    return (
      <span className="flex items-center gap-2">
        A strong past hour for
        <span className="text-lg font-bold">{emoteCode}</span>!
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-lg font-bold">{emoteCode}</span>
      is trending down in the past hour.
    </span>
  );
}

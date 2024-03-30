import { EmotePerformanceCard } from "@/components/TopPerformingEmotes";
import { useLatestEmoteGrowth, useLatestEmoteSums } from "@/hooks";
import { EmoteSum } from "@/types";
import { Link } from "@tanstack/react-router";
import React from "react";

export function LiveTopPerformingEmotes() {
  const { data: emotePerformance } = useLatestEmoteSums();
  const { data: emoteGrowth } = useLatestEmoteGrowth();

  return (
    <div className="flex flex-col gap-5">
      <section className="flex gap-2">
        {emoteGrowth?.Emotes?.filter((e) => e.Difference != 0 && e.Count > 0)
          .slice(0, 5)
          .map((e) => (
            <EmotePerformanceCard
              emotePerformance={e}
              key={e.Code}
              grouping={emoteGrowth?.Input?.Grouping}
            />
          ))}
      </section>
      <section>
        <div className="flex gap-5">
          {emotePerformance?.Emotes.map((e) => (
            <LiveEmotePerformanceCard emotePerformance={e} key={e.Code} />
          ))}
        </div>
      </section>
    </div>
  );
}

function LiveEmotePerformanceCard({
  emotePerformance,
}: {
  emotePerformance: EmoteSum;
}) {
  const { Code, Sum } = emotePerformance;

  return (
    <Link className="flex items-center gap-2 rounded-lg bg-white text-xs flex-col sm:flex-row hover:bg-gray-100">
      <span className="flex flex-col gap-1">
        <span className="flex gap-1 flex-col sm:flex-row">
          <span className="font-bold">{Code}</span>
          <span>{Sum}</span>
        </span>
      </span>
    </Link>
  );
}

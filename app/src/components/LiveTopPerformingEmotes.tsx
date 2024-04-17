import { EmotePerformanceCard } from "@/components/TopPerformingEmotes";
import { useLatestEmoteGrowth } from "@/hooks";
import React from "react";

export function LiveTopPerformingEmotes() {
  const { data: emoteGrowth } = useLatestEmoteGrowth();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex justify-center gap-10">
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
    </div>
  );
}

import { useEmoteSums } from "@/hooks";
import { EmoteSum } from "@/types";
import { Link } from "@tanstack/react-router";
import React from "react";

export function LiveTopPerformingEmotes() {
  const { data: emotePerformance } = useEmoteSums();

  return (
    <section>
      <div className="flex gap-5">
        {emotePerformance?.Emotes.map((e) => (
          <LiveEmotePerformanceCard emotePerformance={e} key={e.Code} />
        ))}
      </div>
    </section>
  );
}

function LiveEmotePerformanceCard({
  emotePerformance,
}: {
  emotePerformance: EmoteSum;
}) {
  const { Code, Count } = emotePerformance;

  return (
    <Link className="flex items-center gap-2 rounded-lg bg-white text-xs flex-col sm:flex-row hover:bg-gray-100">
      <span className="flex flex-col gap-1">
        <span className="flex gap-1 flex-col sm:flex-row">
          <span className="font-bold">{Code}</span>
          <span>{Count}</span>
        </span>
      </span>
    </Link>
  );
}

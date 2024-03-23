import { useDashboardState, useEmotePerformance } from "@/hooks";
import { EmotePerformance } from "@/types";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import React from "react";

export interface TopPerformingEmotesProps {
  children?: React.ReactNode;
  className?: string;
}

export function TopPerformingEmotes() {
  const emotePerformance = useEmotePerformance();
  return (
    <section>
      <div className="flex gap-5">
        {emotePerformance?.Emotes?.filter(
          (e) => e.Difference != 0 && e.Count > 0
        )
          .slice(0, 5)
          .map((e) => (
            <EmotePerformanceCard
              emotePerformance={e}
              key={e.Code}
              grouping={emotePerformance?.Input?.Grouping}
            />
          ))}
      </div>
    </section>
  );
}

interface EmotePerformanceCardProps {
  emotePerformance: EmotePerformance;
  grouping: string;
}

function EmotePerformanceCard({
  emotePerformance,
  grouping,
}: EmotePerformanceCardProps) {
  const { Code, Count, PercentDifference, Average } = emotePerformance;
  const trend = PercentDifference > 0 ? "up" : "down";
  const ArrowIcon = trend === "up" ? ArrowUp : ArrowDown;
  const [, navigate] = useDashboardState();

  return (
    <button
      className="flex items-center gap-2 rounded-lg bg-white text-xs flex-col sm:flex-row hover:bg-gray-100"
      onClick={() => navigate({ focusedEmote: emotePerformance.EmoteID })}
    >
      <ArrowIcon
        className={clsx("h-8 w-8 p-2 rounded", {
          "text-green-500": trend === "up",
          "bg-green-100": trend === "up",
          "text-red-500": trend === "down",
          "bg-red-100": trend === "down",
        })}
      />
      <span className="flex flex-col gap-1">
        <span className="flex gap-1 flex-col sm:flex-row">
          <span className="font-bold">{Code}</span>
          <span
            data-trend={trend}
            className="data-[trend=up]:text-green-600 data-[trend=down]:text-red-600"
          >
            {Math.round(PercentDifference)}%
          </span>
        </span>
        <span>
          {Count} / {grouping} ({Math.round(Average)})
        </span>
      </span>
    </button>
  );
}

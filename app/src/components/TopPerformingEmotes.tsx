import { useEmoteAveragePerformance, usePerformanceGrouping } from "@/hooks";
import { EmotePerformance } from "@/types";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import React from "react";

export interface TopPerformingEmotesProps {
  children?: React.ReactNode;
  className?: string;
}

export function TopPerformingEmotes() {
  const grouping = usePerformanceGrouping();
  const { data: emotePerformance } = useEmoteAveragePerformance({
    grouping,
  });
  return (
    <section>
      <div className="flex gap-2">
        {emotePerformance?.Emotes?.filter((e) => e.Difference != 0)
          .slice(0, 5)
          .map((e) => (
            <EmotePerformanceCard emotePerformance={e} key={e.Code} />
          ))}
      </div>
      <span className="text-xs">current / grouping (avg)</span>
    </section>
  );
}

interface EmotePerformanceCardProps {
  emotePerformance: EmotePerformance;
}

function EmotePerformanceCard({ emotePerformance }: EmotePerformanceCardProps) {
  const grouping = usePerformanceGrouping();
  const { Code, DaySum, PercentDifference, Average } = emotePerformance;
  const trend = PercentDifference > 0 ? "up" : "down";
  const ArrowIcon = trend === "up" ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-white text-xs flex-col sm:flex-row">
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
          {DaySum} {grouping} ({Math.round(Average)})
        </span>
      </span>
    </div>
  );
}

import { useEmoteGrowth } from "@/hooks";
import { EmotePerformance } from "@/types";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import React from "react";

export interface TopPerformingEmotesProps {
  children?: React.ReactNode;
  className?: string;
}

export function TopGrowthEmotes() {
  const { data: emotePerformance } = useEmoteGrowth();
  return (
    <div className="flex gap-5 justify-center w-full">
      {emotePerformance?.Emotes?.filter((e) => e.Difference != 0 && e.Count > 0)
        .slice(0, 5)
        .map((e) => (
          <EmotePerformanceCard
            emotePerformance={e}
            key={e.Code}
            grouping={emotePerformance?.Input?.Grouping}
          />
        ))}
    </div>
  );
}

interface EmotePerformanceCardProps {
  emotePerformance: EmotePerformance;
  grouping: string;
}

export function EmotePerformanceCard({
  emotePerformance,
  grouping,
}: EmotePerformanceCardProps) {
  const { Code, Count, PercentDifference, Average } = emotePerformance;
  const trend = PercentDifference > 0 ? "up" : "down";
  const ArrowIcon = trend === "up" ? ArrowUp : ArrowDown;

  return (
    <Link
      className="flex items-center gap-2 rounded-lg bg-white text-xs flex-col sm:flex-row hover:bg-gray-100"
      to={"/"}
      search={(prev) => ({ ...prev, focusedEmote: emotePerformance.EmoteID })}
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
    </Link>
  );
}

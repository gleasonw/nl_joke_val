import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import React from "react";

export interface TopPerformingEmotesProps {
  children?: React.ReactNode;
  className?: string;
}

export function TopPerformingEmotes() {
  return (
    <div className="flex gap-2 overflow-x-auto items-center">
      <EmotePerformanceCard
        emotePerformance={{
          emote: { Code: "test" },
          pastAverageUsage: 100,
          currentUsage: 101,
          pastPercentUsage: 0.5,
        }}
      />
      <EmotePerformanceCard
        emotePerformance={{
          emote: { Code: "test" },
          pastAverageUsage: 100,
          currentUsage: 89,
          pastPercentUsage: 0.5,
        }}
      />
      <EmotePerformanceCard
        emotePerformance={{
          emote: { Code: "test" },
          pastAverageUsage: 100,
          currentUsage: 101,
          pastPercentUsage: 0.5,
        }}
      />
    </div>
  );
}

interface EmotePerformanceCardProps {
  emotePerformance: {
    emote: {
      Code: string;
    };
    pastAverageUsage: number;
    currentUsage: number;
    pastPercentUsage: number;
  };
}

function EmotePerformanceCard({ emotePerformance }: EmotePerformanceCardProps) {
  const {
    emote,
    pastAverageUsage: averageUsage,
    currentUsage,
    pastPercentUsage: percentUsage,
  } = emotePerformance;
  const trend = currentUsage > averageUsage ? "up" : "down";
  const ArrowIcon = trend === "up" ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white text-xs">
      <ArrowIcon
        className={clsx("h-8 w-8 p-2 rounded", {
          "text-green-500": trend === "up",
          "bg-green-100": trend === "up",
          "text-red-500": trend === "down",
          "bg-red-100": trend === "down",
        })}
      />
      <span className="flex flex-col">
        <span className="font-bold">{emote.Code}</span>
        <span>{averageUsage}</span>
      </span>
      <span className="flex flex-col">
        <span>{percentUsage}</span>
        <span>{currentUsage}</span>
      </span>
    </div>
  );
}

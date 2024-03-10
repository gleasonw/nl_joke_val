import { createLazyFileRoute } from "@tanstack/react-router";
import { useLiveStatus, useTimeSeries } from "../hooks";
import React from "react";
import { Chart } from "../components/Chart";
import { TopPerformingEmotes } from "@/components/TopPerformingEmotes";
import { ClipAtTime } from "@/components/ClipAtTime";
import { TopClips } from "@/components/TopClips";
import { MinClips } from "@/components/MinClips";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const [{ data: localFetchedSeries }] = useTimeSeries();
  let timeRangeString = "";

  const lowestTime = localFetchedSeries?.[0]?.time;
  const highestTime = localFetchedSeries?.[localFetchedSeries.length - 1]?.time;

  if (lowestTime && highestTime) {
    const lowestDate = new Date(lowestTime);
    const highestDate = new Date(highestTime);
    timeRangeString = `${lowestDate.toLocaleString()} - ${highestDate.toLocaleTimeString()}`;
  }

  return (
    <div className="max-w-7xl mx-auto my-2 p-4 bg-white shadow-lg rounded-lg grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex flex-col">
        <h1 className="text-3xl font-semibold">The NL chat dashboard</h1>
        <div className="flex gap-4">
          <LiveStatus />
          <TopPerformingEmotes />
        </div>
        {timeRangeString && (
          <div className="flex gap-4 my-4">
            <span className="text-xs">{timeRangeString}</span>
          </div>
        )}
        <Chart />
        <ClipAtTime />
      </div>
      <TopClips />
      <MinClips />
    </div>
  );
}

export function LiveStatus() {
  const { data: nlIsLive } = useLiveStatus();
  if (nlIsLive) {
    return (
      <span className="flex text-2xl gap-2 items-center">
        <span className="bg-green-500 rounded-full w-4 h-4" />
        <a
          href="https://twitch.tv/northernlion"
          target="_blank"
          className="underline"
          rel="noreferrer"
        >
          Live
        </a>
      </span>
    );
  }
  return <span className="text-gray-500 text-2xl">Offline</span>;
}

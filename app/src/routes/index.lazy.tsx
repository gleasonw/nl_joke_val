import { createLazyFileRoute } from "@tanstack/react-router";
import { useLiveStatus, useTimeSeries } from "../hooks";
import React from "react";
import { Chart } from "../components/Chart";
import { TopPerformingEmotes } from "@/components/TopPerformingEmotes";
import { ClipAtTime } from "@/components/ClipAtTime";
import { TopClips } from "@/components/TopClips";
import { MinClips } from "@/components/MinClips";
import { DatePicker } from "@/components/DatePicker";

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
    <div>
      <div className=" mx-auto p-4 bg-white shadow-lg rounded-lg grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-4 my-4 items-center">
            <span className="text-xs">{timeRangeString}</span>
            <DatePicker />
          </div>
          <TopPerformingEmotes />
          <Chart />
          <ClipAtTime />
        </div>
        <TopClips />
        <MinClips />
      </div>
    </div>
  );
}

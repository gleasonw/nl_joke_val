import { createLazyFileRoute } from "@tanstack/react-router";
import { useLiveStatus, useTimeSeries } from "../hooks";
import React from "react";
import { Chart } from "../components/Chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
    timeRangeString = `${lowestDate.toLocaleString()} - ${highestDate.toLocaleString()}`;
  }

  return (
    <div className="max-w-7xl mx-auto my-8 p-4 bg-white shadow-lg rounded-lg">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-3xl font-semibold">Emote Usage Dashboard</h1>
        <div className="flex space-x-2">
          <Button variant="outline">Follow</Button>
          <Button variant="outline">Share</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 my-4">
        <Badge variant="secondary">1D</Badge>
        <Badge>5D</Badge>
        <Badge>1M</Badge>
        <Badge>6M</Badge>
        <Badge>YTD</Badge>
        <Badge>1Y</Badge>
        <Badge>5Y</Badge>
        <Badge>MAX</Badge>
        <Button variant="secondary">Key events</Button>
      </div>
      <div className="flex gap-4 my-4">
        <Input
          className="rounded-full w-full max-w-xs"
          placeholder="Search for base emote"
          type="search"
        />
        <div className="flex gap-2">
          <div className="flex items-center bg-green-500 text-white rounded-full px-2 py-1">
            <span>HappyEmote</span>
            <span className="ml-1">14,500 uses</span>
          </div>
          <div className="flex items-center bg-red-500 text-white rounded-full px-2 py-1">
            <span>SadEmote</span>
            <span className="ml-1">11,200 uses</span>
          </div>
          <div className="flex items-center bg-blue-500 text-white rounded-full px-2 py-1">
            <span>WowEmote</span>
            <span className="ml-1">9,850 uses</span>
          </div>
        </div>
      </div>
      <Chart />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Top Emotes</h2>
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <span>HappyEmote</span>
              <span>14,500 uses</span>
            </div>
            <div className="flex justify-between items-center">
              <span>SadEmote</span>
              <span>11,200 uses</span>
            </div>
            <div className="flex justify-between items-center">
              <span>WowEmote</span>
              <span>9,850 uses</span>
            </div>
            <Button variant="outline">Add comparison</Button>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Emote Details</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>Previous Peak</span>
              <span>15,300 uses</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Lowest Point</span>
              <span>3,100 uses</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Average Per Stream</span>
              <span>7,500 uses</span>
            </div>
          </div>
        </div>
      </div>
      <div className="my-4">
        <h2 className="text-xl font-semibold mb-2">Financials</h2>
        <div className="flex justify-between items-center mb-2">
          <Badge variant="secondary">Quarterly</Badge>
          <Badge>Annual</Badge>
        </div>
        <div className="w-full h-[300px]">Bar chart</div>
      </div>
      <div className="my-4">
        <h2 className="text-xl font-semibold mb-2">About</h2>
        <p>
          This dashboard provides insights into the usage of emotes during live
          streams. It helps to track the popularity and engagement of specific
          emotes over time.
        </p>
      </div>
      <div className="my-4">
        <h2 className="text-xl font-semibold mb-2">Stream Video</h2>
        <div className="aspect-[16/9] bg-gray-200 rounded-lg" />
      </div>
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

import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  useDashboardState,
  useLiveStatus,
  useLiveTimeSeries,
  useNextStreamDate,
  usePreviousStreamDate,
  useTimeSeries,
} from "../hooks";
import React, { Suspense } from "react";
import { Chart } from "../components/Chart";
import { TopGrowthEmotes } from "@/components/TopPerformingEmotes";
import { ClipAtTime } from "@/components/ClipAtTime";
import { DatePicker } from "@/components/DatePicker";
import { DataTable } from "@/components/DataTable";
import { DayFocusClip } from "@/components/DayFocusClip";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LiveTopPerformingEmotes } from "@/components/LiveTopPerformingEmotes";
import { ArrowLeft, ArrowRight } from "lucide-react";

const loadingPhrases = [
  "Reticulating splines...",
  "Loading...",
  "Summoning...",
  "Calculating...",
  "Generating...",
  "Analyzing...",
  "Processing...",
  "Computing...",
  "Generating...",
  "Chargement...",
  "Firing up...😎",
] as const;
// bug with resetting state when clicking table row
// always use created_at ranges with queries... timescaledb index

function loadingStatement() {
  const index = Math.floor(Math.random() * loadingPhrases.length);
  return loadingPhrases[index];
}

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const { data: isNlLive } = useLiveStatus();
  const { from } = useDashboardState();

  const isLiveView = isNlLive && !from;

  return (
    <AnimatePresence>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-32">
            {loadingStatement()}
          </div>
        }
      >
        {isLiveView ? <LiveView /> : <HistoricalView />}
      </Suspense>
    </AnimatePresence>
  );
}

function LiveView() {
  const { data: localFetchedSeries, isLoading } = useLiveTimeSeries();

  return (
    <div className="flex flex-col gap-2">
      <section className="flex flex-col gap-2 justify-center items-center">
        <DateDisplay />
        <LiveTopPerformingEmotes />
      </section>
      <Chart data={localFetchedSeries} isLoading={isLoading} />
      <ClipAtTime />
    </div>
  );
}

function HistoricalView() {
  const { data: localFetchedSeries, isLoading } = useTimeSeries();
  const { from } = useDashboardState();

  return localFetchedSeries?.length === 0 && from ? (
    <div className="flex flex-col gap-5 items-center p-10">
      No stream data for {new Date(from).toLocaleString()}
      <Link to="/">
        <Button>Return to latest stream data</Button>
      </Link>
    </div>
  ) : (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <section className="flex flex-col gap-2 justify-center items-center">
        <DateDisplay />
        <TopGrowthEmotes />
      </section>
      <section className="p-4 bg-white shadow-lg rounded-lg flex flex-col gap-4">
        <div className="  grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Chart data={localFetchedSeries} isLoading={isLoading} />
          </div>
          <div className="flex flex-col gap-2">
            <DayFocusClip />
            <ClipAtTime />
          </div>
        </div>
        <DataTable />
      </section>
    </motion.div>
  );
}

export function DateDisplay() {
  const { data: localFetchedSeries } = useTimeSeries();
  const { from } = useDashboardState();
  let timeRangeString = "";

  const lowestTime = localFetchedSeries?.[0]?.time;
  const highestTime = localFetchedSeries?.[localFetchedSeries.length - 1]?.time;

  if (lowestTime && highestTime && from) {
    const lowestDate = new Date(lowestTime);
    const highestDate = new Date(highestTime);
    timeRangeString = `${lowestDate.toLocaleTimeString()} - ${highestDate.toLocaleTimeString()}`;
  } else if (lowestTime && highestTime) {
    const lowestDate = new Date(lowestTime);
    const highestDate = new Date(highestTime);
    timeRangeString = `${lowestDate.toLocaleString()} - ${highestDate.toLocaleTimeString()}`;
  }
  return (
    <div className="flex items-center justify-between">
      <PreviousDayButton />

      <div className="flex gap-4 items-left w-full my-4 items-center p-2">
        <DatePicker />
        {!from ? (
          <span className=" text-gray-800">
            Latest stream: {timeRangeString}
          </span>
        ) : (
          <span className="text-xs text-gray-800">{timeRangeString}</span>
        )}
      </div>

      <NextDayButton />
    </div>
  );
}

export function PreviousDayButton() {
  const { data: previousStreamDate } = usePreviousStreamDate();

  return (
    <Link to="/" search={(prev) => ({ ...prev, from: previousStreamDate })}>
      <Button variant="ghost">
        <ArrowLeft />
      </Button>
    </Link>
  );
}

export function NextDayButton() {
  const { from } = useDashboardState();
  const { data: nextStreamDate } = useNextStreamDate();

  if (!from) {
    return null;
  }

  return (
    <Link to="/" search={(prev) => ({ ...prev, from: nextStreamDate })}>
      <Button variant="ghost">
        <ArrowRight />
      </Button>
    </Link>
  );
}

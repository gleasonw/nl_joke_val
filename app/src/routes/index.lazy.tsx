import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  useDashboardState,
  useLiveStatus,
  useLiveTrendyTimeSeries,
  useNextStreamDate,
  usePlottedEmotes,
  usePreviousStreamDate,
  useSeriesState,
  useGreatestTimeSeries,
  useTimeSeries,
  useLiveTimeSeries,
} from "../hooks";
import React, { Suspense } from "react";
import { Chart, ChartOptions } from "../components/Chart";
import { ClipAtTime } from "@/components/ClipAtTime";
import { DatePicker } from "@/components/DatePicker";
import { HistoricalDataTable, LiveDataTable } from "@/components/DataTable";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LiveTopPerformingEmotes } from "@/components/LiveTopPerformingEmotes";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  HistoricalMinusTwoClip,
  HistoricalPlusTwoClip,
} from "@/components/HistoricalClipHeroes";
import { EmoteImage } from "@/components/TopPerformingEmotes";
import { EmoteInput } from "@/components/EmoteInput";
import { LiveChart } from "@/components/LiveChart";

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
          <div className="flex h-32 items-center justify-center">
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
  // todo: the route we fetch this data from is coupled to usePlottedEmotes. We should really return the plotted
  // emotes from this hook
  const { data: localFetchedSeries, isLoading } = useLiveTimeSeries();

  return (
    <div className="flex flex-col gap-5">
      <DateDisplay />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveChart data={localFetchedSeries} isLoading={isLoading} />
          <ClipAtTime />
        </div>
        <LiveDataTable />
      </div>
    </div>
  );
}

function HistoricalView() {
  const plottedEmotes = usePlottedEmotes();

  const { data: seriesData, isLoading } = useTimeSeries({
    emote_ids: plottedEmotes.map((e) => e.ID),
  });

  const { from } = useDashboardState();

  return seriesData?.length === 0 && from ? (
    <div className="flex flex-col items-center gap-5 p-10">
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
      <DateDisplay />
      <section className="flex flex-col gap-4 rounded-lg bg-white shadow-lg lg:p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <HistoricalPlusTwoClip />
          <HistoricalMinusTwoClip />
          <div className="lg:row-span-2">
            <HistoricalDataTable />
          </div>
          <div className="lg:col-span-2">
            <section className="border-rounded border border-gray-300 p-1 shadow-sm">
              <span className="flex flex-wrap items-center gap-2">
                <p>top emote usage over time</p>
                <PlottedEmotes />
                <EmoteInput />
              </span>
              <Chart data={seriesData} isLoading={isLoading} />
              <section className="flex items-end gap-3">
                <ChartOptions />
              </section>
            </section>
            <ClipAtTime />
          </div>
        </div>
      </section>
    </motion.div>
  );
}

export function PlottedEmotes() {
  const topFive = usePlottedEmotes();
  const [, handleUpdateSeries] = useSeriesState();

  return (
    <span className="flex flex-wrap gap-1">
      {topFive?.map((e) => (
        <Button
          onClick={() => handleUpdateSeries(e.ID)}
          variant="ghost"
          key={e.Code}
          style={{ background: e.HexColor }}
          className="rounded-md p-1"
        >
          <EmoteImage emote={e} />
        </Button>
      ))}
    </span>
  );
}

export function DateDisplay() {
  const { data: localFetchedSeries } = useGreatestTimeSeries();
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
    <div className="flex flex-wrap items-center justify-center">
      <PreviousDayButton />
      <div className="items-left my-4 flex items-center gap-4 p-2">
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

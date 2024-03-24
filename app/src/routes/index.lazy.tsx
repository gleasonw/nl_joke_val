import { createLazyFileRoute } from "@tanstack/react-router";
import { useDashboardState, useTimeSeries } from "../hooks";
import React, { Suspense } from "react";
import { Chart } from "../components/Chart";
import { TopPerformingEmotes } from "@/components/TopPerformingEmotes";
import { ClipAtTime } from "@/components/ClipAtTime";
import { DatePicker } from "@/components/DatePicker";
import { DataTable } from "@/components/DataTable";
import { DayFocusClip } from "@/components/DayFocusClip";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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
  const [{ data: localFetchedSeries }] = useTimeSeries();
  const [{ from }, handleUpdateChart] = useDashboardState();

  return (
    <AnimatePresence>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-32">
            {loadingStatement()}
          </div>
        }
      >
        {localFetchedSeries?.length === 0 && from ? (
          <div className="flex flex-col gap-5 items-center p-10">
            No stream data for {new Date(from).toLocaleString()}
            <Button onClick={() => handleUpdateChart({ from: undefined })}>
              Return to latest stream data
            </Button>
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
              <TopPerformingEmotes />
            </section>
            <section className="p-4 bg-white shadow-lg rounded-lg flex flex-col gap-4">
              <div className="  grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Chart />
                </div>
                <div className="flex flex-col gap-2">
                  <DayFocusClip />
                  <ClipAtTime />
                </div>
              </div>
              <DataTable />
            </section>
          </motion.div>
        )}
      </Suspense>
    </AnimatePresence>
  );
}

export function DateDisplay() {
  const [{ data: localFetchedSeries }] = useTimeSeries();
  const [{ from }] = useDashboardState();
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
    <div className="flex gap-4 items-left w-full my-4 items-center p-2">
      <DatePicker />
      {!from ? (
        <span className="text-xs text-gray-800">
          Using latest stream data: {timeRangeString}
        </span>
      ) : (
        <span className="text-xs text-gray-800">{timeRangeString}</span>
      )}
    </div>
  );
}

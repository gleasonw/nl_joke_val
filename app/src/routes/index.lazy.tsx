import { createLazyFileRoute } from "@tanstack/react-router";
import { useTimeSeries } from "../hooks";
import React, { Suspense } from "react";
import { Chart } from "../components/Chart";
import { TopPerformingEmotes } from "@/components/TopPerformingEmotes";
import { ClipAtTime } from "@/components/ClipAtTime";
import { DatePicker } from "@/components/DatePicker";
import { DataTable } from "@/components/DataTable";
import { DayFocusClip } from "@/components/DayFocusClip";
import { AnimatePresence, motion } from "framer-motion";

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
    <AnimatePresence>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-32">
            Cooking...
          </div>
        }
      >
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <section className="flex flex-col gap-2 justify-center items-center">
            <div className="flex gap-4 my-4 items-center">
              <span className="text-xs">{timeRangeString}</span>
              <DatePicker />
            </div>
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
      </Suspense>
    </AnimatePresence>
  );
}

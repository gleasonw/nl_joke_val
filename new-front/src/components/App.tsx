"use client";

import { InitialArgState } from "@/app/page";
import Dashboard, { ClipBatch, SeriesData } from "@/components/Dashboard";
import {
  Hydrate,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
// hmm

export type DataProps = {
  initialArgState: InitialArgState;
  initialSeries: SeriesData[];
  initialMaxClips: ClipBatch;
  initialMinClips: ClipBatch;
};

export default function App(props: DataProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard
        initialArgState={props.initialArgState}
        initialSeries={props.initialSeries}
        initialMaxClips={props.initialMaxClips}
        initialMinClips={props.initialMinClips}
      />
    </QueryClientProvider>
  );
}

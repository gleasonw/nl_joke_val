"use client";

import Dashboard from "@/components/Dashboard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// hmm

export default function App() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <main>
        <Dashboard />
      </main>
    </QueryClientProvider>
  );
}

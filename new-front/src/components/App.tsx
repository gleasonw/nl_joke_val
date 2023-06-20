"use client";

import Dashboard from "@/components/Dashboard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function App() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <Dashboard />
    </QueryClientProvider>
  );
}

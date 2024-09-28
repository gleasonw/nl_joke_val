import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { dashboardURLStateSchema } from "../utils";
import React from "react";
import { Info, LineChart, Trophy } from "lucide-react";
import { useLiveStatus } from "@/hooks";

export const Route = createRootRoute({
  validateSearch: dashboardURLStateSchema,
  component: () => (
    <>
      <div className="flex items-center gap-4 p-2">
        <h1 className="text-3xl font-semibold">The NL chat dashboard</h1>
        <LiveStatus />
        <span className="flex gap-10">
          <Link
            to="/"
            activeProps={{
              style: { fontWeight: "bold", borderBottom: "2px solid" },
            }}
            className="flex gap-2"
          >
            <span>Stream data</span>
            <LineChart />
          </Link>
          <Link
            to="/all-time"
            activeProps={{
              style: { fontWeight: "bold", borderBottom: "2px solid" },
            }}
            className="flex gap-2"
          >
            <span>Hall of fame</span>
            <Trophy />
          </Link>
        </span>
        <Link to="/about" className="ml-auto">
          <Info />
        </Link>
      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});

export function LiveStatus() {
  const { data: nlIsLive } = useLiveStatus();
  if (nlIsLive) {
    return (
      <span className="flex items-center gap-2 text-2xl">
        <span className="h-4 w-4 rounded-full bg-green-500" />
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
  return <span className="text-2xl text-gray-500">Offline</span>;
}

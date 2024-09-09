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
        <span className="ml-auto flex gap-4">
          <Link to="/all-time">
            <Trophy />
          </Link>
          <Link to="/">
            <LineChart />
          </Link>
          <Link to="/about">
            <Info />
          </Link>
        </span>
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

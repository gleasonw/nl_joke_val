import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { dashboardURLStateSchema } from "../utils";
import React from "react";
import { Info, LineChart } from "lucide-react";
import { useLiveStatus } from "@/hooks";

export const Route = createRootRoute({
  validateSearch: dashboardURLStateSchema,
  component: () => (
    <>
      <div className="flex gap-4 items-center p-2">
        <h1 className="text-3xl font-semibold">The NL chat dashboard</h1>
        <LiveStatus />
        <span className="flex gap-4 ml-auto">
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

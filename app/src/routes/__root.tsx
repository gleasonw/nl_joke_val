import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { dashboardURLStateSchema } from "../utils";
// @ts-expect-error - this is a valid import
import React from "react";
import { Info } from "lucide-react";

export const Route = createRootRoute({
  validateSearch: dashboardURLStateSchema,
  component: () => (
    <>
      <Link
        to="/about"
        className="[&.active]:font-bold absolute top-0 right-0 z-10 p-3"
      >
        <Info />
      </Link>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});

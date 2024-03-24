import { getClipAtTime } from "../api";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { TwitchClip } from "./TwitchClip";
import { Route } from "../routes/index.lazy";

export function ClipAtTime() {
  const { clickedUnixSeconds } = Route.useSearch();

  const { data: clip } = useQuery({
    queryFn: () =>
      getClipAtTime({
        time: clickedUnixSeconds
          ? new Date(clickedUnixSeconds * 1000).toISOString()
          : undefined,
      }),
    queryKey: ["clip", clickedUnixSeconds],
    refetchInterval: 1000 * 30,
  });

  if (!clip || !clickedUnixSeconds) {
    return (
      <div className="flex justify-center items-center aspect-video border border-gray-300">
        {!clickedUnixSeconds ? (
          <div>Click on the chart to pull the nearest clip</div>
        ) : (
          <div>No clip found</div>
        )}
      </div>
    );
  }

  if (clip.clip_id === "no_clip" || clip.clip_id === "") {
    return (
      <div className="flex justify-center items-center aspect-video border border-gray-300">
        <div>No clip available for that timestamp</div>
      </div>
    );
  }

  return (
    <TwitchClip
      clip_id={clip.clip_id}
      time={new Date(clickedUnixSeconds * 1000).toLocaleString()}
    />
  );
}

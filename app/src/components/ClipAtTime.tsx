import { getClipAtTime } from "../api";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { TwitchClip } from "./TwitchClip";
import { Route } from "../routes/index.lazy";

export function ClipAtTime() {
  const { clickedUnixSeconds } = Route.useSearch();

  const { data: clip } = useQuery({
    queryFn: () => getClipAtTime({ time: clickedUnixSeconds }),
    queryKey: ["clip", clickedUnixSeconds],
    refetchInterval: 1000 * 30,
  });

  if (!clickedUnixSeconds) {
    return <div>Click on the chart to pull the nearest clip</div>;
  }

  if (!clip) {
    return <div>No clip found</div>;
  }

  return (
    <TwitchClip
      clip_id={clip.clip_id}
      time={new Date(clickedUnixSeconds * 1000).toLocaleString()}
    />
  );
}

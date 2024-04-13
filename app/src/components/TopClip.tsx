import { getClips } from "../api";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ClipClicker } from "./ClipClicker";
import { Route } from "@/routes/index.lazy";
import { ClipParams } from "@/types";

export interface TopClipProps {
  clipParams: ClipParams;
  title?: React.ReactNode;
}

export function TopClip({ clipParams, title }: TopClipProps) {
  const [index, setIndex] = React.useState(0);
  const { from } = Route.useSearch();

  const { data: fetchedClips, isLoading } = useQuery({
    queryFn: () => getClips({ ...clipParams, from }),
    queryKey: ["clips", clipParams, from],
    refetchInterval: 1000 * 30,
  });

  const currentClip = fetchedClips?.at(index);

  if (isLoading) {
    return (
      <span className="w-full aspect-video bg-gray-200 flex flex-col justify-center items-center animate-pulse" />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        {title ? title : null}
        <span className="pl-4 text-opacity-90">
          ({currentClip?.count} in {clipParams?.grouping})
        </span>
      </div>
      <ClipClicker
        clips={fetchedClips ?? []}
        index={index}
        setIndex={(index) => setIndex(index)}
      />
    </div>
  );
}

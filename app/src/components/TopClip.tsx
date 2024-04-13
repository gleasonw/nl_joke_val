import { getClips } from "../api";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Route } from "@/routes/index.lazy";
import { ClipParams } from "@/types";
import { Button } from "@/components/ui/button";
import { TwitchClip } from "@/components/TwitchClip";

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
      <span className="flex aspect-video w-full animate-pulse flex-col items-center justify-center bg-gray-200" />
    );
  }

  if (!currentClip || !fetchedClips) {
    return <div>No clips.</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        {title ? title : null}
        <span className="pl-4 text-opacity-90">
          ({currentClip?.count} in {clipParams?.grouping})
        </span>
        <Button
          onClick={() => setIndex(index - 1)}
          disabled={index === 0}
          variant="ghost"
        >
          Previous
        </Button>
        <Button
          onClick={() => setIndex(index + 1)}
          disabled={index === fetchedClips?.length - 1}
          variant="ghost"
        >
          Next
        </Button>
      </div>
      <TwitchClip clip_id={currentClip.clip_id} />
    </div>
  );
}

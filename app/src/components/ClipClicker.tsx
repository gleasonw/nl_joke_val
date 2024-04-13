import React from "react";
import { TwitchClip } from "./TwitchClip";
import { Clip } from "../types";
import { Button } from "@/components/ui/button";

export interface ClipClickerProps {
  children?: React.ReactNode;
  clips: Clip[];
  index: number;
  setIndex: (index: number) => void;
}

export function ClipClicker({ clips, index, setIndex }: ClipClickerProps) {
  if (!clips || clips.length === 0) {
    return <div className="w-full aspect-video bg-gray-100 animate-pulse" />;
  }

  const clip = clips[index];
  if (!clip) {
    return <div>No clip found</div>;
  }
  const totalClipCount = clips.length;

  return (
    <div className={`flex flex-col gap-5 `}>
      <TwitchClip clip_id={clip.clip_id!} />
      <div className="flex gap-2">
        <Button onClick={() => setIndex(index - 1)} disabled={index === 0}>
          Previous
        </Button>
        <Button
          onClick={() => setIndex(index + 1)}
          disabled={index === totalClipCount - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

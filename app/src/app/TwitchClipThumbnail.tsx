"use client";
import { Text } from "@tremor/react";
import { useState } from "react";
import { Clip, TwitchClip } from "./dashboard";

export function TwitchClipThumbnail({ clip_id, count, time, thumbnail }: Clip) {
  const [isClipRevealed, setIsClipRevealed] = useState(false);
  const timeString = new Date(time * 1000).toLocaleString();
  if (isClipRevealed) {
    return <TwitchClip clip_id={clip_id} time={time} />;
  } else {
    return (
      <button
        className={"flex flex-col items-center justify-between border"}
        onClick={() => setIsClipRevealed(true)}
      >
        <Text className={"text-lg"}>{timeString}</Text>
        {/* <Image
                  alt={`Twitch clip thumbnail at ${timeString}, with ${count} ${
                    count === 1 ? "emote" : "emotes"
                  }`}
                  src={thumbnail}
                  onClick={() => setIsClipRevealed(true)}
                  width={384}
                  height={218}
                /> */}
      </button>
    );
  }
}

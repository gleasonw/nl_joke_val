import React from "react";

export function TwitchClip({ clip_id }: { clip_id: string }) {
  return (
    <span>
      <iframe
        src={`https://clips.twitch.tv/embed?clip=${clip_id}&parent=${window.location.hostname}`}
        width="100%"
        className="aspect-video"
        allowFullScreen={true}
      />
    </span>
  );
}

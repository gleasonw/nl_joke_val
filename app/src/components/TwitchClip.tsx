import React from "react";

export function TwitchClip({
  clip_id,
  time,
}: {
  clip_id: string;
  time?: string;
}) {
  const formattedTime = time ? new Date(time).toLocaleString() : "";

  return (
    <span>
      {time && (
        <span className={"m-5 text-center text-gray-500"}>{formattedTime}</span>
      )}
      <iframe
        src={`https://clips.twitch.tv/embed?clip=${clip_id}&parent=${window.location.hostname}`}
        width="100%"
        className="aspect-video"
        allowFullScreen={true}
      />
    </span>
  );
}

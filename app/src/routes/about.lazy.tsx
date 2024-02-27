import { createLazyFileRoute } from "@tanstack/react-router";
import React from "react";

export const Route = createLazyFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <section className="flex flex-col gap-10 p-10">
      <p>
        Imagine a world where a Twitch bot sits in NLs chat. The bot counts
        emotes. Every 10 seconds, the bot posts the tally to a database.
      </p>
      <p className="text-balance">
        This is our world. A database of emote counts since April 2023. What
        will we do with it? Whatever will we do?
      </p>
      <p className="text-balance">
        So far,{" "}
        <a href="/" className="underline">
          this.
        </a>
      </p>
    </section>
  );
}

import { components, paths } from "@/app/schema";
import path from "path";

export type FullChatCountStruct = components["schemas"]["ChatCounts"];
export type ChatCounts = Omit<FullChatCountStruct, "time">;

export type TimeSpans = NonNullable<
  paths["/api/series"]["get"]["parameters"]["query"]
>["span"];

export type TimeGroupings = NonNullable<
  paths["/api/series"]["get"]["parameters"]["query"]
>["grouping"];

export type ClipTimeSpans = NonNullable<
  paths["/api/clip_counts"]["get"]["parameters"]["query"]
>["span"];

export type Clip = components["schemas"]["Clip"];

export type SeriesKey = keyof ChatCounts;
export type SeriesData = ChatCounts;

export type ClipParams =
  paths["/api/clip_counts"]["get"]["parameters"]["query"];
export type SeriesParams = paths["/api/series"]["get"]["parameters"]["query"];

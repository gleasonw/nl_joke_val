import { components, paths } from "@/app/schema";

export type FullChatCountStruct = components["schemas"]["ChatCounts"];
export type ChatCounts = Omit<FullChatCountStruct, "time">;

export type TimeSpans = NonNullable<
  paths["/api/series"]["get"]["parameters"]["query"]
>["span"];

export type TimeGroupings = NonNullable<
  paths["/api/series"]["get"]["parameters"]["query"]
>["grouping"];

export type SeriesKey = keyof ChatCounts;
export type SeriesData = ChatCounts;

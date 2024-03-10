import { components, paths } from "./schema";

export type TimeSpans = NonNullable<
  paths["/api/series"]["get"]["parameters"]["query"]
>["span"];

export type EmoteDensityParams = NonNullable<
  paths["/api/emote_density"]["get"]["parameters"]["query"]
>;

export type EmotePerformanceParams = NonNullable<
  paths["/api/emote_average_performance"]["get"]["parameters"]["query"]
>;

export type TimeGroupings = NonNullable<
  paths["/api/series"]["get"]["parameters"]["query"]
>["grouping"];
export type ClipTimeGroupings = NonNullable<
  paths["/api/clip_counts"]["get"]["parameters"]["query"]
>["grouping"];

export type ClipTimeSpans = NonNullable<
  paths["/api/clip_counts"]["get"]["parameters"]["query"]
>["span"];

export type Clip = components["schemas"]["Clip"];

export type ClipParams =
  paths["/api/clip_counts"]["get"]["parameters"]["query"];
export type SeriesParams = paths["/api/series"]["get"]["parameters"]["query"];

export type EmotePerformance =
  components["schemas"]["EmoteReport"]["Emotes"][number];

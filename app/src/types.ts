import { components, paths } from "./schema";

export type TimeSpans = NonNullable<
  paths["/api/series"]["get"]["parameters"]["query"]
>["span"];

export type TimeSeries = components["schemas"]["TimeSeries"];

export type EmoteSumParams = NonNullable<
  paths["/api/emote_sums"]["get"]["parameters"]["query"]
>;

export type EmoteGrowthParams = NonNullable<
  paths["/api/emote_growth"]["get"]["parameters"]["query"]
>;

export type LatestEmoteGrowthParams = NonNullable<
  paths["/api/latest_emote_growth"]["get"]["parameters"]["query"]
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

export type EmoteSum =
  components["schemas"]["EmoteSumReport"]["Emotes"][number];

export type Emote = components["schemas"]["Emote"];

export type TopClipHeroInput =
  paths["/api/hero_all_time_clips"]["get"]["parameters"]["query"];
export type TopClip = components["schemas"]["TopClip"];
export type EmoteClipResponse = components["schemas"]["EmoteWithClips"];
export type TopClipSpan = NonNullable<
  paths["/api/hero_all_time_clips"]["get"]["parameters"]["query"]
>["span"];

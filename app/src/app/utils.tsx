import { apiURL } from "@/app/apiURL";
import { paths } from "@/app/schema";
import { ClipTimeSpans, TimeGroupings } from "@/app/types";
import createClient from "openapi-fetch";

export function addQueryParamsIfExist(
  url: string,
  params: Record<string, any>
) {
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !Array.isArray(value)
    ) {
      urlParams.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => {
        if (typeof v === "string" && v.length > 0) {
          urlParams.append(key, v);
        }
      });
    }
  });
  return `${url}?${urlParams.toString()}`;
}

export const timeGroupings: NonNullable<TimeGroupings>[] = [
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;

export const clipTimeSpans: NonNullable<ClipTimeSpans>[] = [
  "9 hours",
  "1 week",
  "1 month",
  "1 year",
] as const;

export const { GET } = createClient<paths>({
  baseUrl: apiURL,
});

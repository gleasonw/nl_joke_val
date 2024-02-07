"use client";
import { Title, Select, SelectItem, Card } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import {
  timeGroupings,
  GET,
  clipTimeSpans,
  addQueryParamsIfExist,
} from "@/app/utils";
import { SettingsDropLayout } from "./dashboard";
import { ClipClicker } from "@/app/top-twitch-clips";
import { useDashboardUrl } from "@/app/hooks";
import { apiURL } from "@/app/apiURL";
import { Clip, ClipParams } from "@/app/types";

export function MostMinusTwosClips() {
  const {
    handleNavigate: onNavigate,
    currentParams: {
      minClipGrouping: grouping,
      minClipSpan: span,
      minClipIndex,
    },
  } = useDashboardUrl();

  const {
    data: minClips,
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: ["minus_twos", span, grouping],
    queryFn: async () => {
      const res = await fetch(
        addQueryParamsIfExist(`${apiURL}/api/clip_counts`, {
          column: ["two"],
          span,
          grouping,
          order: "ASC",
        } satisfies ClipParams)
      );
      return (await res.json()) as Clip[];
    },
  });

  const sortedClips = minClips?.sort((a, b) => a.count - b.count);

  return (
    <Card className="flex gap-5 flex-col">
      <div className={"flex flex-col gap-5"}>
        <Title>Lowest 2 count</Title>
        <SettingsDropLayout>
          <label>
            Bin size
            <Select
              value={grouping}
              onValueChange={(value) => onNavigate({ minClipGrouping: value })}
            >
              {timeGroupings.map((grouping) => (
                <SelectItem value={grouping} key={grouping}>
                  {grouping == "second" ? "10 seconds" : grouping}
                </SelectItem>
              ))}
            </Select>
          </label>
          <label>
            Over the past
            <Select
              value={span}
              onValueChange={(value) => onNavigate({ minClipSpan: value })}
            >
              {clipTimeSpans.map((span) => (
                <SelectItem value={span} key={span}>
                  {span}
                </SelectItem>
              ))}
            </Select>
          </label>
        </SettingsDropLayout>
      </div>
      <ClipClicker
        clips={sortedClips ?? []}
        isLoading={isLoading || isRefetching}
        index={minClipIndex}
        setIndex={(index) => onNavigate({ minClipIndex: index })}
      />
    </Card>
  );
}

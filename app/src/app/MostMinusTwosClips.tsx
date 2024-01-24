"use client";
import { Title, Select, SelectItem, Card } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { addQueryParamsIfExist } from "@/app/utils";
import { ClipBatch, SettingsDropLayout } from "./dashboard";
import { ClipClicker } from "@/app/TopTwitchClips";
import { useDashboardUrl } from "@/app/hooks";

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
    isSuccess,
    data: minClips,
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: ["minus_twos", span, grouping],
    queryFn: async () => {
      const rest = await fetch(
        addQueryParamsIfExist(
          "https://nljokeval-production.up.railway.app/api/clip_counts",
          {
            column: "two",
            span,
            grouping,
            order: "asc",
          }
        )
      );
      return (await rest.json()) as ClipBatch;
    },
  });

  const sortedClips = minClips?.clips.sort((a, b) => a.count - b.count);

  return (
    <Card className="flex gap-5 flex-col">
      <div className={"flex flex-col gap-5"}>
        <Title>Lowest 2 count grouped by</Title>
        <SettingsDropLayout>
          <label>
            Grouped by
            <Select
              value={grouping}
              onValueChange={(value) => onNavigate({ minClipGrouping: value })}
            >
              {["second", "minute", "hour"].map((grouping) => (
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
              {["day", "week", "month", "year"].map((span) => (
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

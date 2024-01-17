"use client";
import { Title, Select, SelectItem, Card, List, ListItem } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { addQueryParamsIfExist } from "@/app/utils";
import { clipAPI } from "@/app/apiURL";
import { ClipBatch, GET, SettingsDropLayout } from "./dashboard";
import { TwitchClipThumbnail } from "./TwitchClipThumbnail";
import { ClipClicker } from "@/app/TopTwitchClips";

export function MostMinusTwosClips({
  onNavigate,
}: {
  onNavigate: (newParam: { [key: string]: string | string[] }) => void;
}) {
  const params = useSearchParams();
  const grouping = params.get("minClipGrouping") ?? "second";
  const span = params.get("minClipSpan") ?? "day";

  const {
    isSuccess,
    data: minClips,
    isLoading,
  } = useQuery({
    queryKey: ["minus_twos", span, grouping],
    queryFn: async () => {
      const { data } = await GET("/clips", {
        params: {
          query: {
            cursor: "0",
            span,
            sum_window: grouping,
            emote: ["two"],
            order: "asc",
          },
        },
      });
      return data;
    },
  });

  const sortedClips = minClips?.sort((a, b) => a.rolling_sum - b.rolling_sum);

  return (
    <Card className="flex gap-5 flex-col">
      <div className={"flex flex-row gap-5 flex-wrap"}>
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
      <ClipClicker clips={sortedClips ?? []} />
    </Card>
  );
}

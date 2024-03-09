import { useNavigate } from "@tanstack/react-router";
import { getClips } from "../api";
import { Clip, ClipTimeGroupings, ClipTimeSpans } from "../types";
import { DashboardURLState, clipTimeSpans } from "../utils";
import { useQuery } from "@tanstack/react-query";
import { Card, Title, SelectItem } from "@tremor/react";
import { useDefaultClipParams, useTimeSeries } from "../hooks";
import React from "react";
import { Route } from "../routes/index.lazy";
import { ClipClicker } from "./ClipClicker";
import { ClipBinSizeSelect } from "./ClipBinSizeSelect";
import { LabeledSelect } from "./LabeledSelect";
import { SettingsDropLayout } from "./SettingsDropLayout";

type LocalClipState = NonNullable<DashboardURLState["maxClipParams"]>;

export interface TopClipsProps {
  clips: Clip[];
  params: LocalClipState;
}
export function TopClips() {
  const currentState = Route.useSearch();

  const { maxClipParams, maxClipIndex } = currentState;

  const navigate = useNavigate();

  function handleTopClipNavigate(newParams: LocalClipState) {
    navigate({
      search: {
        ...currentState,
        maxClipParams: {
          ...maxClipParams,
          ...newParams,
        },
      },
    });
  }

  const fetchParams = useDefaultClipParams(maxClipParams);

  const { data: localFetchedClips, isLoading } = useQuery({
    queryFn: () => getClips(fetchParams),
    queryKey: ["clips", maxClipParams],
    refetchInterval: 1000 * 30,
  });

  const [, , emoteIds] = useTimeSeries();

  const sortedClips = localFetchedClips
    ?.sort((a, b) => b.count - a.count)
    .filter((clip) => !!clip.clip_id);

  const { emote_id, grouping, span } = fetchParams;

  return (
    <Card className="flex flex-col gap-5">
      <div className={"flex flex-col gap-3"}>
        <Title>Clips from Top Windows</Title>
        <SettingsDropLayout>
          <LabeledSelect
            label="Emote"
            value={emote_id?.toString()}
            onValueChange={(value) =>
              handleTopClipNavigate({ emote_id: parseInt(value) })
            }
          >
            {emoteIds?.map((emote) => (
              <SelectItem value={emote} key={emote}>
                {emote}
              </SelectItem>
            ))}
          </LabeledSelect>
          <ClipBinSizeSelect
            value={grouping}
            onValueChange={(value) =>
              handleTopClipNavigate({ grouping: value as ClipTimeGroupings })
            }
          />
          <LabeledSelect
            label="Over the past"
            value={span}
            onValueChange={(value) =>
              handleTopClipNavigate({ span: value as ClipTimeSpans })
            }
          >
            {clipTimeSpans.map((span) => (
              <SelectItem value={span} key={span}>
                {span}
              </SelectItem>
            ))}
          </LabeledSelect>
        </SettingsDropLayout>
      </div>
      {isLoading ? (
        <span className="w-full aspect-video bg-gray-200 flex flex-col justify-center items-center animate-pulse" />
      ) : (
        <ClipClicker
          clips={sortedClips ?? []}
          index={maxClipIndex}
          setIndex={(index) =>
            navigate({ search: { ...currentState, maxClipIndex: index } })
          }
        />
      )}
    </Card>
  );
}

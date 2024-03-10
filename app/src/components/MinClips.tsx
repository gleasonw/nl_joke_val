import { useNavigate } from "@tanstack/react-router";
import { getClips } from "../api";
import { ClipTimeGroupings, ClipTimeSpans } from "../types";
import { DashboardURLState, clipTimeSpans } from "../utils";
import { useQuery } from "@tanstack/react-query";
import { useDefaultClipParams } from "../hooks";
import React from "react";
import { Route } from "../routes/index.lazy";
import { ClipClicker } from "./ClipClicker";
import { ClipBinSizeSelect } from "./ClipBinSizeSelect";
import { LabeledSelect } from "./LabeledSelect";
import { SettingsDropLayout } from "./SettingsDropLayout";
import { Card, CardTitle } from "@/components/ui/card";
import { SelectItem } from "@/components/ui/select";

export type LocalMinClipState = NonNullable<DashboardURLState["minClipParams"]>;

export function MinClips() {
  const navigate = useNavigate();

  const currentState = Route.useSearch();

  const { minClipParams, minClipIndex } = currentState;

  function handleMinClipNavigate(newParams: LocalMinClipState) {
    navigate({
      search: {
        ...currentState,
        minClipParams: {
          ...minClipParams,
          ...newParams,
        },
      },
    });
  }

  const fetchParams = useDefaultClipParams(minClipParams);

  const { data: localFetchedClips } = useQuery({
    queryFn: () =>
      getClips({
        ...fetchParams,
        order: "ASC",
      }),
    queryKey: ["clips", fetchParams],
    refetchInterval: 1000 * 30,
  });

  const { grouping, span } = fetchParams;

  const sortedClips = localFetchedClips?.sort((a, b) => a.count - b.count);

  return (
    <Card className="flex gap-5 flex-col">
      <div className={"flex flex-col gap-5"}>
        <CardTitle>Lowest 2 count</CardTitle>
        <SettingsDropLayout>
          <ClipBinSizeSelect
            value={grouping}
            onValueChange={(value) =>
              handleMinClipNavigate({ grouping: value as ClipTimeGroupings })
            }
          />
          <LabeledSelect
            value={span}
            onValueChange={(value) =>
              handleMinClipNavigate({ span: value as ClipTimeSpans })
            }
            label="Over the past"
          >
            {clipTimeSpans.map((span) => (
              <SelectItem value={span} key={span}>
                {span}
              </SelectItem>
            ))}
          </LabeledSelect>
        </SettingsDropLayout>
      </div>
      <ClipClicker
        clips={sortedClips ?? []}
        index={minClipIndex}
        setIndex={(index) =>
          navigate({ search: { ...currentState, minClipIndex: index } })
        }
      />
    </Card>
  );
}

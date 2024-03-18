import { ClipTimeGroupings } from "../types";
import { clipTimeGroupings } from "../utils";
import React from "react";
import { LabeledSelect } from "./LabeledSelect";
import { SelectItem } from "@/components/ui/select";

export function ClipBinSizeSelect({
  onValueChange,
  value,
}: {
  onValueChange: (value: string) => void;
  value: ClipTimeGroupings;
}) {
  return (
    <LabeledSelect label="Bin size" value={value} onValueChange={onValueChange}>
      {clipTimeGroupings.map((grouping) => (
        <SelectItem value={grouping} key={grouping}>
          {grouping}
        </SelectItem>
      ))}
    </LabeledSelect>
  );
}

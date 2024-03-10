import { Select, SelectContent, SelectValue } from "@/components/ui/select";
import { SelectProps, SelectTrigger } from "@radix-ui/react-select";
import React from "react";

export interface LabeledSelectProps extends SelectProps {
  children: React.ReactNode;
  label: string;
}

export function LabeledSelect({
  children,
  label,
  ...props
}: LabeledSelectProps) {
  return (
    <label>
      {label}
      <Select {...props}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}

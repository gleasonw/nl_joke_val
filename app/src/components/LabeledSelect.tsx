import { Select, SelectProps } from "@tremor/react";
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
      <Select {...props}>{children}</Select>
    </label>
  );
}

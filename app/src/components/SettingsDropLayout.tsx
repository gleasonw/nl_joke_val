import React from "react";

export interface SettingsDropLayoutProps {
  children?: React.ReactNode;
}

export function SettingsDropLayout({ children }: SettingsDropLayoutProps) {
  return <div className="flex gap-5 flex-wrap">{children}</div>;
}

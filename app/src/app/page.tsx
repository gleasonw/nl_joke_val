import { useLiveStatus } from "@/app/hooks";
import { dashboardUrlState } from "@/app/server/utils";
import {
  ChartFetcher,
  ClipAtTimeFetcher,
  MinClipFetcher,
  TopClipFetcher,
} from "@/app/clip-server";
import { Suspense } from "react";

export default async function Home({
  searchParams,
}: {
  searchParams: Record<string, any>;
}) {
  const { seriesParams, minClipParams, maxClipParams, clickedUnixSeconds } =
    dashboardUrlState(searchParams);

  return (
    <div className="min-h-screen bg-gray-100 lg:p-8 flex flex-col gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Suspense fallback={<div>Loading chart...</div>}>
          <ChartFetcher params={seriesParams} />
        </Suspense>

        <div className={"flex flex-col gap-8"}>
          <Suspense fallback={<div>Loading clip at clicked time...</div>}>
            <ClipAtTimeFetcher time={clickedUnixSeconds} />
          </Suspense>
          <Suspense fallback={<div>Loading top clips...</div>}>
            <TopClipFetcher params={maxClipParams} />
          </Suspense>
          <Suspense fallback={<div>Loading min clips...</div>}>
            <MinClipFetcher params={minClipParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export interface SettingsDropLayoutProps {
  children?: React.ReactNode;
}

export function SettingsDropLayout({ children }: SettingsDropLayoutProps) {
  return <div className="flex gap-8 flex-wrap">{children}</div>;
}

export function LiveStatus() {
  const { data: nlIsLive } = useLiveStatus();
  if (nlIsLive) {
    return (
      <span className="flex gap-2 items-center">
        <span className="bg-green-500 rounded rounded-full w-4 h-4" />
        <a
          href="https://twitch.tv/northernlion"
          target="_blank"
          className="underline"
        >
          Live
        </a>
      </span>
    );
  }
  return <span className="text-gray-500">Offline</span>;
}

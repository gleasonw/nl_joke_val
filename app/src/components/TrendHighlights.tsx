import React from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmoteGrowth, useLatestEmoteGrowth } from "@/hooks";
import { EmotePerformance } from "@/types";
import { EmoteImage } from "@/components/TopPerformingEmotes";

export interface TrendHighlightsProps {
  variant: "live" | "historical";
  className?: string;
}

export function TrendHighlights({ variant, className }: TrendHighlightsProps) {
  if (variant === "live") {
    return <LiveTrendHighlights className={className} />;
  }

  return <HistoricalTrendHighlights className={className} />;
}

function LiveTrendHighlights({ className }: { className?: string }) {
  const { data, isPending } = useLatestEmoteGrowth();

  return (
    <TrendHighlightsCard
      className={className}
      title="Live trend highlights"
      description="Biggest movers from the last 30 minutes."
      emotes={data?.Emotes ?? []}
      isPending={isPending}
    />
  );
}

function HistoricalTrendHighlights({ className }: { className?: string }) {
  const { data, isPending } = useEmoteGrowth();

  return (
    <TrendHighlightsCard
      className={className}
      title="Stream trend highlights"
      description="How this stream compares to the recent average."
      emotes={data?.Emotes ?? []}
      isPending={isPending}
    />
  );
}

interface TrendHighlightsCardProps {
  className?: string;
  title: string;
  description: string;
  emotes: EmotePerformance[];
  isPending: boolean;
}

function TrendHighlightsCard({
  className,
  title,
  description,
  emotes,
  isPending,
}: TrendHighlightsCardProps) {
  const { topGainer, topDecliner } = React.useMemo(() => {
    let gainer: EmotePerformance | undefined;
    let decliner: EmotePerformance | undefined;

    for (const emote of emotes) {
      if (!emote || emote.Count <= 0) {
        continue;
      }

      const percentDifference = emote.PercentDifference ?? 0;

      if (percentDifference > 0) {
        if (!gainer || percentDifference > (gainer.PercentDifference ?? 0)) {
          gainer = emote;
        }
      }

      if (percentDifference < 0) {
        if (!decliner || percentDifference < (decliner.PercentDifference ?? 0)) {
          decliner = emote;
        }
      }
    }

    return { topGainer: gainer, topDecliner: decliner };
  }, [emotes]);

  return (
    <Card className={clsx("flex h-full flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="flex flex-col gap-3">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : (
          <>
            <TrendRow label="Top gainer" trend="up" emote={topGainer} />
            <TrendRow label="Biggest cooldown" trend="down" emote={topDecliner} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TrendRow({
  label,
  emote,
  trend,
}: {
  label: string;
  emote?: EmotePerformance;
  trend: "up" | "down";
}) {
  const ArrowIcon = trend === "up" ? ArrowUp : ArrowDown;
  const accentStyles =
    trend === "up"
      ? "bg-green-100 text-green-600"
      : "bg-red-100 text-red-600";

  if (!emote) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No {trend === "up" ? "rising" : "cooling"} emotes yet.
      </div>
    );
  }

  const percent = Math.round(emote.PercentDifference ?? 0);
  const average = Math.round(emote.Average ?? 0);
  const count = Math.round(emote.Count ?? 0);

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-4">
      <div className="flex flex-1 items-center gap-3">
        <span className={clsx("flex size-10 items-center justify-center rounded-full", accentStyles)}>
          <ArrowIcon className="h-5 w-5" />
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {label}
          </span>
          <span className="text-base font-semibold leading-tight">{emote.Code}</span>
          <span className="text-sm text-muted-foreground">
            {percent}% vs avg {average} ({count} this stream)
          </span>
        </div>
      </div>
      <EmoteImage
        emote={{ Url: emote.EmoteURL, Code: emote.Code }}
        size="medium"
      />
    </div>
  );
}

function SkeletonRow() {
  return <div className="h-16 animate-pulse rounded-md bg-gray-100" />;
}

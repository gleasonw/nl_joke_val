import { useLiveStatus } from "./routes/index.lazy";
import { ClipParams } from "./types";

export function useDefaultClipParams(
  params?: Record<string, any>
): NonNullable<ClipParams> {
  const { data: isNlLive } = useLiveStatus();

  const defaultClipParams = {
    span: isNlLive ? "30 minutes" : "9 hours",
    grouping: "25 seconds",
  };

  const baseParams = params ? params : defaultClipParams;

  return {
    ...baseParams,
    grouping: baseParams?.grouping ?? defaultClipParams.grouping,
    span: baseParams?.span ?? defaultClipParams.span,
  };
}

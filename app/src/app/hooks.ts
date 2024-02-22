import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiURL } from "@/app/apiURL";
var mergeWith = require("lodash.mergewith");

import {
  DashboardURLState,
  dashboardUrlState,
  dataQueryParam,
} from "@/app/server/utils";

export function useLiveStatus() {
  return useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiURL}/api/is_live`);
      return response.json();
    },
    queryKey: ["liveStatus"],
  });
}

function patchUrlState(
  newParams: Partial<DashboardURLState>,
  oldParams: DashboardURLState | null
): DashboardURLState {
  if (!oldParams) {
    return newParams;
  }

  return mergeWith(oldParams, newParams, (objValue, srcValue) => {
    if (Array.isArray(objValue)) {
      return objValue.concat(srcValue);
    }
  });
}

export function useDashboardUrl() {
  const params = useSearchParams();
  const router = useRouter();

  const jsonStringData = params.get(dataQueryParam);

  const validatedParams = dashboardUrlState(jsonStringData);

  return {
    handleNavigate: (newParams: Partial<DashboardURLState>) => {
      const paramsObject = patchUrlState(newParams, validatedParams);
      const jsonString = JSON.stringify(paramsObject);
      router.push(`?${dataQueryParam}=${encodeURIComponent(jsonString)}`, {
        scroll: false,
      });
    },
    currentParams: validatedParams,
  };
}

"use server";

import { GET } from "@/app/utils";

export async function getLiveStatus() {
  const response = await GET("/api/is_live");
  if (response.error) {
    console.error("Failed to fetch live status");
    return false;
  }
  return response.data;
}

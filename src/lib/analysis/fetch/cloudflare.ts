import type { CloudflareTraceResponse } from "@/lib/analysis/types";

import { normalizeCloudflareTrace } from "../normalize/providers";

export async function fetchCloudflareTrace() {
  try {
    const response = await fetch("/api/cloudflare");

    if (!response.ok) {
      return null;
    }

    return normalizeCloudflareTrace(
      (await response.json()) as CloudflareTraceResponse,
    );
  } catch {
    return null;
  }
}

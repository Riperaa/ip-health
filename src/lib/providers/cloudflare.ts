import { ProviderLookupError } from "./errors";

type TraceMap = Record<string, string>;

export type ProviderResult = {
  ip?: string | null;
  colo?: string | null;
  country?: string | null;
  warp?: string | null;
  raw?: TraceMap;
};

const traceUrl = "https://www.cloudflare.com/cdn-cgi/trace";

function parseTraceResponse(body: string): TraceMap {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<TraceMap>((trace, line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        return trace;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key) {
        trace[key] = value;
      }

      return trace;
    }, {});
}

function parseString(value?: string) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

export async function lookup(): Promise<ProviderResult> {
  try {
    const response = await fetch(traceUrl, {
      headers: {
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new ProviderLookupError(
        "Cloudflare trace request failed.",
        response.status,
      );
    }

    const raw = parseTraceResponse(await response.text());

    return {
      ip: parseString(raw.ip),
      colo: parseString(raw.colo),
      country: parseString(raw.loc ?? raw.country),
      warp: parseString(raw.warp),
      raw,
    };
  } catch (error) {
    if (error instanceof ProviderLookupError) {
      throw error;
    }

    throw new ProviderLookupError("Unable to fetch Cloudflare trace.", 502);
  }
}

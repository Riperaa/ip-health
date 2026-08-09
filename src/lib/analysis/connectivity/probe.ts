export type ConnectivityProbeResult = {
  google: ConnectivityProbeServiceResult;
  youtube: ConnectivityProbeServiceResult;
  openai: ConnectivityProbeServiceResult;
};

export type ConnectivityProbeServiceResult = {
  status: ConnectivityStatus;
  method: ConnectivityProbeMethod;
};

export type ConnectivityStatus =
  "verified_reachable" | "not_verified" | "unreachable";

export type ConnectivityProbeStatus = ConnectivityStatus;

export type ConnectivityProbeMethod = "cors-fetch" | "no-cors-fetch" | "image";

const CONNECTIVITY_PROBE_TIMEOUT_MS = 4000;

const CONNECTIVITY_PROBE_URLS = {
  google: {
    fetch: "https://www.google.com/generate_204",
    image: "https://www.google.com/favicon.ico",
  },
  youtube: {
    fetch: "https://www.youtube.com/favicon.ico",
    image: "https://www.youtube.com/favicon.ico",
  },
  openai: {
    fetch: "https://chat.openai.com/favicon.ico",
    image: "https://chat.openai.com/favicon.ico",
  },
} as const;

function buildProbeResult(
  status: ConnectivityStatus,
  method: ConnectivityProbeMethod,
): ConnectivityProbeServiceResult {
  return {
    status,
    method,
  };
}

function isConnectivityProbeStatus(
  value: unknown,
): value is ConnectivityStatus {
  return (
    value === "verified_reachable" ||
    value === "not_verified" ||
    value === "unreachable"
  );
}

function isConnectivityProbeMethod(
  value: unknown,
): value is ConnectivityProbeMethod {
  return (
    value === "cors-fetch" || value === "no-cors-fetch" || value === "image"
  );
}

function normalizeConnectivityProbeStatus(value: unknown): ConnectivityStatus {
  if (isConnectivityProbeStatus(value)) {
    return value;
  }

  if (value === "unreachable" || value === false) {
    return "unreachable";
  }

  return "not_verified";
}

export function normalizeConnectivityProbeServiceResult(
  value: unknown,
): ConnectivityProbeServiceResult {
  if (value && typeof value === "object") {
    const candidate = value as Partial<ConnectivityProbeServiceResult>;

    return buildProbeResult(
      normalizeConnectivityProbeStatus(candidate.status),
      isConnectivityProbeMethod(candidate.method)
        ? candidate.method
        : "no-cors-fetch",
    );
  }

  return buildProbeResult(
    normalizeConnectivityProbeStatus(value),
    "no-cors-fetch",
  );
}

export function buildConnectivityProbeResult(
  status: ConnectivityStatus,
  method: ConnectivityProbeMethod = "no-cors-fetch",
): ConnectivityProbeResult {
  return {
    google: buildProbeResult(status, method),
    youtube: buildProbeResult(status, method),
    openai: buildProbeResult(status, method),
  };
}

export function isConnectivityProbeReachable(
  result: ConnectivityProbeServiceResult,
) {
  return result.status === "verified_reachable";
}

export function isConnectivityProbeUnreachable(
  result: ConnectivityProbeServiceResult,
) {
  return result.status === "unreachable";
}

async function probeWithCorsFetch(
  url: string,
): Promise<ConnectivityProbeServiceResult> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    CONNECTIVITY_PROBE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller.signal,
    });

    return buildProbeResult(
      response.ok ? "verified_reachable" : "not_verified",
      "cors-fetch",
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function probeWithNoCorsFetch(
  url: string,
): Promise<ConnectivityProbeServiceResult> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    CONNECTIVITY_PROBE_TIMEOUT_MS,
  );

  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });

    return buildProbeResult("not_verified", "no-cors-fetch");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return buildProbeResult("unreachable", "no-cors-fetch");
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function probeWithImage(
  url: string,
): Promise<ConnectivityProbeServiceResult> {
  if (typeof Image === "undefined") {
    return buildProbeResult("not_verified", "image");
  }

  return new Promise((resolve) => {
    const image = new Image();
    const timeoutId = globalThis.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve(buildProbeResult("unreachable", "image"));
    }, CONNECTIVITY_PROBE_TIMEOUT_MS);

    image.onload = () => {
      globalThis.clearTimeout(timeoutId);
      resolve(buildProbeResult("not_verified", "image"));
    };
    image.onerror = () => {
      globalThis.clearTimeout(timeoutId);
      resolve(buildProbeResult("unreachable", "image"));
    };
    image.referrerPolicy = "no-referrer";
    image.src = `${url}${url.includes("?") ? "&" : "?"}ip-health-probe=${Date.now()}`;
  });
}

async function probeUrl({
  fetch: fetchUrl,
  image: imageUrl,
}: (typeof CONNECTIVITY_PROBE_URLS)[keyof typeof CONNECTIVITY_PROBE_URLS]) {
  try {
    return await probeWithCorsFetch(fetchUrl);
  } catch {
    try {
      return await probeWithNoCorsFetch(fetchUrl);
    } catch {
      return probeWithImage(imageUrl);
    }
  }
}

export async function probeConnectivity(): Promise<ConnectivityProbeResult> {
  try {
    const [google, youtube, openai] = await Promise.all([
      probeUrl(CONNECTIVITY_PROBE_URLS.google),
      probeUrl(CONNECTIVITY_PROBE_URLS.youtube),
      probeUrl(CONNECTIVITY_PROBE_URLS.openai),
    ]);

    return {
      google,
      youtube,
      openai,
    };
  } catch {
    return buildConnectivityProbeResult("not_verified");
  }
}

function normalizeComparableIpv4Address(value?: string | null) {
  const parts = value?.trim().split(".") ?? [];

  if (
    parts.length !== 4 ||
    parts.some((part) => {
      if (!/^\d+$/.test(part)) {
        return true;
      }

      const octet = Number(part);

      return !Number.isInteger(octet) || octet < 0 || octet > 255;
    })
  ) {
    return null;
  }

  return parts.map((part) => String(Number(part))).join(".");
}

export function isConnectivityProbeBoundToTarget(
  targetIp: string,
  currentPublicIp?: string | null,
) {
  const normalizedTargetIp = normalizeComparableIpv4Address(targetIp);
  const normalizedCurrentPublicIp =
    normalizeComparableIpv4Address(currentPublicIp);

  return (
    normalizedTargetIp !== null &&
    normalizedCurrentPublicIp !== null &&
    normalizedTargetIp === normalizedCurrentPublicIp
  );
}

export async function probeConnectivityForTarget(
  targetIp: string,
  currentPublicIp?: string | null,
  probe: () => Promise<ConnectivityProbeResult> = probeConnectivity,
): Promise<ConnectivityProbeResult | null> {
  if (!isConnectivityProbeBoundToTarget(targetIp, currentPublicIp)) {
    return null;
  }

  return probe();
}

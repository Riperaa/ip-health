export type ConnectivityProbeResult = {
  google: ConnectivityProbeServiceResult;
  youtube: ConnectivityProbeServiceResult;
  openai: ConnectivityProbeServiceResult;
};

export type ConnectivityProbeServiceResult = {
  status: ConnectivityProbeStatus;
  method: ConnectivityProbeMethod;
};

export type ConnectivityProbeStatus = "reachable" | "unreachable" | "unknown";

export type ConnectivityProbeMethod = "no-cors-fetch" | "image";

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
  status: ConnectivityProbeStatus,
  method: ConnectivityProbeMethod,
): ConnectivityProbeServiceResult {
  return {
    status,
    method,
  };
}

function isConnectivityProbeStatus(
  value: unknown,
): value is ConnectivityProbeStatus {
  return (
    value === "reachable" || value === "unreachable" || value === "unknown"
  );
}

function isConnectivityProbeMethod(
  value: unknown,
): value is ConnectivityProbeMethod {
  return value === "no-cors-fetch" || value === "image";
}

export function normalizeConnectivityProbeServiceResult(
  value: unknown,
): ConnectivityProbeServiceResult {
  if (value && typeof value === "object") {
    const candidate = value as Partial<ConnectivityProbeServiceResult>;

    if (isConnectivityProbeStatus(candidate.status)) {
      return buildProbeResult(
        candidate.status,
        isConnectivityProbeMethod(candidate.method)
          ? candidate.method
          : "no-cors-fetch",
      );
    }
  }

  if (value === true) {
    return buildProbeResult("reachable", "no-cors-fetch");
  }

  if (value === false) {
    return buildProbeResult("unreachable", "no-cors-fetch");
  }

  return buildProbeResult("unknown", "no-cors-fetch");
}

export function buildConnectivityProbeResult(
  status: ConnectivityProbeStatus,
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
  return result.status === "reachable";
}

export function isConnectivityProbeUnreachable(
  result: ConnectivityProbeServiceResult,
) {
  return result.status === "unreachable";
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

    return buildProbeResult("reachable", "no-cors-fetch");
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
    return buildProbeResult("unknown", "image");
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
      resolve(buildProbeResult("reachable", "image"));
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
    return await probeWithNoCorsFetch(fetchUrl);
  } catch {
    return probeWithImage(imageUrl);
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
    return buildConnectivityProbeResult("unknown");
  }
}

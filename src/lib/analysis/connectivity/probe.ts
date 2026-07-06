export type ConnectivityProbeResult = {
  google: boolean;
  youtube: boolean;
  openai: boolean;
};

const CONNECTIVITY_PROBE_TIMEOUT_MS = 4000;

const CONNECTIVITY_PROBE_URLS = {
  google: "https://www.google.com/generate_204",
  youtube: "https://www.youtube.com/favicon.ico",
  openai: "https://chat.openai.com",
} as const;

async function probeUrl(url: string) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    CONNECTIVITY_PROBE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(timeoutId);
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
    return {
      google: false,
      youtube: false,
      openai: false,
    };
  }
}

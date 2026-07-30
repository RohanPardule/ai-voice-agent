const DEFAULT_BACKEND_URL = "http://127.0.0.1:8002";

export function getVoiceBackendUrl(): string {
  const url = import.meta.env.VITE_VOICE_BACKEND_URL as string | undefined;
  return (url || DEFAULT_BACKEND_URL).replace(/\/$/, "");
}

export type VoiceBackendConfig = {
  model: string;
  default_voice: string;
  realtime_calls_url: string;
  audio?: {
    events_channel?: string;
  };
};

export type SessionTokenResponse = {
  token: string;
  expires_at?: number;
  session?: Record<string, unknown>;
};

export type SessionTokenRequest = {
  language?: string;
  voice?: string;
  context?: string;
};

export async function fetchVoiceConfig(): Promise<VoiceBackendConfig> {
  const res = await fetch(`${getVoiceBackendUrl()}/api/config`);
  if (!res.ok) {
    throw new Error(`Voice backend config failed (${res.status})`);
  }
  return res.json() as Promise<VoiceBackendConfig>;
}

export async function createSessionToken(
  body: SessionTokenRequest,
): Promise<SessionTokenResponse> {
  const res = await fetch(`${getVoiceBackendUrl()}/api/session/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Token request failed (${res.status})`);
  }
  return res.json() as Promise<SessionTokenResponse>;
}

export async function checkVoiceBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getVoiceBackendUrl()}/health`);
    if (!res.ok) return false;
    const json = (await res.json()) as { status?: string };
    return json.status === "ok";
  } catch {
    return false;
  }
}

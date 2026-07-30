const DEFAULT_BACKEND_URL = "http://127.0.0.1:8002";

export function getVoiceBackendUrl(): string {
  const url = import.meta.env.VITE_VOICE_BACKEND_URL as string | undefined;
  return (url || DEFAULT_BACKEND_URL).replace(/\/$/, "");
}

/** WebSocket base URL — ws:// locally, wss:// when backend uses HTTPS. */
export function getVoiceBackendWsUrl(): string {
  const httpUrl = getVoiceBackendUrl();
  if (httpUrl.startsWith("https://")) return httpUrl.replace("https://", "wss://");
  return httpUrl.replace("http://", "ws://");
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
  call_id?: string;
  expires_at?: number;
  session?: Record<string, unknown>;
};

export type CallHangupEvent = {
  type: "hangup";
  reason?: string;
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

export function getCallEventsWsUrl(callId: string): string {
  return `${getVoiceBackendWsUrl()}/api/calls/${encodeURIComponent(callId)}/events`;
}

export async function hangupCall(callId: string, reason?: string): Promise<void> {
  const res = await fetch(
    `${getVoiceBackendUrl()}/api/calls/${encodeURIComponent(callId)}/hangup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Hangup failed (${res.status})`);
  }
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

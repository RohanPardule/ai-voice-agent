import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recordCallSession } from "@/lib/voice-agent.functions";
import { createSessionToken, fetchVoiceConfig, getCallEventsWsUrl } from "@/lib/voice-backend";
import { RealtimeVoiceSession, type RealtimeStatus } from "@/lib/realtime-voice";
import { stopSpeech } from "@/lib/speech";
import { Loader2, PhoneOff } from "lucide-react";
import { BrandIcon } from "@/components/BrandMark";

type SetupStep = "connecting" | "live" | "error";

type Status = "idle" | "listening" | "thinking" | "speaking";

const CALL_CONTEXT =
  "New inbound call. Greet the caller as Radisson Hotel Goa's AI Concierge, ask which language they prefer, then how you can help with their stay. Continue naturally in their chosen language.";

const activeSessions = new Map<string, RealtimeVoiceSession>();

export function disconnectCallSession(sessionId: string) {
  activeSessions.get(sessionId)?.disconnect();
  activeSessions.delete(sessionId);
  stopSpeech();
}

function mapRealtimeStatus(status: RealtimeStatus): Status {
  if (status === "listening") return "listening";
  if (status === "speaking") return "speaking";
  if (status === "connecting") return "thinking";
  if (status === "error") return "idle";
  return "listening";
}

export function RealtimeCallScreen({
  sessionId,
  onHangUp,
}: {
  sessionId: string;
  onHangUp: (reason?: string) => void | Promise<void>;
}) {
  const saveSession = useServerFn(recordCallSession);
  const [setupStep, setSetupStep] = useState<SetupStep>("connecting");
  const [status, setStatus] = useState<Status>("thinking");
  const [hint, setHint] = useState("Connecting…");
  const [agentCaption, setAgentCaption] = useState("");
  const [userLive, setUserLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);

  const sessionRef = useRef<RealtimeVoiceSession | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const endingRef = useRef(false);
  const connectStartedRef = useRef(false);
  const transcriptRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const endCall = useCallback(
    async (reason?: string) => {
      if (endingRef.current) return;
      endingRef.current = true;

      transcriptRef.current = sessionRef.current?.getTranscript() ?? transcriptRef.current;
      const transcript = [...transcriptRef.current];

      wsRef.current?.close();
      wsRef.current = null;
      sessionRef.current?.disconnect();
      activeSessions.delete(sessionId);
      sessionRef.current = null;
      stopSpeech();

      await onHangUp(reason);

      if (transcript.length > 0) {
        try {
          await saveSession({
            data: {
              sessionId,
              transcript,
              enquiry_type: "sales",
            },
          });
        } catch (e) {
          console.error("recordCallSession failed", e);
        }
      }
    },
    [onHangUp, saveSession, sessionId],
  );

  const connectRealtime = useCallback(async () => {
    setSetupStep("connecting");
    setStatus("thinking");
    setHint("Connecting to voice agent…");
    setError(null);

    try {
      const config = await fetchVoiceConfig();
      const tokenRes = await createSessionToken({
        language: "en",
        voice: config.default_voice,
        context: CALL_CONTEXT,
      });

      if (tokenRes.call_id) {
        setCallId(tokenRes.call_id);
      }

      const session = new RealtimeVoiceSession();
      sessionRef.current = session;
      activeSessions.set(sessionId, session);

      await session.connect({
        token: tokenRes.token,
        callsUrl: config.realtime_calls_url,
        eventsChannel: config.audio?.events_channel,
        callbacks: {
          onStatus: (s) => {
            if (s === "error") return;
            setStatus(mapRealtimeStatus(s));
            if (s === "connected" || s === "listening") setHint("Listening…");
            if (s === "speaking") setHint("Speaking…");
            if (s === "connecting") setHint("Connecting…");
          },
          onAgentTranscript: (text, final) => {
            setAgentCaption(text);
            if (final) transcriptRef.current = session.getTranscript();
          },
          onUserTranscript: (text, final) => {
            setUserLive(text);
            if (final) transcriptRef.current = session.getTranscript();
          },
          onError: (message) => {
            setError(message);
            setHint("Connection error");
            setSetupStep("error");
          },
        },
      });

      setSetupStep("live");
      setStatus("listening");
      setHint("Listening…");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setHint("Could not connect");
      setSetupStep("error");
    }
  }, [sessionId]);

  useEffect(() => {
    if (connectStartedRef.current) return;
    connectStartedRef.current = true;
    void connectRealtime();
  }, [connectRealtime]);

  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      sessionRef.current?.disconnect();
      activeSessions.delete(sessionId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (setupStep !== "live" || !callId) return;

    const ws = new WebSocket(getCallEventsWsUrl(callId));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type?: string; reason?: string };
        if (msg.type === "hangup") {
          void endCall(msg.reason);
        }
      } catch {
        /* ignore malformed events */
      }
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [setupStep, callId, endCall]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  }

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");
  const isActive = setupStep === "live" || setupStep === "connecting";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#2a1508] via-[#1a0e06] to-black px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div
          className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, oklch(0.65 0.19 45) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">On call with</p>
        <p className="text-sm font-medium">Radisson Hotel Goa AI Concierge</p>
        <p className="mt-1 font-mono text-xs text-white/50">{mm}:{ss}</p>
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-6">
        <div className="relative flex h-44 w-44 items-center justify-center">
          {isActive && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-orange-400/20" />
              <span className="absolute -inset-4 animate-pulse rounded-full border border-orange-300/30" />
            </>
          )}
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-orange-200/20 bg-white/5 backdrop-blur">
            <BrandIcon size="lg" />
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-3 px-2">
          <div className="min-h-6 text-sm text-white/70">
            {status === "thinking" || setupStep === "connecting" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {hint}
              </span>
            ) : status === "speaking" ? (
              "Speaking…"
            ) : (
              hint
            )}
          </div>

          {agentCaption && setupStep === "live" && (
            <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm leading-relaxed text-white/90">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">Agent</p>
              {agentCaption}
            </div>
          )}
          {userLive && setupStep === "live" && (
            <div className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm leading-relaxed text-white/70">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">You</p>
              {userLive}
            </div>
          )}
        </div>

        {error && (
          <div className="flex flex-col items-center gap-2">
            <p className="max-w-md text-center text-xs text-red-300" role="alert">
              {error}
            </p>
            {setupStep === "error" && (
              <button
                type="button"
                onClick={() => {
                  connectStartedRef.current = true;
                  void connectRealtime();
                }}
                className="text-xs text-white/70 underline hover:text-white"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3">
        {setupStep === "live" && (
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        )}
        <button
          type="button"
          onClick={() => void endCall()}
          aria-label="Hang up"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl transition-transform hover:scale-105"
        >
          <PhoneOff className="h-8 w-8" />
        </button>
        <p className="text-xs text-white/60">Hang up</p>
      </div>
    </div>
  );
}

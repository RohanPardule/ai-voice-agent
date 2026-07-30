import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recordCallSession } from "@/lib/voice-agent.functions";
import { createSessionToken, fetchVoiceConfig } from "@/lib/voice-backend";
import { RealtimeVoiceSession, type RealtimeStatus } from "@/lib/realtime-voice";
import { stopSpeech } from "@/lib/speech";
import { Loader2, PhoneOff } from "lucide-react";
import icon from "@/assets/innowrap-icon.png";

type SetupStep = "language" | "service" | "connecting" | "live" | "careers";

type Status = "idle" | "listening" | "thinking" | "speaking";

const CAREERS_INFO =
  "Thank you for your interest in joining Innowrap Technologies. For job opportunities, please email your resume and the role you are applying for to helios at innowrap dot com. Our team will review it and get back to you.";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "bn", label: "Bengali" },
  { code: "kn", label: "Kannada" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ar", label: "Arabic" },
] as const;

const SERVICES = [
  "AI Agents & Automation",
  "Software & Web Development",
  "Mobile Apps (iOS & Android)",
  "Enterprise Applications",
  "Salesforce & CRM",
  "Digital Transformation",
  "Other / General Enquiry",
  "Careers / Jobs",
] as const;

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
  onHangUp: () => void | Promise<void>;
}) {
  const saveSession = useServerFn(recordCallSession);
  const [setupStep, setSetupStep] = useState<SetupStep>("language");
  const [language, setLanguage] = useState<string>("en");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [hint, setHint] = useState("Choose your language");
  const [agentCaption, setAgentCaption] = useState("");
  const [userLive, setUserLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);

  const sessionRef = useRef<RealtimeVoiceSession | null>(null);
  const transcriptRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const persistSession = useCallback(
    async (enquiryType: string) => {
      try {
        await saveSession({
          data: {
            sessionId,
            transcript: transcriptRef.current,
            enquiry_type: enquiryType,
          },
        });
      } catch (e) {
        console.error("recordCallSession failed", e);
      }
    },
    [saveSession, sessionId],
  );

  const connectRealtime = useCallback(
    async (lang: string, service: string) => {
      setSetupStep("connecting");
      setStatus("thinking");
      setHint("Connecting to voice agent…");
      setError(null);

      try {
        const config = await fetchVoiceConfig();
        const langLabel = LANGUAGES.find((l) => l.code === lang)?.label ?? lang;
        const tokenRes = await createSessionToken({
          language: lang,
          voice: config.default_voice,
          context: `The user chose ${langLabel} and selected: ${service}. Continue naturally in ${langLabel}.`,
        });

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
              if (final) {
                setUserLive(text);
                transcriptRef.current = session.getTranscript();
              } else {
                setUserLive(text);
              }
            },
            onError: (message) => {
              setError(message);
              setHint("Connection error");
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
        setSetupStep("service");
      }
    },
    [persistSession, sessionId],
  );

  const handleLanguageSelect = (code: string) => {
    setLanguage(code);
    setSetupStep("service");
    setHint("Which service are you interested in?");
  };

  const handleServiceSelect = async (service: string) => {
    setSelectedService(service);
    if (service === "Careers / Jobs") {
      setSetupStep("careers");
      setAgentCaption(CAREERS_INFO);
      setHint("Careers information");
      transcriptRef.current = [
        { role: "user", content: "Careers / Jobs enquiry" },
        { role: "assistant", content: CAREERS_INFO },
      ];
      await persistSession("careers");
      return;
    }
    await connectRealtime(language, service);
  };

  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
      activeSessions.delete(sessionId);
    };
  }, [sessionId]);

  async function handleHangUp() {
    transcriptRef.current = sessionRef.current?.getTranscript() ?? transcriptRef.current;
    const enquiryType = setupStep === "careers" ? "careers" : "sales";
    if (transcriptRef.current.length > 0) {
      await persistSession(enquiryType);
    }
    sessionRef.current?.disconnect();
    activeSessions.delete(sessionId);
    sessionRef.current = null;
    stopSpeech();
    await onHangUp();
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  }

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#1a0a1f] via-[#0f0714] to-black px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div
          className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, oklch(0.55 0.18 320) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">On call with</p>
        <p className="text-sm font-medium">Innowrap Technologies AI Sales Agent</p>
        <p className="mt-1 font-mono text-xs text-white/50">{mm}:{ss}</p>
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-6">
        <div className="relative flex h-44 w-44 items-center justify-center">
          {setupStep === "live" && status !== "idle" && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
              <span className="absolute -inset-4 animate-pulse rounded-full border border-white/20" />
            </>
          )}
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur">
            <img src={icon} alt="Innowrap" className="h-20 w-20 rounded-2xl" />
          </div>
        </div>

        {setupStep === "language" && (
          <div className="w-full space-y-3">
            <p className="text-center text-sm text-white/70">Hi! Which language would you like?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageSelect(lang.code)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm transition hover:bg-white/10"
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {setupStep === "service" && (
          <div className="w-full space-y-3">
            <p className="text-center text-sm text-white/70">Which service are you looking for?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SERVICES.map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => void handleServiceSelect(service)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-left text-sm transition hover:bg-white/10"
                >
                  {service}
                </button>
              ))}
            </div>
          </div>
        )}

        {setupStep === "connecting" && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting voice session…
          </div>
        )}

        {(setupStep === "live" || setupStep === "careers") && (
          <div className="flex w-full flex-col items-center gap-3 px-2">
            <div className="min-h-6 text-sm text-white/70">
              {status === "thinking" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                </span>
              ) : status === "speaking" ? (
                "Speaking…"
              ) : (
                hint
              )}
            </div>
            {selectedService && setupStep === "live" && (
              <p className="text-xs text-white/40">{selectedService}</p>
            )}
            {agentCaption && (
              <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm leading-relaxed text-white/90">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">Agent</p>
                {agentCaption}
              </div>
            )}
            {userLive && setupStep === "live" && status === "listening" && (
              <div className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm leading-relaxed text-white/70">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">You</p>
                {userLive}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="max-w-md text-center text-xs text-red-300" role="alert">
            {error}
          </p>
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
          onClick={() => void handleHangUp()}
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

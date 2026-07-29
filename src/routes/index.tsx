import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAgent, getLeadContact, submitFeedback } from "@/lib/voice-agent.functions";
import {
  isSpeechSynthesisSupported,
  isSpeechPlaying,
  speakText,
  stopSpeech,
  unlockSpeechOnUserGesture,
} from "@/lib/speech";
import {
  Phone,
  PhoneOff,
  Loader2,
  Sparkles,
  Cpu,
  Building2,
  ExternalLink,
  Star,
} from "lucide-react";
import wordmark from "@/assets/innowrap-wordmark.png";
import icon from "@/assets/innowrap-icon.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Innowrap Technologies AI Sales Agent" },
        {
          name: "description",
          content:
            "Call Innowrap Technologies' AI Sales Agent — a voice-first assistant for AI solutions, software development, mobile apps, and enterprise transformation.",
        },
        { property: "og:title", content: "Innowrap Technologies AI Sales Agent" },
        {
          property: "og:description",
          content: "Voice-first AI agent for Innowrap Technologies' services and enterprise software enquiries.",
      },
    ],
  }),
  component: Home,
});

type Screen = "landing" | "call" | "feedback";

function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [sessionId, setSessionId] = useState<string>("");
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ name: string | null; email: string | null }>({
    name: null,
    email: null,
  });

  const fetchContact = useServerFn(getLeadContact);

  async function startCall() {
    if (isStartingCall) return;
    setMicError(null);
    setIsStartingCall(true);

    try {
      unlockSpeechOnUserGesture();

      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError("Microphone is not supported in this browser. Please use Chrome or Edge.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);

      runCallGreeting(id);
      setSessionId(id);
      setScreen("call");
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setMicError(
        denied
          ? "Microphone access is required. Please allow microphone when prompted, then try again."
          : "Could not access your microphone. Check browser settings and try again.",
      );
    } finally {
      setIsStartingCall(false);
    }
  }

  async function hangUp() {
    if (sessionId) {
      try {
        const c = await fetchContact({ data: { sessionId } });
        setPrefill(c);
      } catch {
        /* ignore */
      }
    }
    setScreen("feedback");
  }

  function finishFeedback() {
    setScreen("landing");
    setSessionId("");
    setPrefill({ name: null, email: null });
  }

  if (screen === "call") return <CallScreen sessionId={sessionId} onHangUp={hangUp} />;
  if (screen === "feedback")
    return <FeedbackScreen sessionId={sessionId} prefill={prefill} onDone={finishFeedback} />;
  return <Landing onCall={startCall} isStartingCall={isStartingCall} micError={micError} />;
}

/* -------------------- LANDING -------------------- */

function Landing({
  onCall,
  isStartingCall,
  micError,
}: {
  onCall: () => void | Promise<void>;
  isStartingCall: boolean;
  micError: string | null;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-secondary">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div
          className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, oklch(0.55 0.15 320) 0%, transparent 70%)",
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <img src={wordmark} alt="Innowrap" className="h-9 w-auto" />
        <div className="flex items-center gap-3">
          <a
            href="https://www.innowrap.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            innowrap.com <ExternalLink className="h-3 w-3" />
          </a>
          <Link
            to="/auth"
            className="rounded-md border border-input bg-background/60 px-3 py-1.5 text-xs backdrop-blur hover:bg-accent"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-16 pt-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> AI-first software development
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Talk to Innowrap Technologies' AI Sales Agent
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          A voice-first way to explore what we build — AI agents, enterprise software, mobile apps,
          Salesforce, and digital transformation. Tap Call and speak naturally.
        </p>

        <button
          type="button"
          onClick={() => void onCall()}
          disabled={isStartingCall}
          className="group relative mt-10 inline-flex items-center gap-3 rounded-full bg-primary px-10 py-5 text-lg font-semibold text-primary-foreground shadow-[0_10px_40px_-10px_oklch(0.55_0.15_320/0.6)] transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-80 disabled:hover:scale-100"
        >
          <span className="absolute inset-0 -z-10 animate-pulse rounded-full bg-primary/40 blur-xl" />
          {isStartingCall ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Phone className="h-6 w-6" />
          )}
          {isStartingCall ? "Allow microphone…" : "Call the Agent"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          {isStartingCall
            ? "Please allow microphone access in the browser prompt"
            : "Free · no signup · voice only"}
        </p>
        {micError && (
          <p className="mt-2 max-w-md text-xs text-destructive" role="alert">
            {micError}
          </p>
        )}

        <div className="mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<Cpu className="h-5 w-5" />}
            title="AI Agents & Automation"
            desc="Voice, chat, workflow, and enterprise-knowledge AI."
          />
          <FeatureCard
            icon={<Building2 className="h-5 w-5" />}
            title="Enterprise Software"
            desc="CRM, ERP, portals, mobile — end-to-end delivery."
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Salesforce & Cloud"
            desc="Implementation, customization, AI optimization."
          />
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>Diageo India</span>
          <span>·</span>
          <span>Tata Consumer (Mavic)</span>
          <span>·</span>
          <span>Curly Tales</span>
          <span>·</span>
          <span>Digi1</span>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/50 bg-background/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>hello@innowrap.com · +91 7021239589</span>
          <a
            href="https://www.innowrap.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            www.innowrap.com
          </a>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 text-left backdrop-blur">
      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

/* -------------------- CALL SCREEN -------------------- */

type Status = "idle" | "listening" | "thinking" | "speaking";
type Msg = { role: "user" | "assistant"; content: string };

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: any) => void) | null;
}

const SILENCE_MS = 2500;
const POST_SPEAK_DELAY_MS = 600;

type CallPhase = "language" | "services" | "chat";

const greetedSessions = new Set<string>();
const greetingPromises = new Map<string, Promise<void>>();
const captionCallbacks = new Map<string, (text: string) => void>();

function runCallGreeting(
  sessionId: string,
  onLine?: (text: string) => void,
): Promise<void> {
  if (onLine) captionCallbacks.set(sessionId, onLine);

  const existing = greetingPromises.get(sessionId);
  if (existing) return existing;

  const notify = (text: string) => captionCallbacks.get(sessionId)?.(text);

  const promise = (async () => {
    const line1 = "Hi, welcome to Innowrap Technologies.";
    notify(line1);
    await speakText(line1, "en-US");
    const line2 = "Which language would you like to continue in?";
    notify(line2);
    await speakText(line2, "en-US");
    greetedSessions.add(sessionId);
  })();

  greetingPromises.set(sessionId, promise);
  return promise;
}

function detectLangCode(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (/\b(english|inglish|angrezi|angreji)\b/.test(t)) return "en-US";
  if (/\b(hindi|हिन्दी|हिंदी)\b/.test(t)) return "hi-IN";
  if (/\b(marathi|मराठी)\b/.test(t)) return "mr-IN";
  if (/\b(gujarati|ગુજરાતી)\b/.test(t)) return "gu-IN";
  if (/\b(tamil|தமிழ்)\b/.test(t)) return "ta-IN";
  if (/\b(telugu|తెలుగు)\b/.test(t)) return "te-IN";
  if (/\b(bengali|bangla|বাংলা)\b/.test(t)) return "bn-IN";
  if (/\b(kannada|ಕನ್ನಡ)\b/.test(t)) return "kn-IN";
  if (/\b(punjabi|ਪੰਜਾਬੀ)\b/.test(t)) return "pa-IN";
  if (/\b(spanish|espa[nñ]ol)\b/.test(t)) return "es-ES";
  if (/\b(french|fran[cç]ais)\b/.test(t)) return "fr-FR";
  if (/\b(german|deutsch)\b/.test(t)) return "de-DE";
  if (/\b(arabic|العربية)\b/.test(t)) return "ar-SA";
  if (/\b(portuguese|portugu[eê]s)\b/.test(t)) return "pt-BR";
  if (/\b(chinese|mandarin|中文)\b/.test(t)) return "zh-CN";
  if (/\b(japanese|日本語)\b/.test(t)) return "ja-JP";
  // Infer from script when the user names a language implicitly by speaking in it.
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";
  return null;
}

function languageName(code: string): string {
  return new Intl.DisplayNames(["en"], { type: "language" }).of(code.split("-")[0]) ?? "English";
}

const LANGUAGE_REPROMPT =
  "Sorry, I didn't catch that. Which language would you like to continue in?";

function serviceQuestion(code: string): string {
  const questions: Record<string, string> = {
    "en-US": "Great! Which services are you looking for?",
    "hi-IN": "बहुत अच्छा! आप कौन सी सेवाओं की तलाश में हैं?",
    "mr-IN": "छान! तुम्हाला कोणत्या सेवा हव्या आहेत?",
    "gu-IN": "સરસ! તમે કઈ સેવાઓ શોધી રહ્યા છો?",
    "ta-IN": "நன்று! நீங்கள் எந்த சேவைகளைத் தேடுகிறீர்கள்?",
    "te-IN": "బాగుంది! మీరు ఏ సేవలు కోసం చూస్తున్నారు?",
    "bn-IN": "দারুণ! আপনি কোন সেবা খুঁজছেন?",
    "kn-IN": "ಚೆನ್ನಾಗಿದೆ! ನೀವು ಯಾವ ಸೇವೆಗಳನ್ನು ಹುಡುಕುತ್ತಿದ್ದೀರಿ?",
    "pa-IN": "ਬਹੁਤ ਵਧੀਆ! ਤੁਸੀਂ ਕਿਹੜੀਆਂ ਸੇਵਾਵਾਂ ਲੱਭ ਰਹੇ ਹੋ?",
    "es-ES": "¡Perfecto! ¿Qué servicios está buscando?",
    "fr-FR": "Parfait ! Quels services recherchez-vous ?",
    "de-DE": "Super! Welche Dienstleistungen suchen Sie?",
    "ar-SA": "رائع! ما الخدمات التي تبحث عنها؟",
    "pt-BR": "Ótimo! Quais serviços você está procurando?",
    "zh-CN": "好的！您在寻找哪些服务？",
    "ja-JP": "かしこまりました。どのサービスをお探しですか？",
  };
  return questions[code] ?? questions["en-US"];
}

function CallScreen({ sessionId, onHangUp }: { sessionId: string; onHangUp: () => void }) {
  const ask = useServerFn(askAgent);
  const [status, setStatus] = useState<Status>("idle");
  const [hint, setHint] = useState<string>("Connecting…");
  const [agentCaption, setAgentCaption] = useState<string>("");
  const [userLive, setUserLive] = useState<string>("");
  const [supported, setSupported] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const historyRef = useRef<Msg[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const langRef = useRef<string>("en-US");
  const activeRef = useRef<boolean>(true);
  const phaseRef = useRef<CallPhase>("language");
  const bufferRef = useRef<string>("");
  const silenceTimerRef = useRef<number | null>(null);
  const listeningRef = useRef<boolean>(false);
  const shouldRestartRef = useRef<boolean>(false);
  const speakingRef = useRef<boolean>(false);

  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopRecognition = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    shouldRestartRef.current = false;
    try {
      r.stop();
    } catch {
      /* ignore */
    }
    listeningRef.current = false;
  }, []);

  const speak = useCallback(
    async (text: string, lang: string) => {
      stopRecognition();
      clearSilenceTimer();
      bufferRef.current = "";
      setUserLive("");
      speakingRef.current = true;
      setStatus("speaking");
      setHint("Speaking…");
      setAgentCaption(text);
      await speakText(text, lang);
      await wait(POST_SPEAK_DELAY_MS);
      speakingRef.current = false;
    },
    [stopRecognition],
  );

  const startRecognition = useCallback(() => {
    const r = recognitionRef.current;
    if (!r || listeningRef.current || !activeRef.current) return;
    if (speakingRef.current || isSpeechPlaying()) return;
    try {
      r.lang = langRef.current;
      bufferRef.current = "";
      setUserLive("");
      r.start();
      listeningRef.current = true;
      shouldRestartRef.current = true;
      setStatus("listening");
      setHint("Listening…");
    } catch {
      /* ignore */
    }
  }, []);

  const processUtterance = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        if (activeRef.current) startRecognition();
        return;
      }
      setStatus("thinking");
      setHint("Processing…");
      setUserLive("");

      try {
        stopRecognition();

        if (phaseRef.current === "language") {
          const code = detectLangCode(trimmed);
          if (!code) {
            setStatus("speaking");
            setHint("Speaking…");
            await speak(LANGUAGE_REPROMPT, "en-US");
            if (activeRef.current) startRecognition();
            return;
          }

          langRef.current = code;
          phaseRef.current = "services";
          setStatus("speaking");
          setHint("Speaking…");
          await speak(serviceQuestion(code), code);
          if (activeRef.current) startRecognition();
          return;
        }

        if (phaseRef.current === "services") {
          phaseRef.current = "chat";
          const lang = langRef.current;
          const langLabel = languageName(lang);
          const directive = `Respond in ${langLabel}. The user just told you which service they are looking for. Acknowledge their interest briefly and continue the sales conversation naturally. Keep it concise for voice.`;
          const userMsg = `${directive}\n\nUser said: ${trimmed}`;
          const { reply } = await ask({
            data: { history: historyRef.current, message: userMsg, sessionId },
          });
          historyRef.current = [
            ...historyRef.current,
            { role: "user", content: trimmed },
            { role: "assistant", content: reply },
          ];
          setStatus("speaking");
          setHint("Speaking…");
          await speak(reply, lang);
          if (activeRef.current) startRecognition();
          return;
        }

        const langLabel = languageName(langRef.current);
        const directive = `Respond in ${langLabel}. Keep it concise and conversational for voice.`;
        const userMsg = `${directive}\n\nUser said: ${trimmed}`;

        const { reply } = await ask({
          data: { history: historyRef.current, message: userMsg, sessionId },
        });
        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: trimmed },
          { role: "assistant", content: reply },
        ];
        setStatus("speaking");
        setHint("Speaking…");
        await speak(reply, langRef.current);
        if (activeRef.current) startRecognition();
      } catch (err) {
        console.error("Agent error:", err);
        if (activeRef.current) {
          setStatus("speaking");
          setHint("Speaking…");
          const msg = err instanceof Error ? err.message : String(err);
          const errMsg = msg.includes("GEMINI_API_KEY")
            ? "I'm having trouble connecting right now. Please try again in a moment."
            : msg.includes("invalid or was disabled") || msg.includes("leaked")
              ? "The AI service key needs to be updated. Please contact support."
              : msg.includes("Gemini") || msg.includes("Empty response")
                ? "I couldn't get a response just now. Please say that again."
                : "Sorry, something went wrong. Could you repeat that?";
          await speak(errMsg, langRef.current);
          setHint("Listening…");
          startRecognition();
        }
      }
    },
    [ask, sessionId, speak, startRecognition, stopRecognition],
  );

  const setupRecognition = useCallback(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return null;
    const r: SpeechRecognitionLike = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = langRef.current;

    r.onresult = (ev: any) => {
      if (speakingRef.current || isSpeechPlaying()) return;

      let finalized = "";
      for (let i = 0; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          finalized += ev.results[i][0]?.transcript ?? "";
        }
      }
      bufferRef.current = finalized.trim();

      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) {
          interim += ev.results[i][0]?.transcript ?? "";
        }
      }

      const live = [bufferRef.current, interim.trim()].filter(Boolean).join(" ").trim();
      if (live) setUserLive(live);

      if (finalized || interim) {
        clearSilenceTimer();
        silenceTimerRef.current = window.setTimeout(() => {
          if (speakingRef.current || isSpeechPlaying()) return;
          const text = bufferRef.current.trim();
          bufferRef.current = "";
          shouldRestartRef.current = false;
          try {
            r.stop();
          } catch {
            /* ignore */
          }
          listeningRef.current = false;
          processUtterance(text);
        }, SILENCE_MS);
      }
    };

    r.onerror = (ev: any) => {
      if (ev?.error === "no-speech" || ev?.error === "aborted") return;
      console.warn("SR error", ev?.error);
    };

    r.onend = () => {
      listeningRef.current = false;
      if (shouldRestartRef.current && activeRef.current && !speakingRef.current && !isSpeechPlaying()) {
        try {
          r.start();
          listeningRef.current = true;
        } catch {
          /* ignore */
        }
      }
    };

    return r;
  }, [processUtterance]);

  // Auto-start on mount — useLayoutEffect so greeting begins before paint.
  useLayoutEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR || !isSpeechSynthesisSupported()) {
      setSupported(false);
      setHint("Your browser doesn't support voice. Try Chrome or Edge.");
      return;
    }

    recognitionRef.current = setupRecognition();
    activeRef.current = true;
    phaseRef.current = "language";
    langRef.current = "en-US";

    setStatus("speaking");
    setHint("Speaking…");
    setAgentCaption("Hi, welcome to Innowrap Technologies.");

    let cancelled = false;
    void runCallGreeting(sessionId, (line) => {
      if (!cancelled) setAgentCaption(line);
    }).then(() => {
      if (cancelled || !activeRef.current) return;
      setStatus("listening");
      setHint("Listening…");
      startRecognition();
    });

    return () => {
      cancelled = true;
      shouldRestartRef.current = false;
      clearSilenceTimer();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      // Do not stop speech here — remounts would cut off the greeting.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function handleHangUp() {
    activeRef.current = false;
    speakingRef.current = false;
    shouldRestartRef.current = false;
    clearSilenceTimer();
    stopRecognition();
    stopSpeech();
    greetingPromises.delete(sessionId);
    greetedSessions.delete(sessionId);
    captionCallbacks.delete(sessionId);
    onHangUp();
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

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative flex h-44 w-44 items-center justify-center">
          {status !== "idle" && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
              <span className="absolute -inset-4 animate-pulse rounded-full border border-white/20" />
            </>
          )}
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur">
            <img
              src={icon}
              alt="Innowrap"
              className="h-20 w-20 rounded-2xl"
            />
          </div>
        </div>
        <div className="flex w-full max-w-md flex-col items-center gap-3 px-2">
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
          {agentCaption && (
            <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm leading-relaxed text-white/90">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">Agent</p>
              {agentCaption}
            </div>
          )}
          {userLive && status === "listening" && (
            <div className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm leading-relaxed text-white/70">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">You</p>
              {userLive}
            </div>
          )}
        </div>
        {!supported && (
          <p className="text-xs text-white/60">Please use Chrome or Edge for voice.</p>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleHangUp}
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

/* -------------------- FEEDBACK -------------------- */

function FeedbackScreen({
  sessionId,
  prefill,
  onDone,
}: {
  sessionId: string;
  prefill: { name: string | null; email: string | null };
  onDone: () => void;
}) {
  const submit = useServerFn(submitFeedback);
  const [name, setName] = useState(prefill.name ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [rating, setRating] = useState<number>(5);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submit({
        data: {
          sessionId,
          name: name.trim(),
          email: email.trim(),
          rating,
          message: message.trim(),
        },
      });
      setDone(true);
      window.setTimeout(onDone, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background to-secondary px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src={wordmark} alt="Innowrap" className="h-10 w-auto" />
          <h1 className="mt-2 text-xl font-semibold">How was your call?</h1>
          <p className="text-xs text-muted-foreground">
            Your feedback helps us improve the Innowrap Technologies AI Sales Agent.
          </p>
        </div>

        {done ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Thanks for the feedback! Returning to home…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  className="p-1"
                >
                  <Star
                    className={`h-7 w-7 ${
                      n <= rating ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <textarea
              placeholder="Tell us what worked or what could be better…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onDone}
                className="flex-1 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

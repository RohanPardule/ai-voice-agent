import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLeadContact, submitFeedback } from "@/lib/voice-agent.functions";
import { disconnectCallSession, RealtimeCallScreen } from "@/components/RealtimeCallScreen";
import { unlockSpeechOnUserGesture } from "@/lib/speech";
import { BrandMark } from "@/components/BrandMark";
import {
  Phone,
  Loader2,
  Sparkles,
  Waves,
  UtensilsCrossed,
  Building2,
  ExternalLink,
  Star,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radisson Hotel Goa AI Concierge" },
      {
        name: "description",
        content:
          "Call Radisson Hotel Goa's AI Concierge — a voice-first assistant for reservations, dining, spa, and guest services.",
      },
      { property: "og:title", content: "Radisson Hotel Goa AI Concierge" },
      {
        property: "og:description",
        content: "Voice-first AI concierge for Radisson Hotel Goa reservations and guest enquiries.",
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
  const [hangupNote, setHangupNote] = useState<string | null>(null);

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

  async function hangUp(reason?: string) {
    if (reason?.trim()) {
      setHangupNote(reason.trim());
    }
    if (sessionId) {
      disconnectCallSession(sessionId);
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
    setHangupNote(null);
    setPrefill({ name: null, email: null });
  }

  if (screen === "call") return <RealtimeCallScreen sessionId={sessionId} onHangUp={hangUp} />;
  if (screen === "feedback")
    return (
      <FeedbackScreen
        sessionId={sessionId}
        prefill={prefill}
        hangupNote={hangupNote}
        onDone={finishFeedback}
      />
    );
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
            background: "radial-gradient(circle, oklch(0.7 0.18 45) 0%, transparent 70%)",
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <BrandMark size="sm" />
        <div className="flex items-center gap-3">
          <a
            href="https://www.radissonhotels.com/en-us/hotels/radisson-goa-candolim"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            radissonhotels.com <ExternalLink className="h-3 w-3" />
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
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Candolim, North Goa
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Talk to Radisson Hotel Goa's AI Concierge
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          A voice-first way to explore rooms, dining, spa, and guest services. Tap Call and speak
          naturally — we are here to help plan your stay.
        </p>

        <button
          type="button"
          onClick={() => void onCall()}
          disabled={isStartingCall}
          className="group relative mt-10 inline-flex items-center gap-3 rounded-full bg-primary px-10 py-5 text-lg font-semibold text-primary-foreground shadow-[0_10px_40px_-10px_oklch(0.65_0.19_45/0.55)] transition-transform hover:scale-[1.03] disabled:cursor-wait disabled:opacity-80 disabled:hover:scale-100"
        >
          <span className="absolute inset-0 -z-10 animate-pulse rounded-full bg-primary/40 blur-xl" />
          {isStartingCall ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Phone className="h-6 w-6" />
          )}
          {isStartingCall ? "Allow microphone…" : "Call the Concierge"}
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
            icon={<Building2 className="h-5 w-5" />}
            title="Rooms & Suites"
            desc="Comfortable stays with pool views near Candolim Beach."
          />
          <FeatureCard
            icon={<UtensilsCrossed className="h-5 w-5" />}
            title="Dining & Bar"
            desc="Multi-cuisine dining at The Palms and poolside Red Mango."
          />
          <FeatureCard
            icon={<Waves className="h-5 w-5" />}
            title="Spa & Leisure"
            desc="Spa therapies, pool, and easy access to North Goa."
          />
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>Candolim Beach</span>
          <span>·</span>
          <span>Fort Aguada</span>
          <span>·</span>
          <span>Calangute</span>
          <span>·</span>
          <span>Panjim</span>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/50 bg-background/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>info@rdgoa.com · +91 832 671 9999</span>
          <a
            href="https://www.radissonhotels.com/en-us/hotels/radisson-goa-candolim"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            www.radissonhotels.com
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


/* -------------------- FEEDBACK -------------------- */

function FeedbackScreen({
  sessionId,
  prefill,
  hangupNote,
  onDone,
}: {
  sessionId: string;
  prefill: { name: string | null; email: string | null };
  hangupNote?: string | null;
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

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedMessage = message.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const canSubmit = Boolean(trimmedName && trimmedEmail && emailValid && trimmedMessage);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!trimmedMessage) {
      setError("Please enter your feedback.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submit({
        data: {
          sessionId,
          name: trimmedName,
          email: trimmedEmail,
          rating,
          message: trimmedMessage,
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
          <BrandMark size="md" />
          <h1 className="mt-2 text-xl font-semibold">How was your call?</h1>
          {hangupNote ? (
            <p className="mt-2 text-sm text-foreground">{hangupNote}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Your feedback helps us improve the Radisson Hotel Goa AI Concierge.
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
              required
              placeholder="Your name *"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              required
              type="email"
              placeholder="Email *"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <textarea
              required
              placeholder="Your feedback *"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError(null);
              }}
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
                disabled={busy || !canSubmit}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
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

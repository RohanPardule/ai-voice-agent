let resumeTimer: ReturnType<typeof setInterval> | null = null;
let voicesCache: SpeechSynthesisVoice[] | null = null;
let gesturePrimed = false;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

function clearResumeTimer() {
  if (resumeTimer) {
    clearInterval(resumeTimer);
    resumeTimer = null;
  }
}

function startResumeTimer(synth: SpeechSynthesis) {
  clearResumeTimer();
  resumeTimer = setInterval(() => {
    if (synth.speaking || synth.pending) synth.resume();
  }, 100);
}

function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  if (voicesCache && voicesCache.length > 0) return Promise.resolve(voicesCache);

  return new Promise((resolve) => {
    const existing = synth.getVoices();
    if (existing.length > 0) {
      voicesCache = existing;
      resolve(existing);
      return;
    }

    const onVoicesChanged = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        voicesCache = voices;
        resolve(voices);
      }
    };

    synth.addEventListener("voiceschanged", onVoicesChanged);
    synth.getVoices();
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      voicesCache = synth.getVoices();
      resolve(voicesCache);
    }, 500);
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const base = lang.split("-")[0].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
    voices[0]
  );
}

function buildUtterance(text: string, lang: string, voices: SpeechSynthesisVoice[]) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voice = pickVoice(voices, lang);
  if (voice) utterance.voice = voice;
  return utterance;
}

export function isSpeechSynthesisSupported(): boolean {
  return getSynth() !== null;
}

/** Call synchronously inside a user click/tap handler to unlock browser audio. */
export function unlockSpeechOnUserGesture(): void {
  const synth = getSynth();
  if (!synth) return;
  synth.getVoices();
  synth.resume();
  if (gesturePrimed) return;
  gesturePrimed = true;
  const prime = new SpeechSynthesisUtterance("ready");
  prime.volume = 0.01;
  prime.rate = 2;
  prime.onend = () => synth.cancel();
  prime.onerror = () => synth.cancel();
  synth.speak(prime);
}

export function stopSpeech(): void {
  const synth = getSynth();
  if (!synth) return;
  clearResumeTimer();
  synth.cancel();
}

function speakOnce(
  synth: SpeechSynthesis,
  text: string,
  lang: string,
  voices: SpeechSynthesisVoice[],
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let started = false;
    let fallbackId = 0;
    let retryId = 0;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackId);
      window.clearTimeout(retryId);
      clearResumeTimer();
      resolve();
    };

    const run = (attempt: number) => {
      const utterance = buildUtterance(text, lang, voices);

      utterance.onstart = () => {
        started = true;
        startResumeTimer(synth);
      };
      utterance.onend = () => finish();
      utterance.onerror = (ev) => {
        console.warn("TTS error:", ev.error, "attempt", attempt);
        if (attempt < 2) {
          window.setTimeout(() => run(attempt + 1), 200);
          return;
        }
        finish();
      };

      synth.resume();
      synth.speak(utterance);

      retryId = window.setTimeout(() => {
        if (started || settled) return;
        synth.cancel();
        if (attempt < 2) {
          window.setTimeout(() => run(attempt + 1), 150);
        } else {
          console.warn("TTS never started for:", text.slice(0, 50));
          finish();
        }
      }, 800);
    };

    const fallbackMs = Math.min(90000, Math.max(10000, text.length * 80));
    fallbackId = window.setTimeout(() => {
      if (!synth.speaking && !synth.pending) finish();
    }, fallbackMs);

    run(1);
  });
}

export async function speakText(text: string, lang = "en-US"): Promise<void> {
  const synth = getSynth();
  if (!synth || !text.trim()) return;

  if (synth.speaking || synth.pending) {
    synth.cancel();
    await new Promise((r) => window.setTimeout(r, 100));
  }

  const voices = await loadVoices(synth);
  await speakOnce(synth, text, lang, voices);
}

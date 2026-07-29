let resumeTimer: ReturnType<typeof setInterval> | null = null;
let voicesCache: SpeechSynthesisVoice[] | null = null;
let speakChain: Promise<void> = Promise.resolve();

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
  }, 200);
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
    }, 300);
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

export function isSpeechSynthesisSupported(): boolean {
  return getSynth() !== null;
}

/** Call synchronously inside a user click/tap handler to unlock browser audio. */
export function unlockSpeechOnUserGesture(): void {
  const synth = getSynth();
  if (!synth) return;
  synth.getVoices();
  synth.resume();
}

export function stopSpeech(): void {
  const synth = getSynth();
  if (!synth) return;
  clearResumeTimer();
  speakChain = Promise.resolve();
  synth.cancel();
}

function speakOne(text: string, lang: string): Promise<void> {
  const synth = getSynth();
  if (!synth || !text.trim()) return Promise.resolve();

  return loadVoices(synth).then(
    (voices) =>
      new Promise<void>((resolve) => {
        let done = false;
        let safetyId = 0;
        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(safetyId);
          clearResumeTimer();
          resolve();
        };

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;
        const voice = pickVoice(voices, lang);
        if (voice) utterance.voice = voice;

        utterance.onstart = () => startResumeTimer(synth);
        utterance.onend = finish;
        utterance.onerror = (ev) => {
          if (ev.error !== "canceled") {
            console.warn("TTS error:", ev.error);
          }
          finish();
        };

        safetyId = window.setTimeout(finish, Math.min(90000, Math.max(15000, text.length * 90)));

        synth.resume();
        synth.speak(utterance);
      }),
  );
}

/** Queue speeches so they never cancel each other. */
export function speakText(text: string, lang = "en-US"): Promise<void> {
  const next = speakChain.then(() => speakOne(text, lang));
  speakChain = next.catch(() => {});
  return next;
}

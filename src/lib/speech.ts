let resumeTimer: ReturnType<typeof setInterval> | null = null;
let voicesCache: SpeechSynthesisVoice[] | null = null;
let speakChain: Promise<void> = Promise.resolve();
let speakingActive = false;
let speechGeneration = 0;
let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

type SynthesizeFn = (text: string, lang: string) => Promise<string | null>;

let geminiSynthesize: SynthesizeFn | null = null;
let geminiTtsPreferred = false;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

function revokeObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  revokeObjectUrl();
}

/** Enable Gemini TTS via server function (returns base64 WAV or null to fall back). */
export function configureGeminiTts(opts: {
  enabled: boolean;
  synthesize: SynthesizeFn;
}) {
  geminiTtsPreferred = opts.enabled;
  geminiSynthesize = opts.synthesize;
}

export function isGeminiTtsEnabled(): boolean {
  return geminiTtsPreferred;
}

export function isSpeechPlaying(): boolean {
  const synth = getSynth();
  const audioPlaying = Boolean(currentAudio && !currentAudio.paused && !currentAudio.ended);
  return speakingActive || audioPlaying || Boolean(synth?.speaking || synth?.pending);
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

/** Split long replies so TTS doesn't cut off mid-paragraph. */
function splitForSpeech(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= 180) return [trimmed];

  const sentences = trimmed.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g);
  if (!sentences?.length) return [trimmed];

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const part = sentence.trim();
    if (!part) continue;
    if ((current + " " + part).trim().length > 220) {
      if (current) chunks.push(current.trim());
      current = part;
    } else {
      current = (current + " " + part).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [trimmed];
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (geminiTtsPreferred && typeof Audio !== "undefined") return true;
  return getSynth() !== null;
}

/** Call synchronously inside a user click/tap handler to unlock browser audio. */
export function unlockSpeechOnUserGesture(): void {
  const synth = getSynth();
  if (synth) {
    synth.getVoices();
    synth.resume();
  }
  if (typeof Audio !== "undefined") {
    const silent = new Audio();
    silent.volume = 0;
    void silent.play().catch(() => {});
  }
}

export function stopSpeech(): void {
  const synth = getSynth();
  speechGeneration += 1;
  speakingActive = false;
  clearResumeTimer();
  speakChain = Promise.resolve();
  stopCurrentAudio();
  if (synth) synth.cancel();
}

function playWavBase64(wavBase64: string, generation: number): Promise<void> {
  return new Promise((resolve) => {
    if (generation !== speechGeneration) {
      resolve();
      return;
    }

    stopCurrentAudio();

    const binary = atob(wavBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;

    const audio = new Audio(url);
    currentAudio = audio;

    const finish = () => {
      if (currentAudio === audio) {
        stopCurrentAudio();
      }
      resolve();
    };

    audio.onended = finish;
    audio.onerror = () => {
      console.warn("Gemini TTS audio playback error");
      finish();
    };

    void audio.play().catch((err) => {
      console.warn("Gemini TTS play failed", err);
      finish();
    });
  });
}

function speakOneBrowser(text: string, lang: string, generation: number): Promise<void> {
  const synth = getSynth();
  if (!synth || !text.trim() || generation !== speechGeneration) return Promise.resolve();

  return loadVoices(synth).then(
    (voices) =>
      new Promise<void>((resolve) => {
        if (generation !== speechGeneration) {
          resolve();
          return;
        }
        let done = false;
        let safetyId = 0;
        let interruptRetries = 0;

        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(safetyId);
          clearResumeTimer();
          resolve();
        };

        const run = () => {
          if (generation !== speechGeneration) {
            finish();
            return;
          }
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang;
          utterance.rate = 0.92;
          utterance.pitch = 1;
          utterance.volume = 1;
          const voice = pickVoice(voices, lang);
          if (voice) utterance.voice = voice;

          utterance.onstart = () => startResumeTimer(synth);
          utterance.onend = finish;
          utterance.onerror = (ev) => {
            if (generation !== speechGeneration || ev.error === "canceled") {
              finish();
              return;
            }
            if (ev.error === "interrupted" && interruptRetries < 5) {
              interruptRetries += 1;
              synth.resume();
              window.setTimeout(run, 150);
              return;
            }
            console.warn("TTS error:", ev.error);
            finish();
          };

          synth.resume();
          synth.speak(utterance);
        };

        safetyId = window.setTimeout(finish, Math.min(120000, Math.max(20000, text.length * 100)));
        run();
      }),
  );
}

async function speakOne(text: string, lang: string, generation: number): Promise<void> {
  if (generation !== speechGeneration || !text.trim()) return;

  if (geminiTtsPreferred && geminiSynthesize) {
    try {
      const wavBase64 = await geminiSynthesize(text, lang);
      if (generation !== speechGeneration) return;
      if (wavBase64) {
        await playWavBase64(wavBase64, generation);
        return;
      }
    } catch (err) {
      console.warn("Gemini TTS failed, falling back to browser speech", err);
    }
  }

  await speakOneBrowser(text, lang, generation);
}

/** Queue speeches so they never cancel each other. Long text is split into sentences. */
export async function speakText(text: string, lang = "en-US"): Promise<void> {
  const generation = speechGeneration;
  const chunks = splitForSpeech(text);
  speakingActive = true;
  try {
    for (const chunk of chunks) {
      if (generation !== speechGeneration) return;
      const next = speakChain.then(() => speakOne(chunk, lang, generation));
      speakChain = next.catch(() => {});
      await next;
      if (generation !== speechGeneration) return;
    }
  } finally {
    if (generation === speechGeneration) speakingActive = false;
  }
}

const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE = "Kore";

function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    (import.meta.env?.GEMINI_API_KEY as string | undefined) ||
    (import.meta.env?.VITE_GEMINI_API_KEY as string | undefined) ||
    ""
  );
}

function getTtsModel(): string {
  return process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL;
}

function getTtsVoice(): string {
  return process.env.GEMINI_TTS_VOICE || DEFAULT_VOICE;
}

function parsePcmSampleRate(mimeType: string): number {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 24000;
}

/** Wrap raw PCM (16-bit LE mono) in a WAV container for browser playback. */
export function pcmToWav(
  pcm: Uint8Array,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): ArrayBuffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer, 44).set(pcm);

  return buffer;
}

export async function synthesizeGeminiTts(
  text: string,
  opts?: { voice?: string; model?: string },
): Promise<{ wavBase64: string; mimeType: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty TTS text");

  const model = opts?.model || getTtsModel();
  const voice = opts?.voice || getTtsVoice();

  const body = {
    contents: [{ parts: [{ text: trimmed }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    try {
      const errJson = JSON.parse(raw) as { error?: { message?: string } };
      throw new Error(`Gemini TTS ${res.status}: ${errJson.error?.message ?? raw}`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Gemini TTS")) throw e;
      throw new Error(`Gemini TTS ${res.status}: ${raw}`);
    }
  }

  const json = JSON.parse(raw) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
        }>;
      };
    }>;
  };

  const inline = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw new Error("Gemini TTS returned no audio");

  const mimeType = inline.mimeType ?? "audio/L16;codec=pcm;rate=24000";
  const sampleRate = parsePcmSampleRate(mimeType);
  const pcmBytes =
    typeof Buffer !== "undefined"
      ? new Uint8Array(Buffer.from(inline.data, "base64"))
      : Uint8Array.from(atob(inline.data), (c) => c.charCodeAt(0));
  const wav = pcmToWav(pcmBytes, sampleRate);

  const wavBase64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(wav).toString("base64")
      : btoa(String.fromCharCode(...new Uint8Array(wav)));

  return {
    wavBase64,
    mimeType: "audio/wav",
  };
}

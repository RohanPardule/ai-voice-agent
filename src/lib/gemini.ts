type ChatMessage = { role: string; content: string };

const DEFAULT_MODEL = "gemini-3.6-flash";

function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    (import.meta.env.GEMINI_API_KEY as string | undefined) ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    ""
  );
}

export async function callGemini(
  messages: ChatMessage[],
  opts?: { json?: boolean },
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const model =
    process.env.GEMINI_MODEL ||
    (import.meta.env.GEMINI_MODEL as string | undefined) ||
    DEFAULT_MODEL;
  const systemMsg = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.7,
      ...(opts?.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    try {
      const errJson = JSON.parse(raw) as { error?: { message?: string; status?: string } };
      const msg = errJson.error?.message ?? raw;
      if (res.status === 403 && /leaked|permission/i.test(msg)) {
        throw new Error(
          "Gemini API key is invalid or was disabled. Create a new key at Google AI Studio and update GEMINI_API_KEY in .env",
        );
      }
      throw new Error(`Gemini ${res.status}: ${msg}`);
    } catch (e) {
      if (e instanceof Error && e.message.includes("Gemini API key")) throw e;
      throw new Error(`Gemini ${res.status}: ${raw}`);
    }
  }

  const json = JSON.parse(raw) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt: ${json.promptFeedback.blockReason}`);
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const finishReason = json.candidates?.[0]?.finishReason;
  if (!text && finishReason && finishReason !== "STOP") {
    throw new Error(`Gemini returned no text (reason: ${finishReason})`);
  }

  return text;
}

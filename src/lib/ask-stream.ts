import type { AskAgentInput } from "@/lib/voice-agent.functions";
import {
  enqueueSpeakText,
  waitForSpeechQueue,
} from "@/lib/speech";

export type AskStreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; reply: string }
  | { type: "error"; message: string };

async function* readNdjsonStream(response: Response): AsyncGenerator<AskStreamEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      yield JSON.parse(trimmed) as AskStreamEvent;
    }
  }
}

function pullSpeakableSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buffer;

  while (true) {
    const match = rest.match(/^([\s\S]*?[.!?…])(?:\s+|$)/);
    if (!match) break;
    const sentence = match[1].trim();
    if (sentence.length < 4) break;
    sentences.push(sentence);
    rest = rest.slice(match[0].length);
  }

  return { sentences, rest };
}

export async function speakFromAskStream(
  response: Response,
  lang: string,
  opts: {
    onCaption?: (caption: string) => void;
    onSpeakingStart?: () => void;
  } = {},
): Promise<string> {
  let caption = "";
  let spoken = "";
  let speechBuffer = "";
  let reply = "";
  let startedSpeaking = false;

  const speakSentence = (sentence: string) => {
    if (!startedSpeaking) {
      startedSpeaking = true;
      opts.onSpeakingStart?.();
    }
    spoken = spoken ? `${spoken} ${sentence}` : sentence;
    enqueueSpeakText(sentence, lang, {
      onChunkStart: (chunk) => {
        caption = caption ? `${caption} ${chunk}` : chunk;
        opts.onCaption?.(caption);
      },
    });
  };

  for await (const event of readNdjsonStream(response)) {
    if (event.type === "token") {
      speechBuffer += event.text;
      const { sentences, rest } = pullSpeakableSentences(speechBuffer);
      speechBuffer = rest;
      for (const sentence of sentences) {
        speakSentence(sentence);
      }
    } else if (event.type === "done") {
      reply = event.reply;
    } else if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  if (!reply) {
    throw new Error("Empty response from Gemini");
  }

  const remainder = reply.startsWith(spoken)
    ? reply.slice(spoken.length).trim()
    : speechBuffer.trim() || reply;

  if (remainder) {
    speakSentence(remainder);
  }

  await waitForSpeechQueue();
  return reply;
}

export type AskStreamRequest = Omit<AskAgentInput, "history"> & {
  history: AskAgentInput["history"];
};

export type RealtimeStatus = "connecting" | "connected" | "listening" | "speaking" | "error";

export type RealtimeMessage = { role: "user" | "assistant"; content: string };

export type RealtimeVoiceCallbacks = {
  onStatus?: (status: RealtimeStatus) => void;
  onAgentTranscript?: (text: string, final: boolean) => void;
  onUserTranscript?: (text: string, final: boolean) => void;
  onError?: (message: string) => void;
};

export type ConnectRealtimeOptions = {
  token: string;
  callsUrl: string;
  eventsChannel?: string;
  callbacks?: RealtimeVoiceCallbacks;
};

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    window.setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    }, 3000);
  });
}

function readTranscript(event: Record<string, unknown>): string {
  const item = event.item as { content?: Array<{ transcript?: string; text?: string }> } | undefined;
  if (item?.content?.length) {
    for (const part of item.content) {
      if (part.transcript?.trim()) return part.transcript.trim();
      if (part.text?.trim()) return part.text.trim();
    }
  }
  if (typeof event.transcript === "string") return event.transcript.trim();
  if (typeof event.delta === "string") return event.delta;
  return "";
}

export class RealtimeVoiceSession {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private localStream: MediaStream | null = null;
  private callbacks: RealtimeVoiceCallbacks = {};
  private agentBuffer = "";
  private history: RealtimeMessage[] = [];
  private connected = false;

  getTranscript(): RealtimeMessage[] {
    return [...this.history];
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(opts: ConnectRealtimeOptions): Promise<void> {
    this.callbacks = opts.callbacks ?? {};
    this.callbacks.onStatus?.("connecting");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.localStream = stream;

    const pc = new RTCPeerConnection();
    this.pc = pc;

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.setAttribute("playsinline", "true");
    this.audioEl = audioEl;

    pc.ontrack = (ev) => {
      const [remoteStream] = ev.streams;
      if (remoteStream) audioEl.srcObject = remoteStream;
    };

    pc.addTrack(stream.getAudioTracks()[0]);

    const channelName = opts.eventsChannel ?? "oai-events";
    const dc = pc.createDataChannel(channelName);
    this.dc = dc;
    dc.addEventListener("open", () => {
      this.connected = true;
      this.callbacks.onStatus?.("connected");
    });
    dc.addEventListener("message", (ev) => this.handleEvent(ev.data));
    dc.addEventListener("close", () => {
      this.connected = false;
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const sdp = pc.localDescription?.sdp;
    if (!sdp) throw new Error("Failed to create WebRTC offer");

    const sdpResponse = await fetch(opts.callsUrl, {
      method: "POST",
      body: sdp,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!sdpResponse.ok) {
      const errText = await sdpResponse.text();
      throw new Error(errText || `Realtime call failed (${sdpResponse.status})`);
    }

    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  private handleEvent(raw: string) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = String(event.type ?? "");

    if (type === "error") {
      const message =
        (event.error as { message?: string } | undefined)?.message ??
        "Realtime session error";
      this.callbacks.onStatus?.("error");
      this.callbacks.onError?.(message);
      return;
    }

    if (type === "input_audio_buffer.speech_started") {
      this.callbacks.onStatus?.("listening");
      return;
    }

    if (
      type === "conversation.item.input_audio_transcription.completed" ||
      type === "conversation.item.input_audio_transcription.done"
    ) {
      const text = readTranscript(event);
      if (text) {
        this.pushHistory("user", text);
        this.callbacks.onUserTranscript?.(text, true);
      }
      return;
    }

    if (type === "response.created" || type === "output_audio_buffer.started") {
      this.agentBuffer = "";
      this.callbacks.onStatus?.("speaking");
      return;
    }

    if (
      type === "response.audio_transcript.delta" ||
      type === "response.output_audio_transcript.delta" ||
      type === "response.output_text.delta"
    ) {
      const delta = readTranscript(event);
      if (!delta) return;
      this.agentBuffer += delta;
      this.callbacks.onAgentTranscript?.(this.agentBuffer, false);
      return;
    }

    if (
      type === "response.audio_transcript.done" ||
      type === "response.output_audio_transcript.done" ||
      type === "response.output_text.done"
    ) {
      const text = readTranscript(event) || this.agentBuffer;
      if (text) {
        this.agentBuffer = text;
        this.pushHistory("assistant", text);
        this.callbacks.onAgentTranscript?.(text, true);
      }
      return;
    }

    if (type === "response.done") {
      if (this.agentBuffer.trim()) {
        this.pushHistory("assistant", this.agentBuffer.trim());
        this.callbacks.onAgentTranscript?.(this.agentBuffer.trim(), true);
      }
      this.agentBuffer = "";
      this.callbacks.onStatus?.("connected");
    }
  }

  private pushHistory(role: "user" | "assistant", content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;
    const last = this.history[this.history.length - 1];
    if (last?.role === role && last.content === trimmed) return;
    this.history.push({ role, content: trimmed });
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  disconnect() {
    this.connected = false;
    this.dc?.close();
    this.dc = null;
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl = null;
    }
  }
}

// Tactical Voice Assistant Service: Powered by ElevenLabs TTS & Google Gemini 3.8 Flash
// Leads the player through the real-world outdoor expedition via voice interaction and automatic thinking

import { MovementTelemetry } from './movementTrackingService';
import { GeneratedMission } from './geminiMissionService';
import { LocalityWaypoint } from '../types';

export type VoiceAssistantStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thought?: string;
  action?: string;
  timestamp: number;
}

export interface VoiceAssistantState {
  status: VoiceAssistantStatus;
  activeVoiceId: string;
  activeVoiceName: string;
  isMuted: boolean;
  isAutoLeadEnabled: boolean;
  lastThought: string;
  lastSpokenText: string;
  inputAudioLevel: number; // 0 to 100
  outputAudioLevel: number; // 0 to 100
  history: AssistantMessage[];
  errorMessage: string | null;
  audioSourceUsed: string; // 'elevenlabs' | 'gemini-neural-speech' | 'browser-speech'
}

export type VoiceAssistantActionCallback = (action: string, payload?: any) => void;

class VoiceAssistantService {
  private state: VoiceAssistantState = {
    status: 'idle',
    activeVoiceId: 'IKne3meq5aSn9XLyUdCD', // Charlie - Deep, Confident, Energetic (ElevenLabs)
    activeVoiceName: 'Charlie',
    isMuted: false,
    isAutoLeadEnabled: true,
    lastThought: 'Ready to lead outdoor expedition.',
    lastSpokenText: '',
    inputAudioLevel: 0,
    outputAudioLevel: 0,
    history: [],
    errorMessage: null,
    audioSourceUsed: 'elevenlabs',
  };

  private listeners: Set<(state: VoiceAssistantState) => void> = new Set();
  private actionCallbacks: Set<VoiceAssistantActionCallback> = new Set();

  // Audio Playback
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  // Speech Recognition (STT)
  private recognition: any = null;
  private isListeningInternal = false;
  private micStream: MediaStream | null = null;
  private micAudioCtx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micAnimFrameId: number | null = null;

  // Milestone triggers for auto-coaching
  private lastMilestoneDistance = 0;
  private lastSpokenTimestamp = 0;

  constructor() {
    this.initSpeechRecognition();
  }

  public getState(): VoiceAssistantState {
    return { ...this.state };
  }

  public subscribe(listener: (state: VoiceAssistantState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public onAction(callback: VoiceAssistantActionCallback): () => void {
    this.actionCallbacks.add(callback);
    return () => this.actionCallbacks.delete(callback);
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  private triggerAction(action: string, payload?: any) {
    if (!action || action === 'NONE') return;
    this.actionCallbacks.forEach((cb) => cb(action, payload));
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    if (this.state.isMuted && this.currentAudio) {
      this.currentAudio.pause();
      this.state.status = 'idle';
    }
    this.notify();
  }

  public toggleAutoLead() {
    this.state.isAutoLeadEnabled = !this.state.isAutoLeadEnabled;
    this.notify();
  }

  public setVoiceId(voiceId: string, voiceName: string = 'Charlie') {
    this.state.activeVoiceId = voiceId;
    this.state.activeVoiceName = voiceName;
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // INTERACTION: USER SAYS OR ASKS SOMETHING
  // The AI thinks automatically, crafts spoken response, and triggers game actions
  // ---------------------------------------------------------------------------
  public async interact(
    query: string,
    context?: {
      telemetry?: MovementTelemetry;
      mission?: GeneratedMission;
      activeWaypoint?: LocalityWaypoint | null;
      explorerName?: string;
    }
  ): Promise<string> {
    if (!query.trim()) return '';

    // Stop ongoing speech
    this.stopSpeaking();

    // Record user message in history
    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: query.trim(),
      timestamp: Date.now(),
    };
    this.state.history.push(userMsg);
    this.state.status = 'thinking';
    this.state.errorMessage = null;
    this.notify();

    try {
      const response = await fetch('/api/voice-guide/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          guideVoiceId: this.state.activeVoiceId,
          guideName: this.state.activeVoiceName,
          guideRole: 'Lead Tactical Scout & AI Game Master',
          telemetry: context?.telemetry || {},
          mission: context?.mission || {},
          activeWaypoint: context?.activeWaypoint || null,
          history: this.state.history.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await response.json();
      const thought = data.thought || 'Analyzed explorer question and guided their next outdoor step.';
      const spokenText = data.spokenText || data.response || 'Understood, Explorer. Keep moving forward!';
      const action = data.action || 'NONE';

      this.state.lastThought = thought;
      this.state.lastSpokenText = spokenText;

      const assistantMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        text: spokenText,
        thought,
        action,
        timestamp: Date.now(),
      };
      this.state.history.push(assistantMsg);

      // Trigger any game action (e.g. SHOW_LOCATION, COMPLETE_TASK, NEXT_TASK, POCKET_MODE)
      if (action && action !== 'NONE') {
        this.triggerAction(action, { query, context });
      }

      // Synthesize and speak response
      if (!this.state.isMuted) {
        await this.speak(spokenText);
      } else {
        this.state.status = 'idle';
        this.notify();
      }

      return spokenText;
    } catch (err: any) {
      console.error('[Voice Assistant] Interaction error:', err);
      const fallbackText = "Copy that Explorer! Check your tactical map and let's keep moving towards the objective.";
      this.state.lastThought = 'Handling transient error with encouraging tactical fallback.';
      this.state.lastSpokenText = fallbackText;
      this.state.status = 'idle';
      this.notify();
      if (!this.state.isMuted) {
        this.speak(fallbackText);
      }
      return fallbackText;
    }
  }

  // ---------------------------------------------------------------------------
  // SPEECH SYNTHESIS (ELEVENLABS TTS -> GEMINI NEURAL TTS -> BROWSER TTS)
  // ---------------------------------------------------------------------------
  public async speak(text: string): Promise<void> {
    if (!text.trim() || this.state.isMuted) return;

    this.stopSpeaking();
    this.state.status = 'speaking';
    this.state.lastSpokenText = text.trim();
    this.lastSpokenTimestamp = Date.now();
    this.notify();

    try {
      const response = await fetch('/api/voice-guide/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: this.state.activeVoiceId,
          voiceName: this.state.activeVoiceName,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const sourceHeader = response.headers.get('x-voice-source') || 'elevenlabs';
      this.state.audioSourceUsed = sourceHeader;

      if (response.ok && (contentType.includes('audio') || contentType.includes('application/octet-stream'))) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        await this.playAudioUrl(audioUrl);
        return;
      }

      // If server returned JSON fallback
      console.warn('[Voice Assistant] Server suggested browser speech fallback');
      this.speakWithBrowserSynth(text);
    } catch (err: any) {
      console.warn('[Voice Assistant] Speech fetch error, trying browser synthesis:', err);
      this.speakWithBrowserSynth(text);
    }
  }

  private playAudioUrl(url: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(url);
        this.currentAudio = audio;

        // Setup Web Audio Analyser for live visualizer wave
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            this.audioCtx = ctx;
            const source = ctx.createMediaElementSource(audio);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyser.connect(ctx.destination);
            this.analyser = analyser;
            this.startOutputVisualizerLoop();
          }
        } catch (_) {
          // Fallback visualizer if MediaElementSource cross-origin or already hooked
        }

        audio.onended = () => {
          this.stopOutputVisualizerLoop();
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          this.state.status = 'idle';
          this.state.outputAudioLevel = 0;
          this.notify();
          resolve();
        };

        audio.onerror = () => {
          this.stopOutputVisualizerLoop();
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          this.state.status = 'idle';
          this.state.outputAudioLevel = 0;
          this.notify();
          resolve();
        };

        audio.play().catch((playErr) => {
          console.warn('[Voice Assistant] Audio play was prevented by browser policy:', playErr);
          this.state.status = 'idle';
          this.notify();
          resolve();
        });
      } catch (e) {
        this.state.status = 'idle';
        this.notify();
        resolve();
      }
    });
  }

  private speakWithBrowserSynth(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.state.status = 'idle';
      this.notify();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      // Select natural English voice if present
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes('Australian') ||
          v.name.includes('Natural') ||
          v.name.includes('English')
      );
      if (preferred) {
        utterance.voice = preferred;
      }

      this.state.audioSourceUsed = 'browser-speech';

      utterance.onstart = () => {
        this.state.status = 'speaking';
        this.notify();
      };

      utterance.onend = () => {
        this.state.status = 'idle';
        this.notify();
      };

      utterance.onerror = () => {
        this.state.status = 'idle';
        this.notify();
      };

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      this.state.status = 'idle';
      this.notify();
    }
  }

  public stopSpeaking() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (_) {}
      this.currentAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    this.stopOutputVisualizerLoop();
    this.state.outputAudioLevel = 0;
    if (this.state.status === 'speaking') {
      this.state.status = 'idle';
    }
    this.notify();
  }

  public replayLastMessage() {
    if (this.state.lastSpokenText) {
      this.speak(this.state.lastSpokenText);
    }
  }

  // ---------------------------------------------------------------------------
  // SPEECH RECOGNITION (MIC LISTENING)
  // ---------------------------------------------------------------------------
  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        this.isListeningInternal = true;
        this.state.status = 'listening';
        this.state.errorMessage = null;
        this.notify();
      };

      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          console.log('[Voice Assistant] Recognized user speech:', transcript);
          this.interact(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('[Voice Assistant] Speech recognition event:', event.error);
        this.isListeningInternal = false;
        this.stopMicAudioCapture();
        if (event.error !== 'no-speech') {
          this.state.errorMessage = `Microphone: ${event.error}`;
        }
        this.state.status = 'idle';
        this.notify();
      };

      rec.onend = () => {
        this.isListeningInternal = false;
        this.stopMicAudioCapture();
        if (this.state.status === 'listening') {
          this.state.status = 'idle';
        }
        this.notify();
      };

      this.recognition = rec;
    } catch (e) {
      console.warn('[Voice Assistant] Could not initialize Web Speech API:', e);
    }
  }

  public async startListening(context?: {
    telemetry?: MovementTelemetry;
    mission?: GeneratedMission;
    activeWaypoint?: LocalityWaypoint | null;
  }) {
    this.stopSpeaking();

    // Start mic waveform capture
    await this.startMicAudioCapture();

    if (this.recognition) {
      try {
        this.recognition.start();
        return;
      } catch (err) {
        // Recognition might already be running
      }
    }

    // Fallback if SpeechRecognition not supported in browser:
    this.state.status = 'listening';
    this.notify();
  }

  public stopListening() {
    if (this.recognition && this.isListeningInternal) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
    this.stopMicAudioCapture();
    if (this.state.status === 'listening') {
      this.state.status = 'idle';
    }
    this.notify();
  }

  public toggleListening(context?: any) {
    if (this.state.status === 'listening') {
      this.stopListening();
    } else {
      this.startListening(context);
    }
  }

  // ---------------------------------------------------------------------------
  // AUDIO VISUALIZERS (INPUT MIC & OUTPUT VOICE WAVEFORMS)
  // ---------------------------------------------------------------------------
  private async startMicAudioCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.micStream = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        this.micAudioCtx = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        this.micAnalyser = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          if (!this.micAnalyser) return;
          this.micAnalyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          this.state.inputAudioLevel = Math.min(100, Math.round(avg * 1.6));
          this.notify();
          this.micAnimFrameId = requestAnimationFrame(loop);
        };
        loop();
      }
    } catch (_) {
      // Permission denied or not available
    }
  }

  private stopMicAudioCapture() {
    if (this.micAnimFrameId) {
      cancelAnimationFrame(this.micAnimFrameId);
      this.micAnimFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micAudioCtx && this.micAudioCtx.state !== 'closed') {
      try {
        this.micAudioCtx.close();
      } catch (_) {}
      this.micAudioCtx = null;
    }
    this.micAnalyser = null;
    this.state.inputAudioLevel = 0;
  }

  private startOutputVisualizerLoop() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const loop = () => {
      if (!this.analyser || this.state.status !== 'speaking') return;
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      this.state.outputAudioLevel = Math.min(100, Math.round(avg * 1.8));
      this.notify();
      this.animFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  private stopOutputVisualizerLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  // ---------------------------------------------------------------------------
  // PROACTIVE GAME COACHING (LEADS THE MISSION AUTOMATICALLY)
  // ---------------------------------------------------------------------------
  public announceExpeditionStart(mission: GeneratedMission, explorerName: string = 'Explorer') {
    const text = `G'day ${explorerName}! I'm Charlie, your Tactical Scout Leader. Today's mission is ${mission.title}. We need ${mission.scavengerItems.slice(0, 2).join(' and ')}. Start walking forward along your path, and keep your eyes on the ground!`;
    this.state.lastThought = `Welcoming ${explorerName} to ${mission.title} with energized opening briefing.`;
    this.state.lastSpokenText = text;
    this.state.history.push({
      id: `asst-init-${Date.now()}`,
      role: 'assistant',
      text,
      thought: this.state.lastThought,
      action: 'EXPEDITION_START',
      timestamp: Date.now(),
    });
    this.notify();
    this.speak(text);
  }

  public announceCraftReady(mission: GeneratedMission) {
    const text = `Crafting site reached! Clear a spot on the soil and arrange your items: ${mission.craftInstructions}. Once it looks glorious, tap 'Snap Photo' to verify!`;
    this.state.lastThought = 'Guiding final tactile craft assembly on the soil.';
    this.state.lastSpokenText = text;
    this.state.history.push({
      id: `asst-craft-${Date.now()}`,
      role: 'assistant',
      text,
      thought: this.state.lastThought,
      action: 'CRAFT_READY',
      timestamp: Date.now(),
    });
    this.notify();
    this.speak(text);
  }

  public announceCraftVerified(craftName: string, xp: number) {
    const text = `Spectacular work, Explorer! The ${craftName} has been verified and added to your Codex. You earned ${xp} XP!`;
    this.state.lastThought = 'Celebrating verified nature craft in Codex.';
    this.state.lastSpokenText = text;
    this.state.history.push({
      id: `asst-praise-${Date.now()}`,
      role: 'assistant',
      text,
      thought: this.state.lastThought,
      action: 'CRAFT_VERIFIED',
      timestamp: Date.now(),
    });
    this.notify();
    this.speak(text);
  }

  // Telemetry event hook: Proactively coaches user as they cover real-world distance
  public onMovementTelemetry(
    telemetry: MovementTelemetry,
    mission: GeneratedMission
  ) {
    if (!this.state.isAutoLeadEnabled || this.state.isMuted) return;
    const now = Date.now();
    // Throttle automatic commentary to once every 45 seconds minimum
    if (now - this.lastSpokenTimestamp < 45000) return;

    const distance = telemetry.distanceCoveredMeters || 0;

    // Milestone 1: 50 meters
    if (distance >= 50 && this.lastMilestoneDistance < 50) {
      this.lastMilestoneDistance = 50;
      this.interact('I have walked 50 meters forward', { telemetry, mission });
      return;
    }

    // Milestone 2: 120 meters
    if (distance >= 120 && this.lastMilestoneDistance < 120) {
      this.lastMilestoneDistance = 120;
      this.interact('I have reached 120 meters on the trail', { telemetry, mission });
      return;
    }
  }
}

export const voiceAssistantService = new VoiceAssistantService();

// Tactical Voice Assistant Service: Powered by ElevenLabs TTS & Google Gemini Flash
// Hands-free voice assistant that listens for the wake-word "EcoQuest" and runs quietly in the background
// Keeps the UI focused on the 3D Character and Tactical Google Map!

import { MovementTelemetry } from './movementTrackingService';
import { GeneratedMission } from './geminiMissionService';
import { LocalityWaypoint } from '../types';
import { hapticFeedback } from '../utils/haptics';
import { ambientAudioService } from './ambientAudioService';

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
  isWakeWordEnabled: boolean;
  isAutoLeadEnabled: boolean;
  silenceSecondsRemaining: number; // 0 to 5 countdown
  inputAudioLevel: number; // 0 to 100 for glowing orb
  outputAudioLevel: number; // 0 to 100 for speaking pulse
  audioSourceUsed: string; // 'elevenlabs' | 'gemini-neural-speech' | 'browser-speech'
  lastThought: string;
  lastSpokenText: string;
  errorMessage: string | null;
}

export type VoiceAssistantActionCallback = (action: string, payload?: any) => void;

// -----------------------------------------------------------------------------
// ASSISTANT SOUND EFFECTS (Live Mic Active Chimes, Sleep Tone, Processing)
// Built with Web Audio API for 0 latency, pleasant Apple Siri / Google Assistant fidelity
// -----------------------------------------------------------------------------
class AssistantAudioEffects {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch (_) {
      return null;
    }
  }

  // The Live Mic Active Sound: High-tech, musical dual-tone chime (D5 -> A5)
  public playWakeChime() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;

      // Tone 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Tone 2: 880.00 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.09);
      gain2.gain.setValueAtTime(0.28, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.35);
    } catch (_) {}
  }

  // Sleep / Deactivation chime: Soft descending tone (659Hz -> 440Hz)
  public playSleepChime() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(440.0, now + 0.18);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_) {}
  }

  // Thinking / Processing chime
  public playProcessingChime() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784.0, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (_) {}
  }
}

const soundEffects = new AssistantAudioEffects();

// -----------------------------------------------------------------------------
// VOICE ASSISTANT CORE SERVICE
// -----------------------------------------------------------------------------
class VoiceAssistantService {
  private state: VoiceAssistantState = {
    status: 'idle',
    activeVoiceId: '21m00Tcm4TlvDq8ikWAM', // Aura - Mystical & Enthusiastic (ElevenLabs / Gemini)
    activeVoiceName: 'Aura',
    isMuted: false,
    isWakeWordEnabled: true,
    isAutoLeadEnabled: true,
    silenceSecondsRemaining: 5,
    inputAudioLevel: 0,
    outputAudioLevel: 0,
    audioSourceUsed: 'elevenlabs',
    lastThought: 'Aura is ready. Tap the mic or an observation.',
    lastSpokenText: '',
    errorMessage: null,
  };

  private listeners: Set<(state: VoiceAssistantState) => void> = new Set();
  private actionCallbacks: Set<VoiceAssistantActionCallback> = new Set();

  // Internal Audio Playback
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  // Speech Recognition (Wake Word + Active Listening)
  private recognition: any = null;
  private isRecognitionActive = false;
  private isAwakeListening = false; // true = listening for command, false = standby for wake word
  private currentTranscript = '';
  private silenceTimer: any = null;
  private countdownInterval: any = null;

  // Microphone Audio Level
  private micStream: MediaStream | null = null;
  private micAudioCtx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micAnimFrameId: number | null = null;

  // Context Cache for ongoing session
  private latestContext: {
    telemetry?: MovementTelemetry;
    mission?: GeneratedMission;
    activeWaypoint?: LocalityWaypoint | null;
    explorerName?: string;
  } = {};

  // Milestone triggers for auto-coaching
  private lastMilestoneDistance = 0;
  private lastSpokenTimestamp = 0;

  // Multi-turn conversational memory for smooth, contextual outdoor dialogue
  private conversationHistory: Array<{ role: 'user' | 'assistant'; text: string }> = [];

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

  public updateContext(context: {
    telemetry?: MovementTelemetry;
    mission?: GeneratedMission;
    activeWaypoint?: LocalityWaypoint | null;
    explorerName?: string;
  }) {
    this.latestContext = { ...this.latestContext, ...context };
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    if (this.state.isMuted) {
      this.stopSpeaking();
    }
    this.notify();
  }

  public toggleWakeWord() {
    this.state.isWakeWordEnabled = !this.state.isWakeWordEnabled;
    if (this.state.isWakeWordEnabled) {
      this.startWakeWordStandby();
    } else {
      this.stopListening();
    }
    this.notify();
  }

  public setVoiceId(voiceId: string, voiceName: string = 'Aura') {
    this.state.activeVoiceId = voiceId;
    this.state.activeVoiceName = voiceName;
    this.notify();
  }

  public getLatestMission(): GeneratedMission | undefined {
    return this.latestContext.mission;
  }

  // ---------------------------------------------------------------------------
  // SPEECH RECOGNITION WITH WAKE-WORD DETECTION & AUTO TIMEOUT
  // ---------------------------------------------------------------------------
  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('[Voice Assistant] Web Speech API not supported in this browser.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        this.isRecognitionActive = true;
      };

      rec.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (!lastResult) return;
        const transcript = (lastResult[0]?.transcript || '').trim();
        const isFinal = Boolean(lastResult.isFinal);

        if (!transcript) return;
        this.currentTranscript = transcript;

        // Check for wake word in speech: "aura", "ecoquest", "hey aura", "eco quest"
        const wakeWordRegex = /(?:hey\s+)?(?:aura|eco\s*quest|echo\s*quest|equal\s*quest|aqua\s*quest)\b/i;
        const hasWakeWord = wakeWordRegex.test(transcript);

        if (hasWakeWord && !this.isAwakeListening) {
          // WAKE WORD DETECTED!
          console.log('[Voice Assistant] Wake word detected:', transcript);
          this.handleWakeWordTriggered(transcript);
          return;
        }

        // If in active listening mode and user is speaking
        if (this.isAwakeListening) {
          this.resetSilenceCountdown();
          if (isFinal) {
            const cleanedText = transcript.replace(wakeWordRegex, '').trim();
            if (cleanedText.length >= 2) {
              console.log('[Voice Assistant] Captured user command:', cleanedText);
              this.clearSilenceTimer();
              this.currentTranscript = '';
              soundEffects.playProcessingChime();
              this.isAwakeListening = false;
              this.stopMicAudioCapture();
              this.interact(cleanedText);
            }
          }
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          return;
        }
        if (event.error === 'not-allowed') {
          this.state.errorMessage = 'Mic permission needed for voice assistant';
          this.notify();
        }
      };

      rec.onend = () => {
        this.isRecognitionActive = false;
        if (this.state.isWakeWordEnabled && this.state.status !== 'speaking' && !this.isAwakeListening) {
          setTimeout(() => {
            this.restartStandbySafely();
          }, 500);
        }
      };

      this.recognition = rec;
    } catch (e) {
      console.warn('[Voice Assistant] Speech recognition init failed:', e);
    }
  }

  private restartStandbySafely() {
    if (!this.recognition || this.isRecognitionActive || this.state.status === 'speaking') return;
    try {
      this.recognition.start();
    } catch (_) {}
  }

  public startWakeWordStandby() {
    if (!this.recognition) return;
    this.isAwakeListening = false;
    this.state.status = 'idle';
    this.state.silenceSecondsRemaining = 5;
    this.notify();
    this.restartStandbySafely();
  }

  // Called when user says "Aura" or "EcoQuest"
  private handleWakeWordTriggered(rawTranscript: string) {
    soundEffects.playWakeChime();
    hapticFeedback.radarPulse();

    const wakeWordRegex = /(?:hey\s+)?(?:aura|eco\s*quest|echo\s*quest|equal\s*quest|aqua\s*quest)\b/i;
    const commandPart = rawTranscript.replace(wakeWordRegex, '').trim();

    if (commandPart.length >= 3) {
      console.log('[Voice Assistant] Direct command in wake breath:', commandPart);
      this.clearSilenceTimer();
      soundEffects.playProcessingChime();
      this.isAwakeListening = false;
      this.interact(commandPart);
      return;
    }

    this.activateListeningWithTimeout();
  }

  // Activate active listening (either via wake word or mic button tap)
  public async activateListeningWithTimeout() {
    this.stopSpeaking();
    this.isAwakeListening = true;
    this.currentTranscript = '';
    this.state.status = 'listening';
    this.state.silenceSecondsRemaining = 5;
    this.state.errorMessage = null;
    this.notify();

    // Duck background music immediately so user voice is clear
    ambientAudioService.duckAudioForSpeech(0.12);

    // Play active wake chime & start mic visualizer
    soundEffects.playWakeChime();
    await this.startMicAudioCapture();

    // Safely start or restart recognition with user gesture
    if (this.recognition) {
      try {
        if (this.isRecognitionActive) {
          this.recognition.stop();
        }
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch (_) {}
        }, 120);
      } catch (_) {}
    }

    // Start 5-second silence countdown timer
    this.startSilenceCountdown();
  }

  private resetSilenceCountdown() {
    this.state.silenceSecondsRemaining = 5;
    this.notify();
  }

  private startSilenceCountdown() {
    this.clearSilenceTimer();
    let secondsLeft = 5;
    this.state.silenceSecondsRemaining = secondsLeft;
    this.notify();

    this.countdownInterval = setInterval(() => {
      secondsLeft -= 1;
      this.state.silenceSecondsRemaining = Math.max(0, secondsLeft);
      this.notify();

      if (secondsLeft <= 0) {
        this.handleSilenceTimeout();
      }
    }, 1000);
  }

  private handleSilenceTimeout() {
    const pendingText = this.currentTranscript.trim();
    this.currentTranscript = '';
    this.clearSilenceTimer();
    this.isAwakeListening = false;
    this.stopMicAudioCapture();

    if (pendingText.length >= 2) {
      console.log('[Voice Assistant] Processing captured speech on timeout:', pendingText);
      soundEffects.playProcessingChime();
      this.interact(pendingText);
      return;
    }

    console.log('[Voice Assistant] 5s timeout elapsed with no speech. Deactivating mic.');
    soundEffects.playSleepChime();
    ambientAudioService.restoreAudioAfterSpeech();

    this.state.status = 'idle';
    this.state.silenceSecondsRemaining = 5;
    this.notify();

    this.restartStandbySafely();
  }

  private clearSilenceTimer() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public toggleListening(context?: any) {
    if (context) this.updateContext(context);

    if (this.state.status === 'listening') {
      this.handleSilenceTimeout();
    } else {
      this.activateListeningWithTimeout();
    }
  }

  public stopListening() {
    this.clearSilenceTimer();
    this.isAwakeListening = false;
    this.stopMicAudioCapture();
    if (this.recognition && this.isRecognitionActive) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
    this.state.status = 'idle';
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // AI INTERACTION (ChatGPT / Gemini Brain + Action Hooks)
  // Background processing: No giant transcript or thought boxes needed!
  // ---------------------------------------------------------------------------
  public async interact(
    query: string,
    contextOverride?: {
      telemetry?: MovementTelemetry;
      mission?: GeneratedMission;
      activeWaypoint?: LocalityWaypoint | null;
      explorerName?: string;
    }
  ): Promise<string> {
    if (!query.trim()) return '';

    const ctx = { ...this.latestContext, ...contextOverride };
    this.stopSpeaking();
    this.clearSilenceTimer();

    this.state.status = 'thinking';
    this.state.errorMessage = null;
    this.notify();

    try {
      const response = await fetch('/api/voice-guide/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          guideVoiceId: this.state.activeVoiceId || '21m00Tcm4TlvDq8ikWAM',
          guideName: this.state.activeVoiceName || 'Aura',
          guideRole: 'Mystical Nature Guide & Quest Master (EcoQuest Go)',
          telemetry: ctx.telemetry || {},
          mission: ctx.mission || {},
          activeWaypoint: ctx.activeWaypoint || null,
          history: this.conversationHistory.slice(-6),
        }),
      });

      const data = await response.json();
      const thought = data.thought || 'Guiding explorer with clear outdoor direction.';
      const spokenText = data.spokenText || data.response || "Copy that! Check your map and let's keep moving!";
      const action = data.action || 'NONE';

      this.state.lastThought = thought;
      this.state.lastSpokenText = spokenText;

      // Append to conversational memory for smooth continuous dialogue
      this.conversationHistory.push({ role: 'user', text: query.trim() });
      this.conversationHistory.push({ role: 'assistant', text: spokenText });
      if (this.conversationHistory.length > 12) {
        this.conversationHistory = this.conversationHistory.slice(-12);
      }

      // Trigger map/game actions in background
      if (action && action !== 'NONE') {
        this.triggerAction(action, { query, context: ctx });
      }

      // Speak answer through earphones/audio
      if (!this.state.isMuted) {
        await this.speak(spokenText);
      } else {
        this.state.status = 'idle';
        this.notify();
        this.startWakeWordStandby();
      }

      return spokenText;
    } catch (err: any) {
      console.warn('[Voice Assistant] Interaction error:', err);
      const fallbackText = "I'm with you! Keep an eye on your trail and let's find the next craft item.";
      this.state.lastThought = 'Graceful conversational fallback.';
      this.state.lastSpokenText = fallbackText;
      if (!this.state.isMuted) {
        await this.speak(fallbackText);
      } else {
        this.state.status = 'idle';
        this.notify();
        this.startWakeWordStandby();
      }
      return fallbackText;
    }
  }

  // ---------------------------------------------------------------------------
  // SPEECH SYNTHESIS (ELEVENLABS TTS -> ULTRA-NATURAL BROWSER SYNTHESIS)
  // Ensures natural human cadence, zero robotic drone!
  // ---------------------------------------------------------------------------
  public async speak(text: string): Promise<void> {
    if (!text.trim() || this.state.isMuted) return;

    this.stopSpeaking();
    this.state.status = 'speaking';
    this.state.lastSpokenText = text.trim();
    this.lastSpokenTimestamp = Date.now();
    this.notify();

    // Duck background music immediately for speech playback
    ambientAudioService.duckAudioForSpeech(0.1);

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

      // Fallback to high-definition human browser speech
      await this.speakWithNaturalBrowserSynth(text);
    } catch (err: any) {
      console.warn('[Voice Assistant] Speech fetch error, falling back to natural speech:', err);
      await this.speakWithNaturalBrowserSynth(text);
    }
  }

  private playAudioUrl(url: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(url);
        this.currentAudio = audio;

        // Visualizer wave loop
        this.startOutputVisualizerLoop();

        const handleAudioDone = () => {
          this.stopOutputVisualizerLoop();
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          this.state.status = 'idle';
          this.state.outputAudioLevel = 0;
          this.notify();

          // Restore background music smoothly after speech finishes
          ambientAudioService.restoreAudioAfterSpeech();

          this.startWakeWordStandby();
          resolve();
        };

        audio.onended = handleAudioDone;
        audio.onerror = handleAudioDone;

        audio.play().catch(() => {
          handleAudioDone();
        });
      } catch (_) {
        this.state.status = 'idle';
        this.notify();
        ambientAudioService.restoreAudioAfterSpeech();
        this.startWakeWordStandby();
        resolve();
      }
    });
  }

  // Ultra-natural human speech synthesis engine
  // Carefully picks top-grade Natural/Neural voices to avoid robotic tones
  private speakWithNaturalBrowserSynth(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        this.state.status = 'idle';
        this.notify();
        this.startWakeWordStandby();
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel();

        // Clean text of symbols/markdown for warm human delivery
        const cleanSpoken = text
          .replace(/[*_#`~[\]()]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        const utterance = new SpeechSynthesisUtterance(cleanSpoken);
        utterance.rate = 1.0; // Natural conversational tempo
        utterance.pitch = 1.0; // Natural pitch
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();

        // 1. Natural / Neural online voices (Edge & Chrome Natural voices)
        const naturalVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') || v.name.includes('Online'))
        );

        // 2. Google High Quality US/UK voices
        const googleVoice = voices.find(
          (v) =>
            (v.name.includes('Google US English') ||
              v.name.includes('Google UK English') ||
              v.name.includes('Google')) &&
            v.lang.startsWith('en')
        );

        // 3. Apple Siri / Samantha / Daniel / Karen voices
        const appleVoice = voices.find(
          (v) =>
            (v.name.includes('Siri') ||
              v.name.includes('Samantha') ||
              v.name.includes('Daniel') ||
              v.name.includes('Karen') ||
              v.name.includes('Oliver')) &&
            v.lang.startsWith('en')
        );

        const chosenVoice = naturalVoice || googleVoice || appleVoice || voices.find((v) => v.lang.startsWith('en'));
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }

        this.state.audioSourceUsed = 'browser-speech';

        // Fake pulse for waveform while browser speaking
        let synthPulseInterval: any = setInterval(() => {
          this.state.outputAudioLevel = Math.floor(35 + Math.random() * 55);
          this.notify();
        }, 120);

        utterance.onstart = () => {
          this.state.status = 'speaking';
          this.notify();
        };

        utterance.onend = () => {
          clearInterval(synthPulseInterval);
          this.state.outputAudioLevel = 0;
          this.state.status = 'idle';
          this.notify();
          ambientAudioService.restoreAudioAfterSpeech();
          this.startWakeWordStandby();
          resolve();
        };

        utterance.onerror = () => {
          clearInterval(synthPulseInterval);
          this.state.outputAudioLevel = 0;
          this.state.status = 'idle';
          this.notify();
          ambientAudioService.restoreAudioAfterSpeech();
          this.startWakeWordStandby();
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (_) {
        this.state.status = 'idle';
        this.notify();
        ambientAudioService.restoreAudioAfterSpeech();
        this.startWakeWordStandby();
        resolve();
      }
    });
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
    ambientAudioService.restoreAudioAfterSpeech();
    this.notify();
  }

  public replayLastMessage() {
    if (this.state.lastSpokenText) {
      this.speak(this.state.lastSpokenText);
    }
  }

  // ---------------------------------------------------------------------------
  // VISUALIZERS (MIC & VOICE WAVEFORMS)
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
          this.state.inputAudioLevel = Math.min(100, Math.round(avg * 1.8));
          this.notify();
          this.micAnimFrameId = requestAnimationFrame(loop);
        };
        loop();
      }
    } catch (_) {}
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
    // Generate pulse loop
    const loop = () => {
      if (this.state.status !== 'speaking') return;
      this.state.outputAudioLevel = Math.floor(40 + Math.random() * 55);
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
    this.state.outputAudioLevel = 0;
  }

  // ---------------------------------------------------------------------------
  // AURA EXPEDITION & QUEST METHODS
  // ---------------------------------------------------------------------------
  public async startMissionWithAura(mission: GeneratedMission, explorerName: string = 'Explorer') {
    this.updateContext({ mission, explorerName });
    soundEffects.playWakeChime();
    const text = `Greetings ${explorerName}! I am Aura, your mystical guide in EcoQuest Go. Your quest has begun: search the path for natural treasures to complete ${mission.title}! Tap the mic or an observation below whenever you find something.`;
    this.state.lastThought = `Active quest: ${mission.title}. Aura standing by.`;
    this.state.lastSpokenText = text;
    this.notify();
    await this.speak(text);
  }

  public announceExpeditionStart(mission: GeneratedMission, explorerName: string = 'Explorer') {
    const text = `Greetings ${explorerName}! I am Aura, your mystical guide in EcoQuest Go. Today our quest is ${mission.title}. Start walking along your path, and tell me what natural wonders you discover!`;
    this.state.lastThought = `EcoQuest Go quest briefing: ${mission.title}.`;
    this.state.lastSpokenText = text;
    this.notify();
    this.speak(text);
  }

  public announceCraftVerified(craftName: string, xp: number) {
    const text = `Splendid discovery! The forest spirits celebrate your ${craftName}. You have earned ${xp} points on your quest!`;
    this.state.lastThought = 'Celebrating verified quest craft with points.';
    this.state.lastSpokenText = text;
    this.notify();
    this.speak(text);
  }

  public onMovementTelemetry(telemetry: MovementTelemetry, mission: GeneratedMission) {
    this.updateContext({ telemetry, mission });
    if (!this.state.isAutoLeadEnabled || this.state.isMuted) return;
    const now = Date.now();
    if (now - this.lastSpokenTimestamp < 50000) return;

    const distance = telemetry.distanceCoveredMeters || 0;
    if (distance >= 60 && this.lastMilestoneDistance < 60) {
      this.lastMilestoneDistance = 60;
      this.interact('I have walked 60 meters forward');
    }
  }
}

export const voiceAssistantService = new VoiceAssistantService();

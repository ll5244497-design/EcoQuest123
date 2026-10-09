import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Zap,
  Radio,
  Compass,
  Footprints,
  Send,
  ChevronDown,
  ChevronUp,
  Settings,
  Check,
  Headphones,
  Shield,
  MapPin,
  Bot,
} from 'lucide-react';
import {
  voiceAssistantService,
  VoiceAssistantState,
} from '../services/voiceAssistantService';
import { MovementTelemetry } from '../services/movementTrackingService';
import { GeneratedMission } from '../services/geminiMissionService';
import { LocalityWaypoint } from '../types';
import { hapticFeedback } from '../utils/haptics';

interface VoiceAssistantHUDProps {
  telemetry: MovementTelemetry;
  mission: GeneratedMission;
  activeWaypoint?: LocalityWaypoint | null;
  explorerName?: string;
  onActionTriggered?: (action: string, payload?: any) => void;
  compact?: boolean;
}

export const VoiceAssistantHUD: React.FC<VoiceAssistantHUDProps> = ({
  telemetry,
  mission,
  activeWaypoint,
  explorerName = 'Explorer',
  onActionTriggered,
  compact = false,
}) => {
  const [state, setState] = useState<VoiceAssistantState>(
    voiceAssistantService.getState()
  );
  const [textInput, setTextInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showSettings, setShowSettings] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [keyUpdateStatus, setKeyUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    const unsub = voiceAssistantService.subscribe((s) => setState(s));
    const unsubAction = voiceAssistantService.onAction((action, payload) => {
      if (onActionTriggered) {
        onActionTriggered(action, payload);
      }
    });
    return () => {
      unsub();
      unsubAction();
    };
  }, [onActionTriggered]);

  // Hook movement updates to automatic AI coaching
  useEffect(() => {
    voiceAssistantService.onMovementTelemetry(telemetry, mission);
  }, [telemetry, mission]);

  const handleMicToggle = () => {
    hapticFeedback.tactileClick();
    voiceAssistantService.toggleListening({
      telemetry,
      mission,
      activeWaypoint,
    });
  };

  const handleQuickPrompt = (prompt: string) => {
    hapticFeedback.buttonPress();
    voiceAssistantService.interact(prompt, {
      telemetry,
      mission,
      activeWaypoint,
      explorerName,
    });
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const q = textInput.trim();
    setTextInput('');
    hapticFeedback.tactileClick();
    voiceAssistantService.interact(q, {
      telemetry,
      mission,
      activeWaypoint,
      explorerName,
    });
  };

  const handleReplay = () => {
    hapticFeedback.tactileClick();
    voiceAssistantService.replayLastMessage();
  };

  const handleSaveApiKey = async () => {
    if (!customKeyInput.trim()) return;
    try {
      setKeyUpdateStatus('Saving...');
      const res = await fetch('/api/elevenlabs/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: customKeyInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setKeyUpdateStatus('Saved successfully!');
        setTimeout(() => setKeyUpdateStatus(null), 3000);
      } else {
        setKeyUpdateStatus('Error saving key');
      }
    } catch (err: any) {
      setKeyUpdateStatus('Failed to update key');
    }
  };

  // Determine current active level for wave animation
  const currentAudioLevel =
    state.status === 'listening'
      ? state.inputAudioLevel
      : state.status === 'speaking'
      ? state.outputAudioLevel
      : 0;

  return (
    <div className="w-full rounded-3xl bg-stone-900 text-stone-50 border border-stone-700/80 shadow-[0_4px_0_0_#1c1917] overflow-hidden select-none transition-all">
      {/* 1. TOP STATUS BAR: AI COMM IDENTITY */}
      <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-base shadow-inner">
              ⚡
            </div>
            {/* Live Indicator Beacon */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-stone-950 ${
                state.status === 'speaking'
                  ? 'bg-emerald-400 animate-ping'
                  : state.status === 'thinking'
                  ? 'bg-amber-400 animate-pulse'
                  : state.status === 'listening'
                  ? 'bg-cyan-400 animate-ping'
                  : 'bg-emerald-500'
              }`}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display font-black text-sm sm:text-base text-stone-50 tracking-tight">
                Charlie
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                AI GAME MASTER
              </span>
              <span className="text-[9px] font-mono text-stone-400 hidden sm:inline">
                ElevenLabs IKne3meq5aSn9XLyUdCD
              </span>
            </div>
            <div className="text-[11px] font-mono text-stone-400 flex items-center gap-1.5 truncate">
              <span className="text-emerald-400 font-bold">
                {state.status === 'speaking'
                  ? '● TRANSMITTING AUDIO'
                  : state.status === 'thinking'
                  ? '● ANALYZING TACTICAL SITUATION...'
                  : state.status === 'listening'
                  ? '● LISTENING TO SCOUT...'
                  : '● LEADING EXPEDITION'}
              </span>
              <span className="text-stone-600">·</span>
              <span className="truncate text-stone-400">
                {state.audioSourceUsed === 'elevenlabs'
                  ? 'ElevenLabs Turbo'
                  : state.audioSourceUsed === 'gemini-neural-speech'
                  ? 'Gemini Neural Voice'
                  : 'Browser Speech'}
              </span>
            </div>
          </div>
        </div>

        {/* Controls: Mute, Auto-Lead, Expand, Settings */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Auto-Lead Toggle */}
          <button
            onClick={() => {
              hapticFeedback.tactileClick();
              voiceAssistantService.toggleAutoLead();
            }}
            title={
              state.isAutoLeadEnabled
                ? 'AI proactively leads your trek'
                : 'AI speaks only when asked'
            }
            className={`h-8 px-2 sm:px-2.5 rounded-xl font-mono text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
              state.isAutoLeadEnabled
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                : 'bg-stone-800 text-stone-400 border-stone-700'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">AUTO-LEAD</span>
          </button>

          {/* Mute Toggle */}
          <button
            onClick={() => {
              hapticFeedback.tactileClick();
              voiceAssistantService.toggleMute();
            }}
            title={state.isMuted ? 'Unmute voice' : 'Mute voice'}
            className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            {state.isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-stone-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>

          {/* Settings Drawer */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="ElevenLabs Settings"
            className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 2. ELEVENLABS SETTINGS DRAWER */}
      {showSettings && (
        <div className="p-3.5 bg-stone-950 border-b border-stone-800 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-stone-400">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" /> ElevenLabs Voice Configuration
            </span>
            <span className="text-[10px] text-stone-500">
              Voice ID: IKne3meq5aSn9XLyUdCD
            </span>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            The app uses Voice ID <strong className="text-white">IKne3meq5aSn9XLyUdCD</strong> (Charlie - Deep, Confident, Energetic). If you generated a new API key (starts with <code className="text-amber-300">sk_</code>), you can update it below:
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Paste ElevenLabs sk_... key"
              value={customKeyInput}
              onChange={(e) => setCustomKeyInput(e.target.value)}
              className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3 py-1.5 text-stone-100 text-xs focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={handleSaveApiKey}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl cursor-pointer"
            >
              Update Key
            </button>
          </div>
          {keyUpdateStatus && (
            <div className="text-[11px] text-emerald-400 font-semibold">
              {keyUpdateStatus}
            </div>
          )}
        </div>
      )}

      {/* 3. DYNAMIC AUDIO WAVEFORM VISUALIZER */}
      <div className="px-3.5 sm:px-5 py-2 bg-stone-950/60 border-b border-stone-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-400">
          <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>NEURAL AUDIO FREQUENCY</span>
        </div>

        {/* 16 Audio Waveform Bars */}
        <div className="flex items-center gap-1 h-5">
          {Array.from({ length: 16 }).map((_, idx) => {
            const height =
              currentAudioLevel > 0
                ? Math.max(3, Math.min(20, (Math.sin(idx + Date.now() / 200) + 1) * (currentAudioLevel / 10)))
                : 3;
            return (
              <span
                key={idx}
                className="w-1 rounded-full transition-all duration-75"
                style={{
                  height: `${height}px`,
                  backgroundColor:
                    state.status === 'speaking'
                      ? '#10b981'
                      : state.status === 'listening'
                      ? '#06b6d4'
                      : '#57534e',
                }}
              />
            );
          })}
        </div>

        <div className="text-[10px] font-mono text-stone-400 font-bold">
          {state.status === 'speaking'
            ? 'AUDIO OUT'
            : state.status === 'listening'
            ? 'MIC IN'
            : 'READY'}
        </div>
      </div>

      {/* 4. EXPANDABLE BODY: THOUGHT STREAM + SPOKEN TRANSMISSION */}
      {isExpanded && (
        <div className="p-3.5 sm:p-5 space-y-3.5">
          {/* AI Internal Reasoning (The Thinking Brain) */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 uppercase font-bold tracking-wider">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Tactical Reasoning
              </span>
              <span className="text-stone-500">Autonomous Evaluation</span>
            </div>
            <p className="text-xs font-mono text-stone-300 italic leading-relaxed">
              "{state.lastThought || 'Evaluating real-world outdoor environment and mission objectives...'}"
            </p>
          </div>

          {/* Current Spoken Transmission */}
          <div className="relative p-3.5 sm:p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Charlie Spoke:</span>
              </div>
              {state.lastSpokenText && (
                <button
                  onClick={handleReplay}
                  title="Replay audio"
                  className="px-2 py-0.5 rounded-lg bg-stone-700/80 hover:bg-stone-600 text-stone-200 text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Replay Audio</span>
                </button>
              )}
            </div>

            <p className="text-xs sm:text-sm font-sans font-medium text-stone-100 leading-relaxed">
              {state.lastSpokenText ||
                "Welcome Scout! Tap the microphone or any tactical command below to start our voice expedition."}
            </p>
          </div>

          {/* 5. TACTICAL QUICK VOICE ACTIONS (ONE-TOUCH RADIOS) */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-stone-400 uppercase font-semibold">
              Quick Voice Dispatches:
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                onClick={() => handleQuickPrompt('What should I do now?')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono font-medium border border-stone-700/80 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <span>🎯</span>
                <span>What do I do now?</span>
              </button>

              <button
                onClick={() => handleQuickPrompt('Where am I right now? Center my location on the map.')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono font-medium border border-stone-700/80 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <span>📍</span>
                <span>Where am I?</span>
              </button>

              <button
                onClick={() => handleQuickPrompt('I found the leaves and twig on the ground!')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono font-medium border border-stone-700/80 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <span>🍃</span>
                <span>Found the item!</span>
              </button>

              <button
                onClick={() => handleQuickPrompt('What is the next exploration objective?')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono font-medium border border-stone-700/80 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <span>⏩</span>
                <span>Next objective</span>
              </button>

              <button
                onClick={() => handleQuickPrompt('Scan the local flora and trees in this area.')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono font-medium border border-stone-700/80 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <span>🌲</span>
                <span>Scan biome</span>
              </button>
            </div>
          </div>

          {/* 6. INPUT ACTIONS: BIG TACTILE MIC BUTTON & TEXT FALLBACK */}
          <div className="pt-1 flex items-center gap-2">
            {/* Big Mic Button */}
            <button
              onClick={handleMicToggle}
              className={`flex-1 py-3 px-4 rounded-2xl font-mono text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all border shadow-lg ${
                state.status === 'listening'
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-stone-950 border-cyan-300 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-stone-950 border-emerald-400 active:scale-[0.98]'
              }`}
            >
              {state.status === 'listening' ? (
                <>
                  <MicOff className="w-4 h-4 shrink-0" />
                  <span>Listening... Tap to Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 shrink-0" />
                  <span>Talk with Charlie</span>
                </>
              )}
            </button>
          </div>

          {/* Optional Text Input for Quiet Environments */}
          <form onSubmit={handleTextSubmit} className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Or type a question to Charlie..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="flex-1 bg-stone-950/80 border border-stone-800 rounded-xl px-3.5 py-2 text-xs font-mono text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || state.status === 'thinking'}
              className="px-3 py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 rounded-xl text-xs font-mono flex items-center justify-center cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

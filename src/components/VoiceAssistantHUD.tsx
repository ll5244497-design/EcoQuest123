import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Settings,
  Sparkles,
  RotateCcw,
  X,
  Check,
  Key,
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
}

export const VoiceAssistantHUD: React.FC<VoiceAssistantHUDProps> = ({
  telemetry,
  mission,
  activeWaypoint,
  explorerName = 'Explorer',
  onActionTriggered,
}) => {
  const [state, setState] = useState<VoiceAssistantState>(
    voiceAssistantService.getState()
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  // Keep background context synced
  useEffect(() => {
    voiceAssistantService.updateContext({
      telemetry,
      mission,
      activeWaypoint,
      explorerName,
    });
  }, [telemetry, mission, activeWaypoint, explorerName]);

  // Proactive movement coaching in background
  useEffect(() => {
    voiceAssistantService.onMovementTelemetry(telemetry, mission);
  }, [telemetry, mission]);

  const handleMicClick = () => {
    hapticFeedback.buttonPress();
    voiceAssistantService.toggleListening({
      telemetry,
      mission,
      activeWaypoint,
      explorerName,
    });
  };

  const handleMuteToggle = () => {
    hapticFeedback.tactileClick();
    voiceAssistantService.toggleMute();
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
        setKeyUpdateStatus('Key saved successfully!');
        setTimeout(() => {
          setKeyUpdateStatus(null);
          setIsSettingsOpen(false);
        }, 1500);
      } else {
        setKeyUpdateStatus(data.error || 'Error saving key');
      }
    } catch (_) {
      setKeyUpdateStatus('Failed to update key');
    }
  };

  const isListening = state.status === 'listening';
  const isThinking = state.status === 'thinking';
  const isSpeaking = state.status === 'speaking';

  return (
    <>
      {/* Sleek, Non-Intrusive Siri/Google Assistant Dock */}
      <div className="w-full my-2 sm:my-3">
        <div className="relative overflow-hidden rounded-2xl bg-stone-900/95 dark:bg-stone-900/95 border border-stone-700/80 shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur-md px-3.5 py-2.5 sm:px-4 sm:py-3 transition-all">
          {/* Subtle Ambient Aura when listening or speaking */}
          {isListening && (
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-amber-500/15 to-emerald-500/10 animate-pulse pointer-events-none" />
          )}
          {isSpeaking && (
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-emerald-500/15 to-teal-500/10 animate-pulse pointer-events-none" />
          )}

          <div className="relative flex items-center justify-between gap-3 min-w-0">
            {/* Left: Interactive Siri/Google Assistant Orb & Status */}
            <div
              onClick={handleMicClick}
              className="flex items-center gap-3 min-w-0 cursor-pointer group select-none"
              title="Click or say 'EcoQuest' to speak"
            >
              {/* Animated Siri/Google Glowing Orb */}
              <div className="relative flex items-center justify-center shrink-0">
                {/* Outer Breathing Rings */}
                {isListening ? (
                  <span className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-emerald-400 opacity-75 blur-xs animate-spin duration-3000" />
                ) : isSpeaking ? (
                  <span className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-cyan-400 via-emerald-400 to-teal-400 opacity-70 blur-xs animate-pulse" />
                ) : isThinking ? (
                  <span className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-400 to-purple-500 opacity-70 blur-xs animate-spin" />
                ) : (
                  <span className="absolute -inset-1 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/40 transition-colors" />
                )}

                {/* Core Orb Button */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md relative z-10 ${
                    isListening
                      ? 'bg-rose-500 text-white scale-105'
                      : isSpeaking
                      ? 'bg-emerald-600 text-white'
                      : isThinking
                      ? 'bg-amber-500 text-stone-950 animate-pulse'
                      : 'bg-stone-800 text-emerald-400 border border-stone-700/80 group-hover:border-emerald-500/50'
                  }`}
                >
                  {isListening ? (
                    <Mic className="w-5 h-5 animate-bounce" />
                  ) : isSpeaking ? (
                    <Radio className="w-5 h-5 animate-pulse" />
                  ) : isThinking ? (
                    <Sparkles className="w-5 h-5 animate-spin" />
                  ) : (
                    <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  )}
                </div>
              </div>

              {/* Status & Wake Word Hint (No transcripts/thoughts clutter) */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-xs sm:text-sm text-stone-100 tracking-tight">
                    Charlie
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-stone-800 text-stone-400 border border-stone-700/50">
                    AI Guide
                  </span>

                  {/* 5-second countdown indicator when listening */}
                  {isListening && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse">
                      Listening ({state.silenceSecondsRemaining}s)
                    </span>
                  )}
                  {isThinking && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/50">
                      Thinking...
                    </span>
                  )}
                  {isSpeaking && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Speaking
                    </span>
                  )}
                </div>

                <div className="text-[11px] sm:text-xs text-stone-400 flex items-center gap-1.5 truncate">
                  {isListening ? (
                    <span className="text-rose-300 font-medium truncate">
                      Listening to your command... (mic turns off in {state.silenceSecondsRemaining}s)
                    </span>
                  ) : isSpeaking ? (
                    <span className="text-emerald-300 font-medium truncate">
                      Audio playing through speakers/earphones
                    </span>
                  ) : isThinking ? (
                    <span className="text-amber-300 font-medium">Processing your outdoor request...</span>
                  ) : (
                    <span className="truncate">
                      Say <strong className="text-emerald-400 font-mono font-bold">"EcoQuest"</strong> or tap mic to speak
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Controls (Stop/Replay, Mute, Settings) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Replay Button if speech was recently played */}
              {state.lastSpokenText && !isSpeaking && !isListening && (
                <button
                  onClick={() => {
                    hapticFeedback.tactileClick();
                    voiceAssistantService.replayLastMessage();
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 transition-colors cursor-pointer border border-stone-700/60"
                  title="Replay last spoken guidance"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              {/* Mute Button */}
              <button
                onClick={handleMuteToggle}
                className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer border ${
                  state.isMuted
                    ? 'bg-rose-950/60 text-rose-400 border-rose-800/80 hover:bg-rose-900/80'
                    : 'bg-stone-800 text-stone-300 border-stone-700/60 hover:bg-stone-700 hover:text-stone-100'
                }`}
                title={state.isMuted ? 'Unmute voice assistant' : 'Mute voice assistant'}
              >
                {state.isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              {/* Settings / API Key Popover Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 sm:p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer border border-stone-700/60"
                title="Voice Assistant & ElevenLabs Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Dialog (Tucked away, zero clutter on main screen) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-stone-900 text-stone-100 border border-stone-700 p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display font-extrabold text-base">
                  Voice Assistant Settings
                </h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs font-mono">
              <div>
                <label className="block text-stone-300 font-bold mb-1">
                  Wake-Word Detection:
                </label>
                <div className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 flex items-center justify-between">
                  <div>
                    <div className="text-stone-200 font-bold">Say "EcoQuest"</div>
                    <div className="text-stone-400 text-[10px]">
                      Turns on mic automatically with wake chime, auto-turns off after 5s of silence
                    </div>
                  </div>
                  <button
                    onClick={() => voiceAssistantService.toggleWakeWord()}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
                      state.isWakeWordEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-700 text-stone-300'
                    }`}
                  >
                    {state.isWakeWordEnabled ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-bold mb-1">
                  Active Voice Persona:
                </label>
                <div className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 text-stone-300 text-[11px]">
                  Charlie · ElevenLabs Voice ID: <code className="text-amber-400">IKne3meq5aSn9XLyUdCD</code>
                  <div className="text-stone-400 text-[10px] mt-0.5">
                    Audio Engine: {state.audioSourceUsed === 'elevenlabs' ? 'ElevenLabs Turbo' : 'Neural Natural Speech Engine'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-bold mb-1">
                  ElevenLabs API Key (Optional):
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter sk_... key"
                    value={customKeyInput}
                    onChange={(e) => setCustomKeyInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-stone-100 text-xs focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors text-xs"
                  >
                    Save
                  </button>
                </div>
                {keyUpdateStatus && (
                  <div className="mt-1 text-[11px] text-emerald-400">
                    {keyUpdateStatus}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-mono text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

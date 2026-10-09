import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Camera,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Square,
  CheckCircle2,
  Smartphone,
  Flame,
  ArrowRight,
  Shield,
  Radio,
  Footprints,
  MapPin,
  Compass,
  X,
  Music,
} from 'lucide-react';
import { CharacterCanvas } from './CharacterCanvas';
import { PhotoScavengerModal } from './PhotoScavengerModal';
import { StickerBookModal, StickerEntry } from './StickerBookModal';
import { ambientAudioService } from '../services/ambientAudioService';
import {
  GeneratedMission,
  generateOutdoorMission,
  getCurrentTimeOfDay,
  DailyNatureChallenge,
} from '../services/geminiMissionService';
import {
  movementTrackingService,
  MovementTelemetry,
} from '../services/movementTrackingService';
import { LocalityWaypoint } from '../types';
import { hapticFeedback } from '../utils/haptics';
import { TacticalGoogleMap } from './TacticalGoogleMap';
import { getCurrentGreeting } from '../utils/timeGreeting';

interface MissionHUDProps {
  explorerName: string;
  isWalking: boolean;
  setIsWalking: (walking: boolean) => void;
  onOpenPocketMode: () => void;
  onBackToCharacterSelect: () => void;
  onOpenDailyChallenges?: () => void;
  onOpenStickers?: () => void;
  onOpenBioCards?: () => void;
  onOpenBlueprint?: () => void;
  unlockedStickers: StickerEntry[];
  setUnlockedStickers: React.Dispatch<React.SetStateAction<StickerEntry[]>>;
  currentLevel: number;
  setCurrentLevel: React.Dispatch<React.SetStateAction<number>>;
  totalXp: number;
  setTotalXp: React.Dispatch<React.SetStateAction<number>>;
  dailyChallenges?: DailyNatureChallenge[];
}

export const MissionHUD: React.FC<MissionHUDProps> = ({
  explorerName,
  isWalking,
  setIsWalking,
  onOpenPocketMode,
  onBackToCharacterSelect,
  onOpenDailyChallenges,
  onOpenStickers,
  onOpenBioCards,
  onOpenBlueprint,
  unlockedStickers,
  setUnlockedStickers,
  currentLevel,
  setCurrentLevel,
  totalXp,
  setTotalXp,
  dailyChallenges = [],
}) => {
  // Modals
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isStickerBookModalOpen, setIsStickerBookModalOpen] = useState(false);

  // Time-aware welcome greeting calculation based on actual local time
  const [timeGreeting, setTimeGreeting] = useState(() => getCurrentGreeting());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeGreeting(getCurrentGreeting());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Compact Ambient Audio State
  const [audioState, setAudioState] = useState(ambientAudioService.getState());

  useEffect(() => {
    const unsubAudio = ambientAudioService.subscribe((s) => setAudioState(s));
    ambientAudioService.start();
    return () => unsubAudio();
  }, []);

  // Movement Telemetry
  const [telemetry, setTelemetry] = useState<MovementTelemetry>(
    movementTrackingService.getTelemetry()
  );

  useEffect(() => {
    const unsub = movementTrackingService.subscribe((t) => {
      setTelemetry(t);
      setIsWalking(t.state === 'MOVING');
    });
    return () => unsub();
  }, [setIsWalking]);

  // GPS Nature Waypoints for Locality Google Map
  const [localWaypoints, setLocalWaypoints] = useState<LocalityWaypoint[]>([]);
  const [activeWaypoint, setActiveWaypoint] = useState<LocalityWaypoint | null>(null);

  const liveWaypoints = React.useMemo(() => {
    return localWaypoints.map((wp) => {
      const R = 6371e3;
      const p1 = (telemetry.latitude * Math.PI) / 180;
      const p2 = (wp.lat * Math.PI) / 180;
      const dp = ((wp.lat - telemetry.latitude) * Math.PI) / 180;
      const dl = ((wp.lng - telemetry.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dp / 2) ** 2 +
        Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = Math.round(R * c);
      return {
        ...wp,
        distanceMeters: dist,
      };
    });
  }, [localWaypoints, telemetry.latitude, telemetry.longitude]);

  useEffect(() => {
    const baseLat = telemetry.latitude || 37.7749;
    const baseLng = telemetry.longitude || -122.4194;

    const initialWaypoints: LocalityWaypoint[] = [
      {
        id: 'wp-dragon-1',
        name: 'Broad Fallen Leaves Cache',
        category: 'Botanical',
        description: 'Look beneath shaded oak or maple canopy for broad fallen leaves.',
        audioPrompt: 'Find two broad fallen leaves on the ground for your craft dragon wings.',
        lat: baseLat + 0.0006,
        lng: baseLng + 0.0008,
        icon: '🍃',
        completed: false,
        distanceMeters: 75,
      },
      {
        id: 'wp-dragon-2',
        name: 'Curved Twig Haven',
        category: 'Canopy',
        description: 'Search near fallen branches for a sturdy, curved dry twig.',
        audioPrompt: 'Pick up one curved twig about the length of your hand for the dragon spine.',
        lat: baseLat - 0.0005,
        lng: baseLng + 0.0007,
        icon: '🪵',
        completed: false,
        distanceMeters: 60,
      },
      {
        id: 'wp-dragon-3',
        name: 'Polished River Pebbles',
        category: 'Geo',
        description: 'Locate two smooth round pebbles on the path.',
        audioPrompt: 'Gather two smooth pebbles from the soil to serve as glowing dragon eyes.',
        lat: baseLat + 0.0003,
        lng: baseLng - 0.0009,
        icon: '🪨',
        completed: false,
        distanceMeters: 90,
      },
    ];

    setLocalWaypoints(initialWaypoints);
    setActiveWaypoint(initialWaypoints[0]);
  }, [telemetry.isGpsActive]);

  const handleWaypointCompleted = (id: string) => {
    setLocalWaypoints((prev) =>
      prev.map((wp) => (wp.id === id ? { ...wp, completed: true } : wp))
    );
    setTotalXp((prev) => prev + 150);
  };

  // Active Outdoor Mission
  const [activeMission, setActiveMission] = useState<GeneratedMission>({
    id: 'mission-dragon-default',
    title: 'The Forest Leaf Dragon',
    objective: 'Gather natural items and craft a miniature dragon on the soil.',
    audioScript:
      'Scan the ground around your feet. Find two broad fallen leaves, a sturdy twig, and two smooth pebbles. Assemble a forest dragon on the earth, then snap a photo for your Field Codex!',
    biome: 'Redwood & Oak Woodland',
    timeOfDay: 'Afternoon',
    scavengerItems: [
      '2x Broad Leaves (Wings)',
      '1x Curved Twig (Spine)',
      '2x River Pebbles (Eyes)',
    ],
    craftInstructions:
      'Lay the curved twig flat as the dragon spine. Place the two broad leaves on either side as wings. Crown the top with two pebbles as dragon eyes!',
    targetLandmark: 'Ancient Canopy Clearing',
    targetDistanceMeters: 180,
    targetBearingDegrees: 335,
    rewardXp: 350,
    stickerReward: {
      id: 'stk-dragon',
      name: 'Verdant Leaf Dragon',
      rarity: 'Mythic',
      badgeEmoji: '🐉',
      lore: 'A gentle woodland guardian crafted on the soil from autumn leaves and river pebbles.',
    },
  });

  const [isGeneratingMission, setIsGeneratingMission] = useState(false);
  const [isExpeditionStarted, setIsExpeditionStarted] = useState(true);

  const handleToggleExpedition = (forceStart?: boolean) => {
    hapticFeedback.startPlaying();
    const shouldStart = forceStart !== undefined ? forceStart : !isExpeditionStarted;
    movementTrackingService.setExpeditionActive(shouldStart);
    setIsExpeditionStarted(shouldStart);
    if (shouldStart) {
      ambientAudioService.start();
    }
  };

  const handleGenerateGeminiMission = async () => {
    setIsGeneratingMission(true);
    try {
      hapticFeedback.buttonPress();
      const newMission = await generateOutdoorMission({
        biome: activeMission.biome,
        timeOfDay: getCurrentTimeOfDay(),
        difficulty: 'Adventurer',
      });
      setActiveMission(newMission);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMission(false);
    }
  };

  const handleMissionCompleted = (photoDataUrl: string) => {
    hapticFeedback.missionCompleted();
    setIsPhotoModalOpen(false);
    setTotalXp((prev) => prev + activeMission.rewardXp);
    setCurrentLevel((prev) => Math.min(prev + 1, 7));

    const newSticker: StickerEntry = {
      id: `stk-${Date.now()}`,
      name: activeMission.stickerReward.name,
      badgeEmoji: activeMission.stickerReward.badgeEmoji,
      rarity: activeMission.stickerReward.rarity,
      category: 'craft',
      biome: activeMission.biome,
      dateUnlocked: 'Just Now',
      lore: activeMission.stickerReward.lore,
      ingredients: activeMission.scavengerItems,
      photoUrl: photoDataUrl,
      xpEarned: activeMission.rewardXp,
    };

    setUnlockedStickers((prev) => [newSticker, ...prev]);
    if (onOpenStickers) {
      onOpenStickers();
    } else {
      setIsStickerBookModalOpen(true);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 select-none font-['Plus_Jakarta_Sans',sans-serif]">
      {/* =========================================================================
          1. TIME-OF-DAY WELCOME BANNER (PROMINENT GREETING)
          ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-3xl bg-stone-100/95 border border-stone-300/80 shadow-[0_4px_0_0_#d6d3d1] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-800 uppercase tracking-wider">
            <span>{timeGreeting.emoji}</span>
            <span>{timeGreeting.periodLabel}</span>
            <span className="text-stone-400">·</span>
            <span className="text-stone-600 font-mono">{timeGreeting.clockTime}</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
            {timeGreeting.salutation},{' '}
            <span className="text-emerald-800 underline decoration-emerald-500/60 decoration-2 underline-offset-4">
              {explorerName.trim() ? explorerName : 'Explorer'}
            </span>
            !
          </h1>
          <p className="text-xs sm:text-sm font-mono text-stone-600 max-w-xl">
            {timeGreeting.subTitle}
          </p>
        </div>

        {/* Compact Right Dock: Progress + Small Audio Control */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Level & XP Capsule */}
          <div className="px-3 py-1.5 rounded-xl bg-stone-200/90 border border-stone-300 font-mono text-xs flex items-center gap-2 text-stone-800 shadow-xs">
            <span className="font-bold">Stage {currentLevel}/7</span>
            <span className="text-stone-400">·</span>
            <span className="font-bold text-emerald-800 tabular-nums">{totalXp} XP</span>
          </div>

          {/* Minimal Discreet Ambient Audio Toggle (Small & Unobtrusive) */}
          <button
            onClick={() => {
              hapticFeedback.tactileClick();
              ambientAudioService.togglePlay();
            }}
            title={audioState.isPlaying ? 'Mute ambient sound' : 'Play soothing ambient sound'}
            className="w-8 h-8 rounded-xl bg-stone-200/90 hover:bg-stone-300 active:bg-stone-400 text-stone-700 border border-stone-300 shadow-xs flex items-center justify-center cursor-pointer transition-colors"
          >
            {audioState.isPlaying && !audioState.isMuted ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-stone-400" />
            )}
          </button>

          {/* Pocket Mode Actuator */}
          <button
            onClick={onOpenPocketMode}
            className="px-3 py-1.5 rounded-xl bg-stone-200/90 hover:bg-stone-300 text-stone-800 font-mono text-xs font-bold border border-stone-300/80 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">POCKET</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. CORE MISSION EXPEDITION DECK: 3D CHARACTER + TACTICAL GOOGLE MAP
          Both the 3D Character and Map are prominently featured side-by-side!
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
        {/* Left Deck: 3D Character Viewport */}
        <div className="flex flex-col rounded-3xl overflow-hidden bg-stone-100/95 border border-stone-300/80 shadow-[0_4px_0_0_#d6d3d1]">
          {/* Card Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-300/70 bg-stone-200/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <h3 className="font-display font-extrabold text-sm sm:text-base text-stone-900 tracking-tight">
                3D Human Explorer Avatar
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-stone-600">
              <span className="px-2 py-0.5 rounded-md bg-stone-300/80 font-bold text-stone-800">
                {isWalking ? '🏃 WALKING' : '🛑 STATIONARY'}
              </span>
            </div>
          </div>

          {/* 3D WebGL Canvas */}
          <div className="relative w-full h-[320px] sm:h-[380px] bg-stone-200/40">
            <CharacterCanvas
              gender="male"
              isWalking={isWalking}
              gamePage="playing"
            />
          </div>

          {/* Card Footer */}
          <div className="p-3 bg-stone-200/50 border-t border-stone-300/70 flex items-center justify-between text-xs font-mono">
            <div className="text-stone-700 flex items-center gap-1.5">
              <span>Nicolás Martins Streetwear Avatar</span>
            </div>
            <button
              onClick={onBackToCharacterSelect}
              className="text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer"
            >
              Customizer ↗
            </button>
          </div>
        </div>

        {/* Right Deck: Tactical Google Map & Live GPS Radar */}
        <div className="flex flex-col rounded-3xl overflow-hidden bg-stone-100/95 border border-stone-300/80 shadow-[0_4px_0_0_#d6d3d1]">
          {/* Card Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-300/70 bg-stone-200/60">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-700" />
              <h3 className="font-display font-extrabold text-sm sm:text-base text-stone-900 tracking-tight">
                Tactical Google Map & GPS Radar
              </h3>
            </div>
            <button
              onClick={() => movementTrackingService.requestCurrentLocation()}
              className="px-2 py-0.5 rounded-md bg-emerald-800 text-stone-50 font-mono text-[10px] font-bold hover:bg-emerald-700 cursor-pointer"
            >
              REFRESH GPS
            </button>
          </div>

          {/* Google Map Layer */}
          <div className="relative w-full h-[320px] sm:h-[380px] bg-stone-900">
            <TacticalGoogleMap
              telemetry={telemetry}
              waypoints={liveWaypoints}
              activeWaypoint={activeWaypoint}
              onSelectWaypoint={setActiveWaypoint}
              explorerName={explorerName}
            />
          </div>

          {/* Card Footer */}
          <div className="p-3 bg-stone-200/50 border-t border-stone-300/70 flex items-center justify-between text-xs font-mono">
            <div className="text-stone-700 flex items-center gap-1.5 truncate">
              <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0 animate-pulse" />
              <span className="truncate">{telemetry.localityName || 'Outdoor Field Sector'}</span>
            </div>
            <span className="text-stone-500 shrink-0 tabular-nums">
              ±{Math.round(telemetry.accuracy || 5)}m GPS
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. CURRENT EXPEDITION MISSION TASK (PHYSICAL CRAFTING CARD)
          ========================================================================= */}
      <section className="p-4 sm:p-6 rounded-3xl bg-stone-100/95 border border-stone-300/80 shadow-[0_4px_0_0_#d6d3d1] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-300/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-stone-900 text-emerald-400 flex items-center justify-center font-bold text-lg shadow-sm">
              🎯
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 tracking-wider">
                CURRENT EXPEDITION OBJECTIVE
              </span>
              <h2 className="text-lg sm:text-2xl font-display font-extrabold text-stone-900 tracking-tight leading-tight">
                {activeMission.title}
              </h2>
            </div>
          </div>

          <button
            onClick={handleGenerateGeminiMission}
            disabled={isGeneratingMission}
            className="px-3 py-1.5 rounded-xl bg-stone-200/90 hover:bg-stone-300 text-stone-800 font-mono text-xs font-bold border border-stone-300 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-stone-600 ${isGeneratingMission ? 'animate-spin' : ''}`} />
            <span>{isGeneratingMission ? 'Generating...' : 'New Mission'}</span>
          </button>
        </div>

        {/* Objective */}
        <p className="text-xs sm:text-sm font-mono text-stone-800 font-medium leading-relaxed bg-stone-200/70 p-3 sm:p-3.5 rounded-2xl border border-stone-300/70">
          {activeMission.objective}
        </p>

        {/* Scavenger items grid */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-stone-500 uppercase font-semibold">
            Nature Ingredients to Collect:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {activeMission.scavengerItems.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-2xl bg-stone-200/90 border border-stone-300 flex items-center gap-2 text-xs font-mono font-medium text-stone-800"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                <span className="truncate">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reward & Craft Photo Button */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-800 bg-stone-200/80 px-3 py-2 rounded-xl border border-stone-300">
            <span className="text-base">{activeMission.stickerReward.badgeEmoji}</span>
            <span>+{activeMission.rewardXp} XP · {activeMission.stickerReward.name}</span>
          </div>

          <button
            onClick={() => {
              hapticFeedback.buttonPress();
              setIsPhotoModalOpen(true);
            }}
            className="py-3 px-5 rounded-2xl font-mono text-xs font-bold uppercase tracking-wider bg-stone-900 hover:bg-stone-800 text-stone-50 border-t border-stone-600 shadow-[0_4px_0_0_#0c0a09] active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>CRAFT ON SOIL & SNAP PHOTO</span>
          </button>
        </div>
      </section>

      {/* Modals */}
      {isPhotoModalOpen && (
        <PhotoScavengerModal
          mission={activeMission}
          onClose={() => setIsPhotoModalOpen(false)}
          onMissionCompleted={handleMissionCompleted}
        />
      )}

      {isStickerBookModalOpen && (
        <StickerBookModal
          onClose={() => setIsStickerBookModalOpen(false)}
          unlockedStickers={unlockedStickers}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { CharacterCanvas } from './components/CharacterCanvas';
import { MissionHUD } from './components/MissionHUD';
import { DailyChallengesView } from './components/DailyChallengesView';
import { StickerAlbumView } from './components/StickerAlbumView';
import { PocketModeHUD } from './components/PocketModeHUD';
import { NatureTopoBackground } from './components/NatureTopoBackground';
import { WelcomeIntroOverlay } from './components/WelcomeIntroOverlay';
import { StickerEntry } from './components/StickerBookModal';
import { BioCardsDeck } from './components/BioCardsDeck';
import { ArchitectureBlueprint } from './components/ArchitectureBlueprint';
import { TacticalGoogleMap } from './components/TacticalGoogleMap';
import { SoothingSoundtrackHUD } from './components/SoothingSoundtrackHUD';
import { CharacterGender, GamePage, LocalityWaypoint } from './types';
import { hapticFeedback } from './utils/haptics';
import { ambientAudioService } from './services/ambientAudioService';
import {
  movementTrackingService,
  MovementTelemetry,
} from './services/movementTrackingService';
import {
  DailyNatureChallenge,
  fetchDailyNatureChallenges
} from './services/geminiMissionService';
import { getCurrentGreeting } from './utils/timeGreeting';
import {
  ArrowRight,
  Smartphone,
  X,
  Compass,
  RotateCcw,
  Headphones,
  Sparkles,
  Award,
  BookOpen,
  Calendar,
  MapPin,
  LocateFixed,
  Radio,
  Layers,
  Cpu,
  Sunrise,
  Sunset,
  Sun,
  Moon,
  Volume2,
} from 'lucide-react';

export default function App() {
  // Navigation & Page State (Explorer, Mission, Daily Challenges, My Stickers, Bio Cards, Blueprint)
  const [currentPage, setCurrentPage] = useState<GamePage>('welcome');
  const [isPocketModalOpen, setIsPocketModalOpen] = useState(false);

  // Real-time GPS movement telemetry
  const [telemetry, setTelemetry] = useState<MovementTelemetry>(
    movementTrackingService.getTelemetry()
  );

  useEffect(() => {
    const unsub = movementTrackingService.subscribe((t) => {
      setTelemetry(t);
    });
    return () => unsub();
  }, []);

  // Waypoints for full-screen Tactical Google Map
  const [activeMapWaypoint, setActiveMapWaypoint] = useState<LocalityWaypoint | null>(null);
  const appWaypoints: LocalityWaypoint[] = React.useMemo(() => [
    {
      id: 'wp-app-1',
      name: 'Broad Fallen Leaves Cache',
      category: 'Botanical',
      description: 'Look beneath shaded oak or maple canopy for broad fallen leaves.',
      audioPrompt: 'Find two broad fallen leaves on the ground for your craft dragon wings.',
      lat: (telemetry.latitude || 37.7749) + 0.0006,
      lng: (telemetry.longitude || -122.4194) + 0.0008,
      icon: '🍃',
      completed: false,
      distanceMeters: 75,
    },
    {
      id: 'wp-app-2',
      name: 'Curved Twig Haven',
      category: 'Canopy',
      description: 'Search near fallen branches for a sturdy, curved dry twig.',
      audioPrompt: 'Pick up one curved twig about the length of your hand for the dragon spine.',
      lat: (telemetry.latitude || 37.7749) - 0.0005,
      lng: (telemetry.longitude || -122.4194) + 0.0007,
      icon: '🪵',
      completed: false,
      distanceMeters: 60,
    },
    {
      id: 'wp-app-3',
      name: 'Polished River Pebbles',
      category: 'Geo',
      description: 'Locate two smooth round pebbles on the path.',
      audioPrompt: 'Gather two smooth pebbles from the soil to serve as glowing dragon eyes.',
      lat: (telemetry.latitude || 37.7749) + 0.0003,
      lng: (telemetry.longitude || -122.4194) - 0.0009,
      icon: '🪨',
      completed: false,
      distanceMeters: 90,
    },
  ], [telemetry.latitude, telemetry.longitude]);

  // Welcome Intro Preloader
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(true);
  const [introAnimated, setIntroAnimated] = useState(false);

  // Character Customization State
  const [selectedGender] = useState<CharacterGender>('male');
  const [explorerName, setExplorerName] = useState<string>('Ranger_01');

  // Welcome Time-of-Day Dynamic Greeting directly synced with real local time
  const [greetingInfo, setGreetingInfo] = useState(() => getCurrentGreeting());

  useEffect(() => {
    const timer = setInterval(() => {
      setGreetingInfo(getCurrentGreeting());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Gameplay movement state
  const [isWalking, setIsWalking] = useState(false);

  // Progression & Score State
  const [currentLevel, setCurrentLevel] = useState(3);
  const [totalXp, setTotalXp] = useState(850);

  // Daily Nature Challenges State
  const [dailyChallenges, setDailyChallenges] = useState<DailyNatureChallenge[]>([
    {
      id: 'daily-leaf-default',
      title: 'Find 2 Broad Leaves',
      description: 'Scan beneath mature canopy trees for two intact leaves with clear veining.',
      category: 'Flora',
      icon: '🍃',
      difficulty: 'Quick',
      xpReward: 100,
      completed: true,
    },
    {
      id: 'daily-bird-default',
      title: 'Identify a Local Bird',
      description: 'Stop silently for 60 seconds and locate a wild bird in the branches. Note its song.',
      category: 'Fauna',
      icon: '🐦',
      difficulty: 'Explorer',
      xpReward: 150,
      completed: false,
    },
    {
      id: 'daily-bark-default',
      title: 'Inspect Tree Bark Texture',
      description: 'Feel the ridges and fissures of a tree trunk and check for green moss or velvet lichen.',
      category: 'Tactile',
      icon: '🪵',
      difficulty: 'Tracker',
      xpReward: 125,
      completed: false,
    },
  ]);
  const [isFetchingChallenges, setIsFetchingChallenges] = useState(false);

  // Field Sticker Codex State
  const [unlockedStickers, setUnlockedStickers] = useState<StickerEntry[]>([
    {
      id: 'stk-dragon',
      name: 'Verdant Leaf Dragon',
      badgeEmoji: '🐉',
      rarity: 'Mythic',
      category: 'craft',
      biome: 'Oak & Redwood Woodland',
      dateUnlocked: 'Stage 1 Complete',
      lore: 'A gentle woodland guardian crafted on the soil from fallen autumn leaves and river pebbles.',
      ingredients: ['2x Fallen Leaves (Wings)', '1x Curved Twig (Spine)', '2x River Pebbles (Eyes)'],
      xpEarned: 350,
    },
    {
      id: 'stk-turtle',
      name: 'Moss Pebble Turtle',
      badgeEmoji: '🐢',
      rarity: 'Rare',
      category: 'craft',
      biome: 'Riparian Creek',
      dateUnlocked: 'Stage 2 Complete',
      lore: 'Sculpted from river stones and damp moss fronds. Absorbs cool mountain water currents.',
      ingredients: ['1x Flat Palm Stone', '4x Small Pebbles', '1x Moss Frond'],
      xpEarned: 300,
    },
  ]);

  const handleWelcomeComplete = () => {
    setShowWelcomeIntro(false);
    setTimeout(() => {
      setIntroAnimated(true);
    }, 100);
  };

  const handleReplayIntro = () => {
    setIntroAnimated(false);
    setShowWelcomeIntro(true);
  };

  const handleToggleDailyChallenge = (challengeId: string) => {
    setDailyChallenges((prev) =>
      prev.map((c) => {
        if (c.id === challengeId) {
          const nextState = !c.completed;
          if (nextState) {
            hapticFeedback.challengeCompleted();
            setTotalXp((xp) => xp + c.xpReward);
          } else {
            hapticFeedback.tactileClick();
            setTotalXp((xp) => Math.max(0, xp - c.xpReward));
          }
          return { ...c, completed: nextState };
        }
        return c;
      })
    );
  };

  const handleRefreshChallenges = async () => {
    setIsFetchingChallenges(true);
    try {
      const fresh = await fetchDailyNatureChallenges({
        biome: 'Oak Woodland',
        timeOfDay: 'Afternoon',
      });
      setDailyChallenges(fresh);
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
    } finally {
      setIsFetchingChallenges(false);
    }
  };

  const completedChallengesCount = dailyChallenges.filter((c) => c.completed).length;

  return (
    <div className="relative min-h-screen bg-[#ebeae5] text-stone-900 selection:bg-stone-900 selection:text-stone-50 font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
      {/* RICARDO CHANCE STYLE WELCOME PRELOADER */}
      {showWelcomeIntro && (
        <WelcomeIntroOverlay
          onComplete={handleWelcomeComplete}
          appName="ECOQUEST"
          tagline="BIO-ACOUSTIC EXPEDITION ENGINE"
        />
      )}

      {/* NATURE TOPOGRAPHICAL BACKGROUND */}
      <NatureTopoBackground />

      {/* =========================================================================
          TOP BAR: STRICT 3-ZONE LAYOUT (BRAND · UNIFIED NAV BAR · ACTION)
          Now features seamless direct navigation for:
          01. EXPLORER | 02. MISSION | 03. DAILY CHALLENGES | 04. MY STICKERS
          ========================================================================= */}
      <header className="relative z-40 sticky top-0 bg-[#ebeae5]/90 backdrop-blur-md border-b border-stone-300/80 shadow-xs select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Wordmark */}
          <div
            onClick={() => {
              hapticFeedback.tactileClick();
              setCurrentPage('welcome');
            }}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-emerald-400 flex items-center justify-center font-display font-black text-sm shadow-xs group-hover:bg-emerald-950 transition-colors">
              EQ
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-base tracking-tight text-stone-900 leading-tight">
                ECOQUEST
              </span>
              <span className="text-[9px] font-mono font-bold text-emerald-800 tracking-wider uppercase">
                AI FIELD OPS
              </span>
            </div>
          </div>

          {/* Zone 2: Proper Clean Aligned Navigation Bar */}
          <nav className="flex items-center gap-1 p-1 bg-stone-200/90 rounded-2xl text-xs font-mono border border-stone-300/80 shadow-inner overflow-x-auto max-w-[calc(100vw-220px)] sm:max-w-none">
            {/* 01. EXPLORER (Character Selection & Setup) */}
            <button
              onClick={() => {
                hapticFeedback.tactileClick();
                setCurrentPage('welcome');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                currentPage === 'welcome'
                  ? 'bg-stone-900 text-stone-50 shadow-xs'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300/60'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-emerald-500" />
              <span>EXPLORER</span>
            </button>

            {/* 02. MISSION (Active 3D Character & Tactical Map) */}
            <button
              onClick={() => {
                hapticFeedback.tactileClick();
                setCurrentPage('playing');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                currentPage === 'playing'
                  ? 'bg-stone-900 text-stone-50 shadow-xs'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span>MISSION</span>
            </button>

            {/* 03. DAILY CHALLENGES */}
            <button
              onClick={() => {
                hapticFeedback.tactileClick();
                setCurrentPage('challenges');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                currentPage === 'challenges'
                  ? 'bg-stone-900 text-stone-50 shadow-xs'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300/60'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>CHALLENGES</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                  currentPage === 'challenges'
                    ? 'bg-emerald-400 text-stone-950'
                    : 'bg-stone-300/90 text-stone-800'
                }`}
              >
                {completedChallengesCount}/{dailyChallenges.length}
              </span>
            </button>

            {/* 04. MY STICKERS */}
            <button
              onClick={() => {
                hapticFeedback.tactileClick();
                setCurrentPage('stickers');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                currentPage === 'stickers'
                  ? 'bg-stone-900 text-stone-50 shadow-xs'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-500" />
              <span>STICKERS</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                  currentPage === 'stickers'
                    ? 'bg-amber-400 text-stone-950'
                    : 'bg-stone-300/90 text-stone-800'
                }`}
              >
                {unlockedStickers.length}
              </span>
            </button>

            {/* 05. BIO CARDS */}
            <button
              onClick={() => {
                hapticFeedback.tactileClick();
                setCurrentPage('biocards');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                currentPage === 'biocards'
                  ? 'bg-stone-900 text-stone-50 shadow-xs'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>BIO CARDS</span>
            </button>

            {/* 06. BLUEPRINT */}
            <button
              onClick={() => {
                hapticFeedback.tactileClick();
                setCurrentPage('blueprint');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                currentPage === 'blueprint'
                  ? 'bg-stone-900 text-stone-50 shadow-xs'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300/60'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-purple-600" />
              <span>BLUEPRINT</span>
            </button>
          </nav>

          {/* Zone 3: Clean Aligned Utility Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <SoothingSoundtrackHUD />

            <button
              onClick={handleReplayIntro}
              title="Replay Welcome Intro Animation"
              className="h-9 px-2.5 bg-stone-200/90 hover:bg-stone-300 text-stone-700 text-xs font-mono font-bold rounded-xl transition-colors border border-stone-300 shadow-xs cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden xl:inline text-[11px]">INTRO</span>
            </button>

            <button
              onClick={() => {
                hapticFeedback.tactileClick();
                setIsPocketModalOpen(true);
              }}
              title="Open AMOLED Pocket Mode"
              className="h-9 px-3 bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-mono font-bold rounded-xl transition-colors border-t border-stone-700/40 shadow-xs active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">POCKET</span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          PAGE 1: WELCOME & CHARACTER SELECT (THE USER'S BELOVED PAGE)
          ========================================================================= */}
      {currentPage === 'welcome' && (
        <main className="relative z-10 min-h-[calc(100vh-69px)] flex flex-col justify-between p-4 sm:p-8 lg:p-12">
          {/* Typographic Intro with Dynamic Time-of-Day Welcome Greeting */}
          <div className="max-w-3xl mx-auto text-center space-y-3 select-none">
            {/* Dynamic Real-Time Banner Pill */}
            <div
              className={`inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-2xl bg-stone-200/90 border border-stone-300 shadow-sm text-xs font-mono transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                introAnimated ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              <div className="flex items-center gap-1.5 text-stone-800 font-bold">
                <span className="text-base select-none">{greetingInfo.emoji}</span>
                <span className="tracking-wider uppercase text-[11px] font-bold text-emerald-800">
                  {greetingInfo.periodLabel}
                </span>
              </div>
              <span className="text-stone-400">·</span>
              <span className="text-stone-600 font-mono text-[11px] font-bold">{greetingInfo.clockTime}</span>
            </div>

            {/* Dynamic Salutation Heading */}
            <div className="overflow-hidden">
              <div
                className={`font-mono text-sm sm:text-base md:text-lg font-bold text-emerald-800 uppercase tracking-wider transition-all duration-700 delay-100 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  introAnimated ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                }`}
              >
                {greetingInfo.emoji} {greetingInfo.salutation},{' '}
                <span className="text-stone-900 underline decoration-emerald-500 decoration-2 underline-offset-4">
                  {explorerName.trim() ? explorerName : 'Explorer'}
                </span>
                !
              </div>

              <h1
                className={`text-3xl sm:text-5xl lg:text-7xl font-display font-extrabold text-stone-900 tracking-tight leading-[1.05] mt-1 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  introAnimated
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-full opacity-0'
                }`}
              >
                Welcome to Ecoquest
              </h1>
            </div>

            <div className="overflow-hidden">
              <p
                className={`text-xs sm:text-sm md:text-base font-mono text-stone-600 max-w-2xl mx-auto transition-all duration-700 delay-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  introAnimated
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-full opacity-0'
                }`}
              >
                {greetingInfo.subTitle}. Outdoor nature expedition with authentic 3D human explorer, real-time Google Maps tactical radar, and physical soil crafting.
              </p>
            </div>
          </div>

          {/* Explorer Avatar Status Badge (Male Nicolás 3D Only) */}
          <div className="w-full max-w-md mx-auto my-2 z-20 px-2">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-stone-200/90 backdrop-blur-md rounded-2xl border border-stone-300 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-900 text-emerald-400 flex items-center justify-center font-black text-sm shadow-xs">
                  ♂
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-stone-900 tracking-wide">
                    3D HUMAN EXPLORER
                  </div>
                  <div className="text-[11px] font-mono text-stone-600">
                    Nicolás Martins · Authentic Rigged Avatar
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-800 text-stone-50 text-[10px] font-mono font-bold uppercase tracking-wider">
                READY
              </span>
            </div>
          </div>

          {/* 3D Character Viewport Stage */}
          <div className="relative w-full max-w-4xl h-[380px] sm:h-[450px] lg:h-[520px] mx-auto my-1 sm:my-2 flex items-center justify-center">
            {/* Centered 3D WebGL Canvas */}
            <div className="w-full h-full">
              <CharacterCanvas
                gender="male"
                isWalking={false}
                gamePage="welcome"
              />
            </div>
          </div>

          {/* Bottom Explorer Deck & Launch Actuator */}
          <div
            className={`max-w-md w-full mx-auto space-y-3 pt-2 transition-all duration-700 delay-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              introAnimated ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            <div className="flex items-center gap-2 p-1.5 bg-stone-200/80 rounded-xl border border-stone-300 shadow-inner">
              <span className="pl-3 text-xs font-mono text-stone-500 uppercase font-semibold">CODENAME:</span>
              <input
                type="text"
                value={explorerName}
                onChange={(e) => setExplorerName(e.target.value)}
                placeholder="Enter explorer name..."
                className="flex-1 bg-transparent text-sm font-mono font-bold text-stone-900 outline-none px-2"
              />
            </div>

            {/* Launch Game Actuator */}
            <button
              onClick={() => {
                hapticFeedback.startPlaying();
                setCurrentPage('playing');
                ambientAudioService.start();
              }}
              className="relative w-full py-3.5 sm:py-4 px-6 bg-stone-900 hover:bg-stone-800 active:bg-stone-900 text-stone-50 font-display font-bold text-base rounded-2xl transition-all border-t border-stone-600/50 shadow-[0_6px_0_0_#0c0a09] active:shadow-[0_1px_0_0_#0c0a09] active:translate-y-1.5 flex items-center justify-center gap-3 cursor-pointer group"
            >
              <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>START PLAYING · ENTER EXPEDITION</span>
              <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform ml-auto" />
            </button>

            {/* Direct Daily Challenges Actuator */}
            <button
              onClick={() => {
                hapticFeedback.tactileClick();
                setCurrentPage('challenges');
              }}
              className="w-full py-3 px-5 bg-stone-200/90 hover:bg-stone-300 text-stone-900 font-mono text-xs font-bold rounded-2xl transition-all border border-stone-300 shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>VIEW DAILY NATURE CHALLENGES ({completedChallengesCount}/{dailyChallenges.length})</span>
            </button>
            {/* Direct Feature Launchers Grid (Weather Removed) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => {
                  hapticFeedback.tactileClick();
                  setCurrentPage('playing');
                }}
                className="p-2.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 text-stone-800 font-mono text-[11px] font-bold border border-stone-300 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Compass className="w-4 h-4 text-emerald-700" />
                <span>Mission & Map</span>
              </button>

              <button
                onClick={() => {
                  hapticFeedback.tactileClick();
                  setCurrentPage('biocards');
                }}
                className="p-2.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 text-stone-800 font-mono text-[11px] font-bold border border-stone-300 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Bio Cards</span>
              </button>

              <button
                onClick={() => {
                  hapticFeedback.tactileClick();
                  setCurrentPage('blueprint');
                }}
                className="p-2.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 text-stone-800 font-mono text-[11px] font-bold border border-stone-300 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Cpu className="w-4 h-4 text-purple-700" />
                <span>Blueprint</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* =========================================================================
          PAGE 2: PLAYING GAME (MISSION HUD WITH BOTH 3D CHARACTER & GOOGLE MAP)
          ========================================================================= */}
      {currentPage === 'playing' && (
        <main className="relative z-10 min-h-[calc(100vh-69px)]">
          <MissionHUD
            explorerName={explorerName}
            isWalking={isWalking}
            setIsWalking={setIsWalking}
            onOpenPocketMode={() => setIsPocketModalOpen(true)}
            onBackToCharacterSelect={() => setCurrentPage('welcome')}
            onOpenDailyChallenges={() => setCurrentPage('challenges')}
            onOpenStickers={() => setCurrentPage('stickers')}
            onOpenBioCards={() => setCurrentPage('biocards')}
            onOpenBlueprint={() => setCurrentPage('blueprint')}
            unlockedStickers={unlockedStickers}
            setUnlockedStickers={setUnlockedStickers}
            currentLevel={currentLevel}
            setCurrentLevel={setCurrentLevel}
            totalXp={totalXp}
            setTotalXp={setTotalXp}
            dailyChallenges={dailyChallenges}
          />
        </main>
      )}

      {/* =========================================================================
          PAGE 3: DAILY CHALLENGES (DEDICATED FULL VIEW)
          ========================================================================= */}
      {currentPage === 'challenges' && (
        <main className="relative z-10 min-h-[calc(100vh-69px)]">
          <DailyChallengesView
            challenges={dailyChallenges}
            onToggleChallenge={handleToggleDailyChallenge}
            onRefreshChallenges={handleRefreshChallenges}
            isRefreshing={isFetchingChallenges}
            onStartMission={() => setCurrentPage('playing')}
            selectedBiome="Redwood & Oak Woodland"
            totalXp={totalXp}
          />
        </main>
      )}

      {/* =========================================================================
          PAGE 4: MY FIELD STICKERS (DEDICATED FULL VIEW)
          ========================================================================= */}
      {currentPage === 'stickers' && (
        <main className="relative z-10 min-h-[calc(100vh-69px)]">
          <StickerAlbumView
            unlockedStickers={unlockedStickers}
            onStartMission={() => setCurrentPage('playing')}
          />
        </main>
      )}

      {/* =========================================================================
          PAGE 5: ECOSYSTEM BIO CARDS & 3D PET COMPANION DECK
          ========================================================================= */}
      {currentPage === 'biocards' && (
        <main className="relative z-10 min-h-[calc(100vh-69px)] py-6 px-3 sm:px-6 max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-300">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 tracking-wider">
                BIOLOGICAL ARTIFACT CODEX
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900">
                Ecosystem Specimen Deck & Pet Companion
              </h2>
            </div>
            <button
              onClick={() => setCurrentPage('playing')}
              className="px-3.5 py-1.5 rounded-xl bg-stone-900 text-stone-50 font-mono text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>TO MISSION</span>
            </button>
          </div>
          <BioCardsDeck onStartMission={() => setCurrentPage('playing')} />
        </main>
      )}


      {/* =========================================================================
          PAGE 7: SYSTEM ARCHITECTURE & SPATIAL AUDIO BLUEPRINT
          ========================================================================= */}
      {currentPage === 'blueprint' && (
        <main className="relative z-10 min-h-[calc(100vh-69px)] py-6 px-3 sm:px-6 max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-300">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-purple-800 tracking-wider">
                ENGINEERING SPECIFICATIONS
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900">
                System Blueprint & Spatial Audio Compass
              </h2>
            </div>
            <button
              onClick={() => setCurrentPage('playing')}
              className="px-3.5 py-1.5 rounded-xl bg-stone-900 text-stone-50 font-mono text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>TO MISSION</span>
            </button>
          </div>
          <ArchitectureBlueprint />
        </main>
      )}

      {/* =========================================================================
          PAGE 8: FULL TACTICAL GOOGLE MAP & REAL-WORLD SATELLITE RADAR
          ========================================================================= */}
      {currentPage === 'map' && (
        <main className="relative z-10 min-h-[calc(100vh-69px)] py-6 px-3 sm:px-6 max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-300">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 tracking-wider">
                TACTICAL RADAR · GOOGLE MAPS PLATFORM
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900">
                Satellite Field Radar & Waypoints
              </h2>
            </div>
            <button
              onClick={() => setCurrentPage('playing')}
              className="px-3.5 py-1.5 rounded-xl bg-stone-900 text-stone-50 font-mono text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>TO MISSION</span>
            </button>
          </div>

          <TacticalGoogleMap
            telemetry={telemetry}
            waypoints={appWaypoints}
            activeWaypoint={activeMapWaypoint}
            onSelectWaypoint={setActiveMapWaypoint}
            explorerName={explorerName}
          />
        </main>
      )}

      {/* FULLSCREEN OLED POCKET MODE MODAL */}
      {isPocketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-black border border-white/20 shadow-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2 font-mono text-sm text-white font-bold">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>OLED POCKET MODE SIMULATOR</span>
              </div>
              <button
                onClick={() => setIsPocketModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <PocketModeHUD isFullScreen={true} onClose={() => setIsPocketModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ArrowRight,
  Bot,
  Check,
  Crosshair,
  Flame,
  Link2,
  Play,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AVATAR_OPTIONS,
  MINIGAME_META,
  TURN_TAKE_ASSETS,
} from '@/lib/game/assets';
import type {
  AvatarId,
  BotDifficulty,
  GameMode,
  MinigameId,
  MinigameSelection,
  OpponentType,
} from '@/lib/game/types';
import { TurnTakeLogo } from './TurnTakeLogo';

interface LobbyScreenProps {
  publicLeaderboard: boolean;
  onPublicLeaderboardChange: (value:boolean)=>void;
  inviteCode?: string|null;
  playerName: string;
  playerAvatar: AvatarId;
  opponentType: Exclude<OpponentType, 'room'>;
  botDifficulty: BotDifficulty;
  minigameSelection: MinigameSelection;
  muted: boolean;
  roomError: string | null;
  roomBusy: boolean;
  onPlayerNameChange: (name: string) => void;
  onPlayerAvatarChange: (avatar: AvatarId) => void;
  onOpponentTypeChange: (type: Exclude<OpponentType, 'room'>) => void;
  onBotDifficultyChange: (difficulty: BotDifficulty) => void;
  onMinigameSelectionChange: (selection: MinigameSelection) => void;
  onToggleMute: () => void;
  onStartClassic: () => void;
  onStartClash: () => void;
  onCreateRoom: (mode: GameMode) => void;
  onJoinRoom: (code: string) => void;
  onOpenLeaderboard: () => void;
}

const MINIGAME_ORDER: MinigameId[] = [
  'perfect-timing',
  'flash-memory',
  'target-rush',
];

function updateCardSpotlight(e: React.PointerEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
  const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
  e.currentTarget.style.setProperty('--mx', `${x.toFixed(1)}%`);
  e.currentTarget.style.setProperty('--my', `${y.toFixed(1)}%`);
}

function MinigameHoverBadge({
  id,
  active,
}: {
  id: MinigameId;
  active: boolean;
}) {
  if (id === 'perfect-timing') {
    return (
      <div
        aria-hidden="true"
        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-[#10141D]/85 border border-[#FFDA79]/40 flex items-center justify-center pointer-events-none"
      >
        <div
          className={[
            'w-4 h-4 rounded-full border-2 border-[#43DDE6]/35 border-t-[#FFDA79] transition-transform duration-300 ease-out',
            active
              ? 'rotate-[135deg]'
              : 'group-hover:rotate-[135deg]',
          ].join(' ')}
        />
      </div>
    );
  }

  if (id === 'flash-memory') {
    const litCells = new Set([0, 4, 8, 2]);
    return (
      <div
        aria-hidden="true"
        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-[#10141D]/85 border border-[#8B7CFF]/45 p-1 grid grid-cols-3 gap-0.5 pointer-events-none"
      >
        {Array.from({ length: 9 }).map((_, idx) => (
          <span
            key={idx}
            style={{ transitionDelay: `${(idx % 4) * 35}ms` }}
            className={[
              'rounded-[2px] transition-colors duration-200',
              litCells.has(idx)
                ? active
                  ? 'bg-[#43DDE6]'
                  : 'bg-[#8B7CFF]/70 group-hover:bg-[#43DDE6]'
                : 'bg-[#65737C]/25',
            ].join(' ')}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-[#10141D]/85 border border-[#FF795E]/45 flex items-center justify-center pointer-events-none"
    >
      <Crosshair
        className={[
          'w-4 h-4 text-[#FF795E] transition-transform duration-200 ease-out',
          active
            ? 'scale-110 rotate-45 text-[#FFDA79]'
            : 'group-hover:scale-110 group-hover:rotate-45 group-hover:text-[#FFDA79]',
        ].join(' ')}
      />
    </div>
  );
}

export function LobbyScreen({
  publicLeaderboard,onPublicLeaderboardChange,inviteCode,
  playerName,
  playerAvatar,
  opponentType,
  botDifficulty,
  minigameSelection,
  muted,
  roomError,
  roomBusy,
  onPlayerNameChange,
  onPlayerAvatarChange,
  onOpponentTypeChange,
  onBotDifficultyChange,
  onMinigameSelectionChange,
  onToggleMute,
  onStartClassic,
  onStartClash,
  onCreateRoom,
  onJoinRoom,
  onOpenLeaderboard,
}: LobbyScreenProps) {
  const [joinCode, setJoinCode] = useState('');
  const lobbyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = lobbyRef.current;
    if (!root) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out', duration: 0.45 },
      });

      tl.from('[data-gsap="header"]', {
        y: -14,
        clipPath: 'inset(0% 0% 100% 0%)',
        clearProps: 'clipPath,transform',
      })
        .from(
          '[data-gsap="tagline"]',
          {
            y: 10,
            clipPath: 'inset(0% 100% 0% 0%)',
            duration: 0.4,
            clearProps: 'clipPath,transform',
          },
          '-=0.25'
        )
        .from(
          '[data-gsap="profile"]',
          {
            y: 14,
            scale: 0.985,
            clipPath: 'inset(0% 0% 100% 0%)',
            duration: 0.38,
            clearProps: 'clipPath,transform',
          },
          '-=0.24'
        )
        .from(
          '[data-gsap="classic-card"]',
          {
            y: 20,
            scale: 0.98,
            clipPath: 'inset(12% 0% 0% 0%)',
            duration: 0.44,
            clearProps: 'clipPath,transform',
          },
          '-=0.22'
        )
        .from(
          ['[data-gsap="clash-card"]', '[data-gsap="room-card"]'],
          {
            y: 22,
            scale: 0.975,
            clipPath: 'inset(12% 0% 0% 0%)',
            stagger: 0.08,
            duration: 0.44,
            clearProps: 'clipPath,transform',
          },
          '-=0.28'
        )
        .from(
          '[data-gsap="minigame-card"]',
          {
            y: 12,
            scale: 0.95,
            stagger: 0.05,
            duration: 0.34,
            clearProps: 'transform',
          },
          '-=0.28'
        )
        .from(
          '[data-gsap="cta"]',
          {
            y: 8,
            scale: 0.96,
            stagger: 0.06,
            duration: 0.3,
            clearProps: 'transform',
          },
          '-=0.26'
        )
        .from(
          '[data-gsap="hint"]',
          {
            y: 6,
            opacity: 0,
            duration: 0.25,
            clearProps: 'opacity,transform',
          },
          '-=0.16'
        );
    }, lobbyRef);

    return () => ctx.revert();
  }, []);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase());
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#10141D]">
      {/* Independent Full-Bleed Lobby Key Art Backdrop */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <img
          src={TURN_TAKE_ASSETS.lobbyBackground}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#10141D]/75 via-[#10141D]/58 to-[#10141D]/92" />

        {/* Peripheral Non-Interactive Ornaments (desktop wide margins only) */}
        <img
          src={TURN_TAKE_ASSETS.ornaments.concentricDial}
          alt=""
          referrerPolicy="no-referrer"
          className="hidden xl:block absolute -left-24 top-1/3 w-72 h-72 object-contain opacity-[0.14] orbit-slow-spin"
        />
        <img
          src={TURN_TAKE_ASSETS.ornaments.telemetryRibbons}
          alt=""
          referrerPolicy="no-referrer"
          className="hidden xl:block absolute -right-16 bottom-10 w-72 h-72 object-contain opacity-[0.12]"
        />
      </div>

      {/* Main Content Container (~1180px desktop presence) */}
      <main
        ref={lobbyRef}
        suppressHydrationWarning
        className="relative z-10 max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col gap-4"
      >
        {/* Top Brand & Utility Strip */}
        <div
          data-gsap="header"
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <TurnTakeLogo size="lg" />

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium bg-[#151B28]/90 text-[#F4F4F0] border border-[#65737C]/40 hover:border-[#FFDA79]/70 hover:bg-[#1B2334] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDA79] focus-visible:ring-offset-2 focus-visible:ring-offset-[#10141D]"
            >
              <Trophy className="w-4 h-4 text-[#FFDA79]" />
              Leaderboard
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2.5 rounded-xl bg-[#151B28]/90 text-[#F4F4F0] border border-[#65737C]/40 hover:border-[#43DDE6]/65 hover:bg-[#1B2334] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#10141D]"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-[#94A3B8]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#43DDE6]" />
              )}
            </button>
          </div>
        </div>

        <p
          data-gsap="tagline"
          className="text-sm sm:text-base leading-relaxed text-[#CBD5E1] max-w-2xl"
        >
          Classic 3×3 pure tactics or head-to-head Clash minigames where two
          consecutive round wins unlock bonus board placements.
        </p>

        {/* Player Identity Bar */}
        <section
          data-gsap="profile"
          suppressHydrationWarning
          aria-label="Player Profile"
          className="rounded-2xl bg-[#141A26]/92 border border-[#65737C]/35 px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3.5">
            <label
              htmlFor="player-name-input"
              className="text-sm font-medium text-[#94A3B8] whitespace-nowrap"
            >
              Player Name
            </label>
            <input
              id="player-name-input"
              type="text"
              maxLength={18}
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              placeholder="Player X"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore="true"
              data-protonpass-ignore="true"
              suppressHydrationWarning
              className="w-full sm:w-56 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#10141D] border border-[#65737C]/40 text-sm sm:text-[15px] font-medium text-[#F4F4F0] placeholder:text-[#65737C] focus-visible:outline-none focus-visible:border-[#43DDE6] focus-visible:ring-2 focus-visible:ring-[#43DDE6]/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <span className="text-sm font-medium text-[#94A3B8] mr-0.5 sm:mr-1">
              Avatar
            </span>
            {AVATAR_OPTIONS.map((avatar) => {
              const selected = playerAvatar === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => onPlayerAvatarChange(avatar.id)}
                  aria-label={`Select avatar ${avatar.label}`}
                  aria-pressed={selected}
                  title={avatar.label}
                  className={[
                    'relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl p-1 border transition-all duration-150 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141A26]',
                    selected
                      ? 'bg-[#1D2638] border-[#43DDE6] scale-105 shadow-[0_0_0_1px_rgba(67,221,230,0.35)]'
                      : 'bg-[#10141D]/85 border-[#65737C]/30 hover:border-[#F4F4F0]/55',
                  ].join(' ')}
                >
                  <img
                    src={avatar.src}
                    alt={avatar.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </button>
              );
            })}
          </div>
        </section>

        {/* Primary Classic Mode Card */}
        <section
          data-gsap="classic-card"
          aria-label="Classic Mode"
          onPointerMove={updateCardSpotlight}
          style={
            {
              '--spotlight-color': 'rgba(67, 221, 230, 0.14)',
            } as React.CSSProperties
          }
          className="arcade-card-spotlight rounded-3xl bg-[#151C2A]/95 border border-[#43DDE6]/35 hover:border-[#43DDE6]/70 p-4 sm:p-5 lg:px-6 lg:py-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] overflow-hidden"
        >
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 lg:gap-8">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#43DDE6]">
                <span>Primary Mode</span>
                <span aria-hidden="true">·</span>
                <span>3×3 Pure Strategy</span>
              </div>
              <h2 className="font-display text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#F4F4F0]">
                Classic Mode
              </h2>
              <p className="text-sm sm:text-[15px] leading-relaxed text-[#CBD5E1]">
                Traditional alternating turns on the 3×3 grid. Challenge the
                adaptive AI bot across three skill tiers or pass and play
                locally.
              </p>

              {/* Controls: Opponent & Difficulty */}
              <div className="flex flex-wrap items-center gap-3 pt-1.5">
                <div
                  role="group"
                  aria-label="Opponent type"
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10141D] border border-[#65737C]/30"
                >
                  <button
                    type="button"
                    onClick={() => onOpponentTypeChange('bot')}
                    className={[
                      'inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]',
                      opponentType === 'bot'
                        ? 'bg-[#43DDE6] text-[#10141D] font-semibold'
                        : 'text-[#CBD5E1] hover:text-[#F4F4F0]',
                    ].join(' ')}
                  >
                    <Bot className="w-4 h-4" />
                    Vs. Bot
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpponentTypeChange('local')}
                    className={[
                      'inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]',
                      opponentType === 'local'
                        ? 'bg-[#43DDE6] text-[#10141D] font-semibold'
                        : 'text-[#CBD5E1] hover:text-[#F4F4F0]',
                    ].join(' ')}
                  >
                    <Users className="w-4 h-4" />
                    Local 2P
                  </button>
                </div>

                {opponentType === 'bot' && (
                  <div
                    role="group"
                    aria-label="Bot difficulty"
                    className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10141D] border border-[#65737C]/30"
                  >
                    {(['casual', 'tactical', 'master'] as BotDifficulty[]).map(
                      (diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => onBotDifficultyChange(diff)}
                          className={[
                            'min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium capitalize transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]',
                            botDifficulty === diff
                              ? 'bg-[#1F293D] text-[#43DDE6] border border-[#43DDE6]/50'
                              : 'text-[#CBD5E1] hover:text-[#F4F4F0]',
                          ].join(' ')}
                        >
                          {diff}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            <div data-gsap="cta" className="shrink-0">
              <button
                type="button"
                data-start="true"
                data-testid="play-classic-btn"
                onClick={onStartClassic}
                className="btn-arcade-sheen w-full lg:w-auto inline-flex items-center justify-center gap-2.5 min-h-[52px] px-8 py-3.5 rounded-2xl font-display font-bold text-base bg-[#43DDE6] text-[#10141D] hover:bg-[#62e6ed] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-[0_12px_30px_rgba(67,221,230,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151C2A]"
              >
                <Play className="w-5 h-5 fill-current" />
                Play Classic
              </button>
            </div>
          </div>
        </section>

        {/* Secondary Grid: Elevated Signature Clash Mode + Private Invite Rooms */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
          {/* Signature Clash Mode Panel */}
          <section
            data-gsap="clash-card"
            aria-label="Clash Mode"
            onPointerMove={updateCardSpotlight}
            style={
              {
                '--spotlight-color': 'rgba(255, 121, 94, 0.16)',
              } as React.CSSProperties
            }
            className="arcade-card-spotlight lg:col-span-7 rounded-3xl bg-gradient-to-br from-[#171F30]/96 via-[#151C2A]/95 to-[#1B1D2D]/95 border border-[#FF795E]/40 hover:border-[#43DDE6]/65 p-4 sm:p-5 flex flex-col justify-between gap-4 overflow-hidden shadow-[0_22px_55px_rgba(0,0,0,0.48)]"
          >
            {/* Subtle Animated Cyan/Coral Top & Bottom Edge Highlights */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
            >
              <div className="clash-edge-sheen h-full w-1/2" />
            </div>

            {/* Subtle Ornamental Clash Diamond Accent (non-overlapping) */}
            <img
              src={TURN_TAKE_ASSETS.ornaments.clashDiamond}
              alt=""
              referrerPolicy="no-referrer"
              aria-hidden="true"
              className="pointer-events-none hidden sm:block absolute -top-10 -right-10 w-40 h-40 object-contain opacity-[0.16]"
            />

            <div className="relative z-10 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#FF795E]">
                    <span>Signature Arcade Mode</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#FFDA79]">2-Win Streak Bonus</span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#F4F4F0] mt-0.5">
                    Clash Mode
                  </h2>
                  <p className="text-sm leading-relaxed text-[#CBD5E1] mt-1">
                    Battle through rapid skill minigames to claim board cells.
                    Win two Clashes in a row to trigger a bonus placement.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onMinigameSelectionChange('rotating')}
                  aria-pressed={minigameSelection === 'rotating'}
                  className={[
                    'min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDA79]',
                    minigameSelection === 'rotating'
                      ? 'bg-[#FFDA79]/18 border-[#FFDA79] text-[#FFDA79]'
                      : 'bg-[#10141D] border-[#65737C]/35 text-[#CBD5E1] hover:text-[#F4F4F0] hover:border-[#FFDA79]/50',
                  ].join(' ')}
                >
                  Rotate All
                </button>
              </div>

              {/* Three Minigame Previews with Distinct Hover Identities */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {MINIGAME_ORDER.map((id) => {
                  const card = MINIGAME_META[id];
                  const active = minigameSelection === id;
                  const isRotatedActive = minigameSelection === 'rotating';
                  return (
                    <button
                      key={id}
                      type="button"
                      data-gsap="minigame-card"
                      onClick={() => onMinigameSelectionChange(id)}
                      aria-pressed={active}
                      style={{
                        borderColor: active
                          ? card.accentHex
                          : isRotatedActive
                            ? 'rgba(101, 115, 124, 0.35)'
                            : undefined,
                      }}
                      className={[
                        'group relative text-left rounded-2xl p-1.5 border transition-all duration-200 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDA79]',
                        active
                          ? 'bg-[#1F293D] shadow-[0_10px_24px_rgba(0,0,0,0.32)]'
                          : 'bg-[#10141D]/85 border-[#65737C]/30 hover:bg-[#172031] hover:border-[#F4F4F0]/45',
                      ].join(' ')}
                    >
                      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-[#10141D]">
                        <img
                          src={card.cardSrc}
                          alt={card.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-200 ease-out"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#10141D]/70 via-transparent to-transparent pointer-events-none" />
                        <MinigameHoverBadge id={id} active={active} />
                        {active && (
                          <span className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-md bg-[#10141D]/90 border border-[#FFDA79]/60 flex items-center justify-center text-[#FFDA79]">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="px-1 pt-1.5 pb-0.5">
                        <p className="text-sm font-semibold text-[#F4F4F0] truncate">
                          {card.title}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Animated Visual Connector: Minigames -> Board Claim -> 2-Win Streak */}
              <div
                aria-hidden="true"
                className="relative rounded-xl bg-[#10141D]/80 border border-[#65737C]/25 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 overflow-hidden"
              >
                <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#43DDE6]/12 to-transparent clash-conduit-pulse pointer-events-none" />
                <div className="relative z-10 flex items-center gap-2 text-xs sm:text-sm text-[#CBD5E1]">
                  <span className="font-semibold text-[#43DDE6]">
                    1. Win Minigame
                  </span>
                  <span className="text-[#65737C]">→</span>
                  <span className="font-semibold text-[#F4F4F0]">
                    2. Claim Cell
                  </span>
                </div>
                <div className="relative z-10 flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#FFDA79]">
                  <Flame className="w-4 h-4 text-[#FF795E]" />
                  <span>2-Win Streak = 2× Placements</span>
                </div>
              </div>
            </div>

            <div data-gsap="cta" className="relative z-10">
              <button
                type="button"
                data-testid="play-clash-btn"
                onClick={onStartClash}
                className="btn-arcade-sheen w-full inline-flex items-center justify-center gap-2.5 min-h-[48px] py-3 px-6 rounded-2xl font-display font-bold text-base bg-gradient-to-r from-[#FF795E] via-[#FF8968] to-[#FFDA79] text-[#10141D] hover:brightness-105 active:scale-[0.985] transition-all cursor-pointer whitespace-nowrap shadow-[0_14px_32px_rgba(255,121,94,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDA79] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151C2A]"
              >
                <Swords className="w-5 h-5" />
                Play Clash
              </button>
            </div>
          </section>

          {/* Private Room Panel */}
          <section
            data-gsap="room-card"
            aria-label="Private Invite Room"
            onPointerMove={updateCardSpotlight}
            style={
              {
                '--spotlight-color': 'rgba(139, 124, 255, 0.14)',
              } as React.CSSProperties
            }
            className="arcade-card-spotlight lg:col-span-5 rounded-3xl bg-[#151C2A]/92 border border-[#65737C]/35 hover:border-[#8B7CFF]/60 p-4 sm:p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#8B7CFF]">
                    <span>Multiplayer</span>
                    <span aria-hidden="true">·</span>
                    <span>Invite Code</span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#F4F4F0] mt-0.5">
                    Private Room
                  </h2>
                </div>
                <img
                  src={TURN_TAKE_ASSETS.inviteConnection}
                  alt="Player connection emblem"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 object-contain shrink-0"
                />
              </div>

              <p className="text-sm sm:text-[15px] leading-relaxed text-[#CBD5E1]">
                Create a private 6-character room code to invite a friend, or
                join an active match below.
              </p>

              <label className="flex items-center gap-2 min-h-[44px] text-xs text-[#CBD5E1]">
                <input type="checkbox" className="accent-[#43DDE6]" checked={publicLeaderboard} onChange={e=>onPublicLeaderboardChange(e.target.checked)}/>
                Show my name and avatar in public casual rankings
              </label>
              {inviteCode&&<button disabled={roomBusy} onClick={()=>onJoinRoom(inviteCode)} className="min-h-[44px] text-sm text-[#43DDE6] underline">Join invite {inviteCode}</button>}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={roomBusy}
                  onClick={() => onCreateRoom('classic')}
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold bg-[#10141D] text-[#43DDE6] border border-[#43DDE6]/45 hover:bg-[#43DDE6]/12 hover:border-[#43DDE6] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
                >
                  <Link2 className="w-4 h-4 shrink-0" />
                  Classic Room
                </button>
                <button
                  type="button"
                  disabled={roomBusy}
                  onClick={() => onCreateRoom('clash')}
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold bg-[#10141D] text-[#FF795E] border border-[#FF795E]/45 hover:bg-[#FF795E]/12 hover:border-[#FF795E] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF795E]"
                >
                  <Swords className="w-4 h-4 shrink-0" />
                  Clash Room
                </button>
              </div>
            </div>

            <form
              onSubmit={handleJoinSubmit}
              autoComplete="off"
              data-protonpass-ignore="true"
              suppressHydrationWarning
              className="space-y-2.5"
            >
              <label
                htmlFor="join-room-code"
                className="block text-sm font-medium text-[#94A3B8]"
              >
                Join with Invite Code
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  id="join-room-code"
                  type="text"
                  maxLength={8}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g. 7K9M2P)"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore="true"
                  data-protonpass-ignore="true"
                  suppressHydrationWarning
                  className="flex-1 min-w-0 min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#10141D] border border-[#65737C]/40 font-mono text-sm sm:text-base uppercase tracking-wider text-[#F4F4F0] placeholder:text-[#65737C] placeholder:normal-case placeholder:tracking-normal focus-visible:outline-none focus-visible:border-[#8B7CFF] focus-visible:ring-2 focus-visible:ring-[#8B7CFF]/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={roomBusy || !joinCode.trim()}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[46px] px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#8B7CFF] text-[#10141D] hover:bg-[#a195ff] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
                >
                  {roomBusy ? 'Joining...' : 'Join'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {roomError && (
                <p role="alert" className="text-sm text-[#FF795E]">
                  {roomError}
                </p>
              )}
            </form>
          </section>
        </div>

        {/* Clean Borderless Keyboard Hint */}
        <p
          data-gsap="hint"
          className="text-center text-xs sm:text-sm text-[#94A3B8] pt-1"
        >
          Press Enter or Space to launch Classic Mode · Click any grid cell to
          place your mark
        </p>
      </main>
    </div>
  );
}

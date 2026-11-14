'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Bot,
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

export function LobbyScreen({
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

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase());
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#10141D]">
      {/* Lobby Key Art Backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        <img
          src={TURN_TAKE_ASSETS.lobbyBackground}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#10141D]/70 via-[#10141D]/55 to-[#10141D]/90" />
      </div>

      {/* Main Content */}
      <main
        suppressHydrationWarning
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4"
      >
        {/* Top Utility Strip */}
        <div className="flex items-center justify-between gap-4">
          <TurnTakeLogo size="lg" />

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#151B28]/90 text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#FFDA79]/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trophy className="w-4 h-4 text-[#FFDA79]" />
              Leaderboard
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="p-2 rounded-xl bg-[#151B28]/90 text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#F4F4F0]/50 transition-colors cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-[#65737C]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#43DDE6]" />
              )}
            </button>
          </div>
        </div>

        <p className="text-sm sm:text-base text-[#F4F4F0]/80 max-w-2xl">
          Classic 3×3 tactics or head-to-head Clash minigames where consecutive
          wins unlock bonus board placements.
        </p>

        {/* Player Identity Bar */}
        <section
          suppressHydrationWarning
          aria-label="Player Profile"
          className="rounded-2xl bg-[#141A26]/90 border border-[#65737C]/30 px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label
              htmlFor="player-name-input"
              className="text-xs font-medium text-[#65737C] whitespace-nowrap"
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
              className="w-full sm:w-48 px-3.5 py-2 rounded-xl bg-[#10141D] border border-[#65737C]/35 text-sm font-medium text-[#F4F4F0] placeholder:text-[#65737C] focus:outline-none focus:border-[#43DDE6]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-[#65737C] mr-1">
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
                    'relative w-10 h-10 rounded-xl p-1 border transition-all cursor-pointer',
                    selected
                      ? 'bg-[#1D2638] border-[#43DDE6] scale-105'
                      : 'bg-[#10141D]/80 border-[#65737C]/25 hover:border-[#F4F4F0]/45',
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

        {/* Primary Classic Mode Card (Prioritized) */}
        <section
          aria-label="Classic Mode"
          className="rounded-3xl bg-[#151C2A]/95 border border-[#43DDE6]/35 p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-[#43DDE6]">
                <span>Primary Mode</span>
                <span aria-hidden="true">·</span>
                <span>3×3 Pure Strategy</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-[#F4F4F0]">
                Classic Mode
              </h2>
              <p className="text-sm text-[#F4F4F0]/75">
                Traditional alternating turns on the 3×3 grid. Challenge the
                adaptive AI bot or pass and play locally.
              </p>

              {/* Controls: Opponent & Difficulty */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div
                  role="group"
                  aria-label="Opponent type"
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10141D] border border-[#65737C]/25"
                >
                  <button
                    type="button"
                    onClick={() => onOpponentTypeChange('bot')}
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                      opponentType === 'bot'
                        ? 'bg-[#43DDE6] text-[#10141D]'
                        : 'text-[#F4F4F0]/75 hover:text-[#F4F4F0]',
                    ].join(' ')}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Vs. Bot
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpponentTypeChange('local')}
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                      opponentType === 'local'
                        ? 'bg-[#43DDE6] text-[#10141D]'
                        : 'text-[#F4F4F0]/75 hover:text-[#F4F4F0]',
                    ].join(' ')}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Local 2P
                  </button>
                </div>

                {opponentType === 'bot' && (
                  <div
                    role="group"
                    aria-label="Bot difficulty"
                    className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#10141D] border border-[#65737C]/25"
                  >
                    {(['casual', 'tactical', 'master'] as BotDifficulty[]).map(
                      (diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => onBotDifficultyChange(diff)}
                          className={[
                            'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap',
                            botDifficulty === diff
                              ? 'bg-[#1F293D] text-[#43DDE6] border border-[#43DDE6]/40'
                              : 'text-[#F4F4F0]/70 hover:text-[#F4F4F0]',
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

            <div className="shrink-0">
              <button
                type="button"
                data-start="true"
                data-testid="play-classic-btn"
                onClick={onStartClassic}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl font-display font-bold text-base bg-[#43DDE6] text-[#10141D] hover:bg-[#62e6ed] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap shadow-[0_12px_30px_rgba(67,221,230,0.25)]"
              >
                <Play className="w-5 h-5 fill-current" />
                Play Classic
              </button>
            </div>
          </div>
        </section>

        {/* Secondary Modes Grid: Clash Mode + Private Invite Rooms */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Clash Mode Panel */}
          <section
            aria-label="Clash Mode"
            className="lg:col-span-7 rounded-3xl bg-[#151C2A]/90 border border-[#65737C]/30 p-4 sm:p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-[#FF795E]">
                    <span>Arcade Mode</span>
                    <span aria-hidden="true">·</span>
                    <span>2-Win Streak Bonus</span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#F4F4F0] mt-0.5">
                    Clash Mode
                  </h2>
                  <p className="text-xs sm:text-sm text-[#F4F4F0]/70 mt-1">
                    Win quick skill minigames to claim board cells. Two Clash
                    victories in a row grant a bonus placement.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onMinigameSelectionChange('rotating')}
                  className={[
                    'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0',
                    minigameSelection === 'rotating'
                      ? 'bg-[#FFDA79]/15 border-[#FFDA79] text-[#FFDA79]'
                      : 'bg-[#10141D] border-[#65737C]/30 text-[#F4F4F0]/75 hover:text-[#F4F4F0]',
                  ].join(' ')}
                >
                  Rotate All
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {MINIGAME_ORDER.map((id) => {
                  const card = MINIGAME_META[id];
                  const active = minigameSelection === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onMinigameSelectionChange(id)}
                      aria-pressed={active}
                      className={[
                        'group text-left rounded-2xl p-1.5 border transition-all cursor-pointer',
                        active
                          ? 'bg-[#1E2738] border-[#FF795E]'
                          : 'bg-[#10141D]/80 border-[#65737C]/25 hover:border-[#F4F4F0]/40',
                      ].join(' ')}
                    >
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#10141D]">
                        <img
                          src={card.cardSrc}
                          alt={card.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        />
                      </div>
                      <p className="text-xs font-semibold text-[#F4F4F0] mt-1.5 px-1 truncate">
                        {card.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              data-testid="play-clash-btn"
              onClick={onStartClash}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-display font-bold text-sm bg-[#FF795E] text-[#10141D] hover:bg-[#ff8f78] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Swords className="w-4 h-4" />
              Play Clash
            </button>
          </section>

          {/* Private Room Panel */}
          <section
            aria-label="Private Invite Room"
            className="lg:col-span-5 rounded-3xl bg-[#151C2A]/90 border border-[#65737C]/30 p-4 sm:p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-[#8B7CFF]">
                    <span>Multiplayer</span>
                    <span aria-hidden="true">·</span>
                    <span>Invite Code</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#F4F4F0] mt-1">
                    Private Room
                  </h2>
                </div>
                <img
                  src={TURN_TAKE_ASSETS.inviteConnection}
                  alt="Player connection emblem"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 object-contain shrink-0"
                />
              </div>

              <p className="text-sm text-[#F4F4F0]/70">
                Create a private 6-character room code to invite a friend, or
                enter an existing code below.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={roomBusy}
                  onClick={() => onCreateRoom('classic')}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#10141D] text-[#43DDE6] border border-[#43DDE6]/40 hover:bg-[#43DDE6]/10 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Classic Room
                </button>
                <button
                  type="button"
                  disabled={roomBusy}
                  onClick={() => onCreateRoom('clash')}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#10141D] text-[#FF795E] border border-[#FF795E]/40 hover:bg-[#FF795E]/10 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <Swords className="w-3.5 h-3.5" />
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
                className="block text-xs font-medium text-[#65737C]"
              >
                Join with Invite Code
              </label>
              <div className="flex items-center gap-2">
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
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#10141D] border border-[#65737C]/35 font-mono text-sm uppercase tracking-wider text-[#F4F4F0] placeholder:text-[#65737C] placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-[#8B7CFF]"
                />
                <button
                  type="submit"
                  disabled={roomBusy || !joinCode.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#8B7CFF] text-[#10141D] hover:bg-[#a195ff] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Join
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {roomError && (
                <p role="alert" className="text-xs text-[#FF795E]">
                  {roomError}
                </p>
              )}
            </form>
          </section>
        </div>

        {/* Clean Borderless Keyboard Hint */}
        <p className="text-center text-xs text-[#65737C] pt-1">
          Enter or Space launches Classic Mode · Click any grid cell to place
          your mark
        </p>
      </main>
    </div>
  );
}

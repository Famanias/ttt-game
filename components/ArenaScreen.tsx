'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bot,
  Flame,
  RotateCcw,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  getAvatarSrc,
  MINIGAME_META,
  TURN_TAKE_ASSETS,
} from '@/lib/game/assets';
import type {
  BoardState,
  BotDifficulty,
  GameMode,
  Mark,
  MinigameId,
  OpponentType,
  PlayerProfile,
  StreakState,
} from '@/lib/game/types';
import { GameBoard } from './GameBoard';
import { TurnTakeLogo } from './TurnTakeLogo';

interface ArenaScreenProps {
  mode: GameMode;
  opponentType: OpponentType;
  botDifficulty: BotDifficulty;
  roomCode: string | null;
  localRoomMark: Mark;
  board: BoardState;
  currentTurn: Mark;
  winningLine: number[] | null;
  winner: Mark | 'draw' | null;
  playerX: PlayerProfile;
  playerO: PlayerProfile;
  sessionScores: { X: number; O: number; draws: number };
  clashRound: number;
  clashStreaks: StreakState;
  pendingPlacements: number;
  pendingPlacer: Mark | null;
  activeMinigame: MinigameId;
  botThinking: boolean;
  muted: boolean;
  onCellClick: (index: number) => void;
  onLaunchClash: () => void;
  onRestart: () => void;
  onBackToLobby: () => void;
  onOpenLeaderboard: () => void;
  onToggleMute: () => void;
}

function StreakSocketGauge({
  streak,
  accentColor,
}: {
  streak: number;
  accentColor: string;
}) {
  return (
    <div className="text-right">
      <p className="text-xs text-[#94A3B8]">Streak</p>
      <div className="flex items-center justify-end gap-1.5 mt-1">
        {[0, 1].map((pip) => {
          const filled = streak > pip;
          return (
            <span
              key={pip}
              aria-hidden="true"
              style={{
                backgroundColor: filled
                  ? streak >= 2
                    ? '#FFDA79'
                    : accentColor
                  : 'transparent',
                borderColor: filled
                  ? streak >= 2
                    ? '#FFDA79'
                    : accentColor
                  : 'rgba(148, 163, 184, 0.4)',
              }}
              className="w-3 h-3 rounded-sm border transition-all duration-200"
            />
          );
        })}
        <span className="font-mono text-sm font-semibold text-[#FFDA79] ml-0.5">
          {streak}/2
        </span>
      </div>
    </div>
  );
}

export function ArenaScreen({
  mode,
  opponentType,
  botDifficulty,
  roomCode,
  localRoomMark,
  board,
  currentTurn,
  winningLine,
  winner,
  playerX,
  playerO,
  sessionScores,
  clashRound,
  clashStreaks,
  pendingPlacements,
  pendingPlacer,
  activeMinigame,
  botThinking,
  muted,
  onCellClick,
  onLaunchClash,
  onRestart,
  onBackToLobby,
  onOpenLeaderboard,
  onToggleMute,
}: ArenaScreenProps) {
  const isClassic = mode === 'classic';
  const activeMark: Mark = isClassic
    ? currentTurn
    : pendingPlacer ?? currentTurn;

  const canPlaceOnBoard = (() => {
    if (winner !== null) return false;
    if (isClassic) {
      if (opponentType === 'bot') return currentTurn === 'X' && !botThinking;
      if (opponentType === 'room') return currentTurn === localRoomMark;
      return true;
    }
    if (pendingPlacements <= 0 || !pendingPlacer) return false;
    if (opponentType === 'bot') return pendingPlacer === 'X';
    if (opponentType === 'room') return pendingPlacer === localRoomMark;
    return true;
  })();

  const needsClashLaunch =
    !isClassic && winner === null && pendingPlacements === 0;

  const statusText = (() => {
    if (winner === 'draw') return 'Match Drawn';
    if (winner === 'X') return `${playerX.name} (X) Wins`;
    if (winner === 'O') return `${playerO.name} (O) Wins`;

    if (isClassic) {
      if (opponentType === 'bot') {
        return currentTurn === 'X'
          ? `Your Turn (${playerX.name} · X) — Choose a cell`
          : `${playerO.name} (O) is thinking...`;
      }
      if (opponentType === 'room') {
        return currentTurn === localRoomMark
          ? `Your Turn (${localRoomMark}) — Choose a cell`
          : `Waiting for ${currentTurn === 'X' ? playerX.name : playerO.name} (${currentTurn})...`;
      }
      return `${currentTurn === 'X' ? playerX.name : playerO.name}'s Turn (${currentTurn})`;
    }

    if (pendingPlacements > 0 && pendingPlacer) {
      const placerName = pendingPlacer === 'X' ? playerX.name : playerO.name;
      if (opponentType === 'bot' && pendingPlacer === 'O') {
        return `${placerName} is placing its mark...`;
      }
      return `${placerName} (${pendingPlacer}) earned ${pendingPlacements} placement${pendingPlacements > 1 ? 's' : ''}`;
    }

    return `Clash Round ${clashRound} · ${MINIGAME_META[activeMinigame].title}`;
  })();

  const modeLabel = isClassic
    ? `Classic Mode · ${
        opponentType === 'bot'
          ? `Bot (${botDifficulty})`
          : opponentType === 'room'
            ? `Room ${roomCode}`
            : 'Local 2P'
      }`
    : `Clash Mode · Round ${clashRound}`;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#10141D] flex flex-col">
      {/* Quiet Arena Ambient Background */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <img
          src={TURN_TAKE_ASSETS.boardBackground}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-75"
        />
        <div className="absolute inset-0 bg-[#10141D]/38" />
        <img
          src={TURN_TAKE_ASSETS.ornaments.frameCorners}
          alt=""
          referrerPolicy="no-referrer"
          className="hidden xl:block absolute -left-16 bottom-12 w-60 h-60 object-contain opacity-[0.1]"
        />
      </div>

      {/* Compact Top Utility HUD */}
      <header className="relative z-10 max-w-[1180px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onBackToLobby}
            className="hover:opacity-85 transition-opacity cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
            aria-label="Return to lobby"
          >
            <TurnTakeLogo size="sm" />
          </button>
          <span className="hidden md:inline text-sm font-medium text-[#94A3B8] truncate">
            {modeLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            title="Mute (M)"
            className="min-w-[42px] min-h-[42px] inline-flex items-center justify-center p-2.5 rounded-xl bg-[#151C2A]/90 text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#43DDE6]/65 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-[#94A3B8]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#43DDE6]" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            aria-label="Open leaderboard"
            title="Leaderboard"
            className="min-w-[42px] min-h-[42px] inline-flex items-center justify-center p-2.5 rounded-xl bg-[#151C2A]/90 text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#FFDA79]/65 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDA79]"
          >
            <Trophy className="w-4 h-4 text-[#FFDA79]" />
          </button>
          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart match"
            title="Restart (R)"
            className="inline-flex items-center justify-center gap-1.5 min-w-[42px] min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[#151C2A]/90 text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#F4F4F0]/55 active:scale-95 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Restart</span>
          </button>
          <button
            type="button"
            onClick={onBackToLobby}
            aria-label="Exit to lobby"
            title="Lobby (Esc)"
            className="inline-flex items-center justify-center gap-1.5 min-w-[42px] min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[#151C2A]/90 text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#F4F4F0]/55 active:scale-95 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </button>
        </div>
      </header>

      {/* Main Arena Stage */}
      <main
        suppressHydrationWarning
        className="relative z-10 flex-1 max-w-[1180px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col justify-center gap-5 sm:gap-6"
      >
        {/* Turn / Clash Status Banner */}
        <div className="text-center space-y-2">
          <motion.div
            key={statusText}
            initial={{ opacity: 0.75, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-2xl bg-[#151C2A]/92 border border-[#65737C]/35 shadow-sm"
          >
            <span
              className="font-mono text-sm font-bold"
              style={{ color: activeMark === 'X' ? '#43DDE6' : '#FF795E' }}
            >
              {activeMark}
            </span>
            <span
              data-testid="turn-status"
              className="text-sm sm:text-base font-semibold text-[#F4F4F0]"
            >
              {statusText}
            </span>
          </motion.div>
        </div>

        {/* 3-Column Arena on Desktop | Responsive Stacked Cards on Mobile/Tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr_250px] gap-5 lg:gap-6 items-center">
          {/* Player X Card */}
          <div
            className={[
              'rounded-2xl p-4 sm:p-5 bg-[#141A26]/92 border transition-colors duration-200 flex lg:flex-col items-center lg:items-start justify-between gap-3.5',
              activeMark === 'X' && winner === null
                ? 'border-[#43DDE6]/85 shadow-[0_0_24px_rgba(67,221,230,0.12)]'
                : 'border-[#65737C]/30',
            ].join(' ')}
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={getAvatarSrc(playerX.avatarId)}
                alt={playerX.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#10141D] object-contain p-1 border border-[#43DDE6]/45 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-[#43DDE6]">
                  Player X{' '}
                  {opponentType === 'room' && localRoomMark === 'X'
                    ? '(You)'
                    : ''}
                </p>
                <p className="font-display font-bold text-base sm:text-lg text-[#F4F4F0] truncate max-w-[140px]">
                  {playerX.name}
                </p>
              </div>
            </div>

            <div className="flex lg:w-full items-center justify-between gap-4 pt-0 lg:pt-3 lg:border-t lg:border-[#65737C]/25 shrink-0">
              <div>
                <p className="text-xs text-[#94A3B8]">Wins</p>
                <motion.p
                  key={sessionScores.X}
                  initial={{ scale: 1.25 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  data-testid="score-x"
                  className="font-mono text-2xl font-bold text-[#43DDE6]"
                >
                  {sessionScores.X}
                </motion.p>
              </div>
              {!isClassic && (
                <StreakSocketGauge
                  streak={clashStreaks.X}
                  accentColor="#43DDE6"
                />
              )}
            </div>
          </div>

          {/* Center Board & Clash Action */}
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <GameBoard
              board={board}
              currentTurn={activeMark}
              winningLine={winningLine}
              disabled={!canPlaceOnBoard}
              onCellClick={onCellClick}
              previewMark={activeMark}
            />

            {needsClashLaunch && (
              <button
                type="button"
                data-testid="launch-clash-btn"
                onClick={onLaunchClash}
                className="btn-arcade-sheen inline-flex items-center justify-center gap-2.5 min-h-[48px] px-7 py-3.5 rounded-2xl font-display font-bold text-sm sm:text-base bg-[#FFDA79] text-[#10141D] hover:bg-[#ffe399] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-[0_12px_30px_rgba(255,218,121,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
              >
                <Swords className="w-5 h-5" />
                Start Clash Round {clashRound}
              </button>
            )}

            {pendingPlacements === 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#FFDA79]/12 border border-[#FFDA79]/45 text-xs sm:text-sm font-semibold text-[#FFDA79]"
              >
                <img
                  src={TURN_TAKE_ASSETS.streakBonus}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 object-contain"
                />
                <Flame className="w-4 h-4 text-[#FF795E]" />
                <span>2-Win Streak Bonus: 2 placements remaining</span>
              </motion.div>
            )}
          </div>

          {/* Player O Card */}
          <div
            className={[
              'rounded-2xl p-4 sm:p-5 bg-[#141A26]/92 border transition-colors duration-200 flex lg:flex-col items-center lg:items-start justify-between gap-3.5',
              activeMark === 'O' && winner === null
                ? 'border-[#FF795E]/85 shadow-[0_0_24px_rgba(255,121,94,0.12)]'
                : 'border-[#65737C]/30',
            ].join(' ')}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={getAvatarSrc(playerO.avatarId)}
                  alt={playerO.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#10141D] object-contain p-1 border border-[#FF795E]/45"
                />
                {opponentType === 'bot' && (
                  <Bot
                    className="w-4 h-4 text-[#FF795E] absolute -bottom-1 -right-1 bg-[#10141D] rounded-full p-0.5"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-[#FF795E]">
                  Player O{' '}
                  {opponentType === 'room' && localRoomMark === 'O'
                    ? '(You)'
                    : ''}
                </p>
                <p className="font-display font-bold text-base sm:text-lg text-[#F4F4F0] truncate max-w-[140px]">
                  {playerO.name}
                </p>
              </div>
            </div>

            <div className="flex lg:w-full items-center justify-between gap-4 pt-0 lg:pt-3 lg:border-t lg:border-[#65737C]/25 shrink-0">
              <div>
                <p className="text-xs text-[#94A3B8]">Wins</p>
                <motion.p
                  key={sessionScores.O}
                  initial={{ scale: 1.25 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  data-testid="score-o"
                  className="font-mono text-2xl font-bold text-[#FF795E]"
                >
                  {sessionScores.O}
                </motion.p>
              </div>
              {!isClassic && (
                <StreakSocketGauge
                  streak={clashStreaks.O}
                  accentColor="#FF795E"
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import {
  ArrowLeft,
  Bot,
  RotateCcw,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getAvatarSrc, MINIGAME_META, TURN_TAKE_ASSETS } from '@/lib/game/assets';
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
    <div className="relative min-h-screen w-full bg-[#10141D] flex flex-col">
      {/* Quiet Arena Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <img
          src={TURN_TAKE_ASSETS.boardBackground}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-[#10141D]/35" />
      </div>

      {/* Compact Top Utility HUD */}
      <header className="relative z-10 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToLobby}
            className="hover:opacity-85 transition-opacity cursor-pointer"
            aria-label="Return to lobby"
          >
            <TurnTakeLogo size="sm" />
          </button>
          <span className="hidden sm:inline text-xs font-medium text-[#65737C]">
            {modeLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            title="Mute (M)"
            className="p-2.5 rounded-xl bg-[#151C2A]/90 text-[#F4F4F0] border border-[#65737C]/30 hover:border-[#F4F4F0]/50 transition-colors cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-[#65737C]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#43DDE6]" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            aria-label="Open leaderboard"
            title="Leaderboard"
            className="p-2.5 rounded-xl bg-[#151C2A]/90 text-[#F4F4F0] border border-[#65737C]/30 hover:border-[#FFDA79]/60 transition-colors cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-[#FFDA79]" />
          </button>
          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart match"
            title="Restart (R)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#151C2A]/90 text-[#F4F4F0] border border-[#65737C]/30 hover:border-[#F4F4F0]/50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </button>
          <button
            type="button"
            onClick={onBackToLobby}
            aria-label="Exit to lobby"
            title="Lobby (Esc)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#151C2A]/90 text-[#F4F4F0] border border-[#65737C]/30 hover:border-[#F4F4F0]/50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lobby</span>
          </button>
        </div>
      </header>

      {/* Main Arena Stage */}
      <main
        suppressHydrationWarning
        className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 flex flex-col justify-center gap-5"
      >
        {/* Turn / Clash Status Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#151C2A]/90 border border-[#65737C]/30">
            <span
              className="font-mono text-xs font-bold"
              style={{ color: activeMark === 'X' ? '#43DDE6' : '#FF795E' }}
            >
              {activeMark}
            </span>
            <span
              data-testid="turn-status"
              className="text-sm font-semibold text-[#F4F4F0]"
            >
              {statusText}
            </span>
          </div>
        </div>

        {/* 3-Column Arena: Player X | 3x3 Board | Player O */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] gap-5 items-center">
          {/* Player X Card */}
          <div
            className={[
              'rounded-2xl p-4 bg-[#141A26]/90 border transition-colors flex lg:flex-col items-center lg:items-start justify-between gap-3',
              activeMark === 'X' && winner === null
                ? 'border-[#43DDE6]/80'
                : 'border-[#65737C]/25',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <img
                src={getAvatarSrc(playerX.avatarId)}
                alt={playerX.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl bg-[#10141D] object-contain p-1 border border-[#43DDE6]/40 shrink-0"
              />
              <div>
                <p className="text-xs font-medium text-[#43DDE6]">
                  Player X {opponentType === 'room' && localRoomMark === 'X' ? '(You)' : ''}
                </p>
                <p className="font-display font-bold text-base text-[#F4F4F0] truncate max-w-[120px]">
                  {playerX.name}
                </p>
              </div>
            </div>

            <div className="flex lg:w-full items-center justify-between gap-4 pt-0 lg:pt-2 lg:border-t lg:border-[#65737C]/20">
              <div>
                <p className="text-[11px] text-[#65737C]">Wins</p>
                <p
                  data-testid="score-x"
                  className="font-mono text-xl font-bold text-[#43DDE6]"
                >
                  {sessionScores.X}
                </p>
              </div>
              {!isClassic && (
                <div className="text-right">
                  <p className="text-[11px] text-[#65737C]">Streak</p>
                  <p className="font-mono text-sm font-semibold text-[#FFDA79]">
                    {clashStreaks.X}/2
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Center Board & Clash Action */}
          <div className="flex flex-col items-center gap-4">
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
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-display font-bold text-sm bg-[#FFDA79] text-[#10141D] hover:bg-[#ffe399] transition-colors cursor-pointer shadow-[0_12px_30px_rgba(255,218,121,0.22)]"
              >
                <Swords className="w-4 h-4" />
                Start Clash Round {clashRound}
              </button>
            )}

            {pendingPlacements === 2 && (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#FFDA79]">
                <img
                  src={TURN_TAKE_ASSETS.streakBonus}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 object-contain"
                />
                <span>2-Win Streak Bonus: 2 placements remaining</span>
              </div>
            )}
          </div>

          {/* Player O Card */}
          <div
            className={[
              'rounded-2xl p-4 bg-[#141A26]/90 border transition-colors flex lg:flex-col items-center lg:items-start justify-between gap-3',
              activeMark === 'O' && winner === null
                ? 'border-[#FF795E]/80'
                : 'border-[#65737C]/25',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img
                  src={getAvatarSrc(playerO.avatarId)}
                  alt={playerO.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl bg-[#10141D] object-contain p-1 border border-[#FF795E]/40"
                />
                {opponentType === 'bot' && (
                  <Bot
                    className="w-3.5 h-3.5 text-[#FF795E] absolute -bottom-1 -right-1 bg-[#10141D] rounded-full p-0.5"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-[#FF795E]">
                  Player O {opponentType === 'room' && localRoomMark === 'O' ? '(You)' : ''}
                </p>
                <p className="font-display font-bold text-base text-[#F4F4F0] truncate max-w-[120px]">
                  {playerO.name}
                </p>
              </div>
            </div>

            <div className="flex lg:w-full items-center justify-between gap-4 pt-0 lg:pt-2 lg:border-t lg:border-[#65737C]/20">
              <div>
                <p className="text-[11px] text-[#65737C]">Wins</p>
                <p
                  data-testid="score-o"
                  className="font-mono text-xl font-bold text-[#FF795E]"
                >
                  {sessionScores.O}
                </p>
              </div>
              {!isClassic && (
                <div className="text-right">
                  <p className="text-[11px] text-[#65737C]">Streak</p>
                  <p className="font-mono text-sm font-semibold text-[#FFDA79]">
                    {clashStreaks.O}/2
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';
import { TURN_TAKE_ASSETS } from '@/lib/game/assets';
import type { GameMode, Mark, PlayerProfile } from '@/lib/game/types';

interface OutcomeModalProps {
  playAgainLabel?: string;
  winner: Mark | 'draw';
  mode: GameMode;
  playerX: PlayerProfile;
  playerO: PlayerProfile;
  moveCount: number;
  sessionScores: { X: number; O: number; draws: number };
  bestStreak: number;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  onOpenLeaderboard: () => void;
}

export function OutcomeModal({
  playAgainLabel,
  winner,
  mode,
  playerX,
  playerO,
  moveCount,
  sessionScores,
  bestStreak,
  onPlayAgain,
  onBackToLobby,
  onOpenLeaderboard,
}: OutcomeModalProps) {
  const isDraw = winner === 'draw';
  const winnerProfile = winner === 'X' ? playerX : playerO;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      role="dialog"
      aria-modal="true"
      aria-label={isDraw ? 'Match Draw' : `${winnerProfile.name} Wins`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E15]/85"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md rounded-3xl bg-[#151B28] border border-[#65737C]/40 p-6 sm:p-7 text-center shadow-[0_28px_80px_rgba(0,0,0,0.72)] overflow-hidden"
      >
        <div className="relative flex justify-center mb-4">
          {!isDraw && (
            <img
              src={TURN_TAKE_ASSETS.ornaments.clashDiamond}
              alt=""
              referrerPolicy="no-referrer"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 object-contain opacity-20"
            />
          )}
          <motion.img
            initial={{ scale: 0.72, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            src={
              isDraw ? TURN_TAKE_ASSETS.drawEmblem : TURN_TAKE_ASSETS.victoryBurst
            }
            alt={isDraw ? 'Draw emblem' : 'Victory burst emblem'}
            referrerPolicy="no-referrer"
            className="relative z-10 w-28 h-28 object-contain"
          />
        </div>

        <p className="text-xs sm:text-sm font-medium text-[#94A3B8]">
          {mode === 'classic' ? 'Classic Mode' : 'Clash Mode'} · Match Complete
        </p>

        <h2
          data-testid="outcome-heading"
          className="font-display text-3xl font-extrabold mt-1 text-[#F4F4F0]"
        >
          {isDraw ? (
            'Balanced Draw'
          ) : (
            <>
              <span
                style={{ color: winner === 'X' ? '#43DDE6' : '#FF795E' }}
              >
                {winnerProfile.name}
              </span>{' '}
              Wins
            </>
          )}
        </h2>

        <div className="grid grid-cols-3 gap-2.5 my-5">
          <div className="p-3 rounded-2xl bg-[#10141D] border border-[#65737C]/25">
            <p className="text-xs text-[#94A3B8]">Moves</p>
            <p className="font-mono text-lg font-bold text-[#F4F4F0] mt-0.5">
              {moveCount}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[#10141D] border border-[#65737C]/25">
            <p className="text-xs text-[#94A3B8]">Series X / O</p>
            <p className="font-mono text-lg font-bold text-[#F4F4F0] mt-0.5">
              <span className="text-[#43DDE6]">{sessionScores.X}</span>
              <span className="text-[#94A3B8] mx-1">-</span>
              <span className="text-[#FF795E]">{sessionScores.O}</span>
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[#10141D] border border-[#65737C]/25">
            <p className="text-xs text-[#94A3B8]">Best Streak</p>
            <p className="font-mono text-lg font-bold text-[#FFDA79] mt-0.5">
              {bestStreak}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="btn-arcade-sheen w-full inline-flex items-center justify-center gap-2 min-h-[48px] py-3 px-5 rounded-xl font-semibold text-sm sm:text-base bg-[#43DDE6] text-[#10141D] hover:bg-[#62e6ed] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
          >
            <RotateCcw className="w-4 h-4" />
            {playAgainLabel ?? 'Play Again'}
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm bg-[#10141D] text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#FFDA79]/60 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDA79]"
            >
              <Trophy className="w-4 h-4 text-[#FFDA79]" />
              Standings
            </button>
            <button
              type="button"
              onClick={onBackToLobby}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm bg-[#10141D] text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#F4F4F0]/55 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
            >
              <ArrowLeft className="w-4 h-4" />
              Lobby
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

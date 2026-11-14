'use client';

import React from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Trophy, ArrowLeft } from 'lucide-react';
import { TURN_TAKE_ASSETS } from '@/lib/game/assets';
import type { GameMode, Mark, PlayerProfile } from '@/lib/game/types';

interface OutcomeModalProps {
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isDraw ? 'Match Draw' : `${winnerProfile.name} Wins`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E15]/85"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-3xl bg-[#151B28] border border-[#65737C]/35 p-6 sm:p-7 text-center shadow-[0_28px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="flex justify-center mb-4">
          <img
            src={isDraw ? TURN_TAKE_ASSETS.drawEmblem : TURN_TAKE_ASSETS.victoryBurst}
            alt={isDraw ? 'Draw emblem' : 'Victory burst emblem'}
            referrerPolicy="no-referrer"
            className="w-28 h-28 object-contain"
          />
        </div>

        <p className="text-xs font-medium text-[#65737C]">
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
          <div className="p-3 rounded-2xl bg-[#10141D] border border-[#65737C]/20">
            <p className="text-[11px] text-[#65737C]">Moves</p>
            <p className="font-mono text-lg font-bold text-[#F4F4F0] mt-0.5">
              {moveCount}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[#10141D] border border-[#65737C]/20">
            <p className="text-[11px] text-[#65737C]">Series X / O</p>
            <p className="font-mono text-lg font-bold text-[#F4F4F0] mt-0.5">
              <span className="text-[#43DDE6]">{sessionScores.X}</span>
              <span className="text-[#65737C] mx-1">-</span>
              <span className="text-[#FF795E]">{sessionScores.O}</span>
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[#10141D] border border-[#65737C]/20">
            <p className="text-[11px] text-[#65737C]">Best Streak</p>
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
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm bg-[#43DDE6] text-[#10141D] hover:bg-[#62e6ed] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-medium text-xs bg-[#10141D] text-[#F4F4F0] border border-[#65737C]/30 hover:border-[#F4F4F0]/50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trophy className="w-3.5 h-3.5 text-[#FFDA79]" />
              Standings
            </button>
            <button
              type="button"
              onClick={onBackToLobby}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-medium text-xs bg-[#10141D] text-[#F4F4F0] border border-[#65737C]/30 hover:border-[#F4F4F0]/50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Lobby
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

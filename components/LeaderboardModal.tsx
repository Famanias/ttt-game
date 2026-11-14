'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Trophy, X } from 'lucide-react';
import { getAvatarSrc } from '@/lib/game/assets';
import type { GameMode, LeaderboardEntry } from '@/lib/game/types';

interface LeaderboardModalProps {
  error?: string | null;
  mode?: GameMode;
  onModeChange?: (mode:GameMode)=>void;
  entries: LeaderboardEntry[];
  loading: boolean;
  onClose: () => void;
}

export function LeaderboardModal({
  error,
  mode='clash',
  onModeChange,
  entries,
  loading,
  onClose,
}: LeaderboardModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      role="dialog"
      aria-modal="true"
      aria-label="Arcade Leaderboard"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B0E15]/85"
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl rounded-3xl bg-[#151B28] border border-[#65737C]/40 p-4 sm:p-6 shadow-[0_28px_80px_rgba(0,0,0,0.72)]"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#65737C]/25">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-[#FFDA79]" />
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F4F4F0]">
              Casual Rankings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close leaderboard"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-xl text-[#94A3B8] hover:text-[#F4F4F0] hover:bg-[#1E2638] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-3 text-xs text-[#94A3B8]">Server-confirmed online matches only. Browser input is not cheat-proof. Names appear by player choice.</p>
        {onModeChange&&<div className="flex gap-3 mt-3">{(['clash','classic'] as const).map(item=><button key={item} aria-pressed={mode===item} onClick={()=>onModeChange(item)} className="min-h-[44px] px-4 rounded-xl border border-[#65737C]/40 text-[#43DDE6]">{item==='clash'?'Online Clash':'Online Classic'}</button>)}</div>}
        <div className="mt-4 max-h-[62vh] overflow-y-auto overflow-x-hidden">
          {loading ? (
            <p className="py-10 text-center text-sm sm:text-base text-[#94A3B8]">
              Loading standings...
            </p>
          ) : error ? <p role="alert" className="py-10 text-center text-sm text-[#FF795E]">{error}</p> : entries.length === 0 ? (
            <p className="py-10 text-center text-sm sm:text-base text-[#94A3B8]">
              No published results yet. Complete an online match and opt in to appear here.
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs sm:text-sm text-[#94A3B8] border-b border-[#65737C]/25">
                  <th className="py-2.5 pr-2 sm:pr-3 font-medium">Rank</th>
                  <th className="py-2.5 px-2 sm:px-3 font-medium">Player</th>
                  <th className="py-2.5 px-2 sm:px-3 font-medium text-right">
                    Wins
                  </th>
                  <th className="hidden sm:table-cell py-2.5 px-3 font-medium text-right">
                    W / L / D
                  </th>
                  <th className="py-2.5 pl-2 sm:pl-3 font-medium text-right">
                    Streak
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#65737C]/15 text-sm sm:text-[15px]">
                {entries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-[#1A2232]/70 transition-colors"
                  >
                    <td className="py-3 pr-2 sm:pr-3 font-mono text-xs sm:text-sm text-[#94A3B8]">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-2 sm:px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getAvatarSrc(entry.avatarId)}
                          alt={entry.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-xl bg-[#10141D] object-contain p-0.5 shrink-0"
                        />
                        <span className="font-medium text-[#F4F4F0] truncate max-w-[130px] sm:max-w-none">
                          {entry.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-right font-mono font-semibold text-[#43DDE6]">
                      {entry.wins}
                    </td>
                    <td className="hidden sm:table-cell py-3 px-3 text-right font-mono text-xs sm:text-sm text-[#CBD5E1]">
                      {entry.wins}-{entry.losses}-{entry.draws}
                    </td>
                    <td className="py-3 pl-2 sm:pl-3 text-right font-mono font-semibold text-[#FFDA79]">
                      {entry.bestStreak}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

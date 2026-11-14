'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Trophy, X } from 'lucide-react';
import { getAvatarSrc } from '@/lib/game/assets';
import type { LeaderboardEntry } from '@/lib/game/types';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  onClose: () => void;
}

export function LeaderboardModal({
  entries,
  loading,
  onClose,
}: LeaderboardModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Arcade Leaderboard"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E15]/85"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl rounded-3xl bg-[#151B28] border border-[#65737C]/35 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#65737C]/20">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-[#FFDA79]" />
            <h2 className="font-display text-xl font-bold text-[#F4F4F0]">
              Arcade Leaderboard
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close leaderboard"
            className="p-2 rounded-xl text-[#65737C] hover:text-[#F4F4F0] hover:bg-[#1E2638] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#65737C]">
              Loading standings...
            </p>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#65737C]">
              Complete a match to claim the top rank.
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-[#65737C] border-b border-[#65737C]/20">
                  <th className="py-2.5 pr-3 font-medium">Rank</th>
                  <th className="py-2.5 px-3 font-medium">Player</th>
                  <th className="py-2.5 px-3 font-medium text-right">Wins</th>
                  <th className="py-2.5 px-3 font-medium text-right">W / L / D</th>
                  <th className="py-2.5 pl-3 font-medium text-right">Best Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#65737C]/15 text-sm">
                {entries.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-[#1A2232]/60">
                    <td className="py-3 pr-3 font-mono text-xs text-[#65737C]">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getAvatarSrc(entry.avatarId)}
                          alt={entry.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-xl bg-[#10141D] object-contain p-0.5 shrink-0"
                        />
                        <span className="font-medium text-[#F4F4F0]">
                          {entry.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-[#43DDE6]">
                      {entry.wins}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-[#F4F4F0]/80">
                      {entry.wins}-{entry.losses}-{entry.draws}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono font-semibold text-[#FFDA79]">
                      {entry.bestStreak}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
}

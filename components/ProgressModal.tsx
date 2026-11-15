'use client';

import React, { useEffect, useState } from 'react';
import { Award, History, X } from 'lucide-react';
import { getAvatarSrc } from '@/lib/game/assets';
import type { AccountSession, MatchHistoryItem } from '@/lib/online/contracts';
import { accountAuth } from '@/lib/services/online-game';

interface ProgressModalProps {
  account: AccountSession;
  onClose: () => void;
}

export function ProgressModal({ account, onClose }: ProgressModalProps) {
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    accountAuth
      .history()
      .then((res) => {
        if (!alive) return;
        setMatches(res.matches ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Unable to load match history.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const stats = account.stats ?? {
    classicWins: 0,
    classicLosses: 0,
    classicDraws: 0,
    clashWins: 0,
    clashLosses: 0,
    clashDraws: 0,
    roundsWon: 0,
    roundsPlayed: 0,
    longestStreak: 0,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Player Progress"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B0E15]/85"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-[#151B28] border border-[#65737C]/40 p-4 sm:p-6 shadow-[0_28px_80px_rgba(0,0,0,0.72)]">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#65737C]/25">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={getAvatarSrc(account.avatarId ?? 'orb-bot')}
              alt={account.username ?? 'Player'}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl bg-[#10141D] p-1 object-contain shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F4F4F0] truncate">
                {account.username}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                {account.publicLeaderboard
                  ? 'Visible in public casual rankings'
                  : 'Private profile · hidden from public rankings'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close progress"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-xl text-[#94A3B8] hover:text-[#F4F4F0] hover:bg-[#1E2638] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-4">
          <div className="p-3.5 rounded-2xl bg-[#10141D] border border-[#65737C]/25">
            <p className="text-xs text-[#94A3B8]">Online Classic (W-L-D)</p>
            <p className="font-mono text-lg font-bold text-[#43DDE6] mt-1">
              {stats.classicWins}-{stats.classicLosses}-{stats.classicDraws}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#10141D] border border-[#65737C]/25">
            <p className="text-xs text-[#94A3B8]">Online Clash (W-L-D)</p>
            <p className="font-mono text-lg font-bold text-[#FF795E] mt-1">
              {stats.clashWins}-{stats.clashLosses}-{stats.clashDraws}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#10141D] border border-[#65737C]/25">
            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <Award className="w-3.5 h-3.5 text-[#FFDA79]" />
              Best Clash Streak
            </div>
            <p className="font-mono text-lg font-bold text-[#FFDA79] mt-1">
              {stats.longestStreak}{' '}
              <span className="text-xs font-normal text-[#94A3B8]">
                ({stats.roundsWon}/{stats.roundsPlayed} rounds)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#CBD5E1] mb-2">
          <History className="w-4 h-4 text-[#43DDE6]" />
          Recent Online Matches
        </div>
        <div className="max-h-[42vh] overflow-y-auto rounded-2xl bg-[#10141D] border border-[#65737C]/25 p-3">
          {loading ? (
            <p className="py-6 text-center text-sm text-[#94A3B8]">Loading history...</p>
          ) : error ? (
            <p role="alert" className="py-6 text-center text-sm text-[#FF795E]">
              {error}
            </p>
          ) : matches.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#94A3B8]">
              No completed online matches saved yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#65737C]/15">
              {matches.map((match) => {
                const isDraw = match.winner === 'draw';
                const won = match.winner === match.myMark;
                const badgeClass = isDraw
                  ? 'text-[#CBD5E1]'
                  : won
                    ? 'text-[#43DDE6]'
                    : 'text-[#FF795E]';
                const label = isDraw ? 'Draw' : won ? 'Win' : 'Loss';
                return (
                  <li key={match.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className={`font-semibold ${badgeClass}`}>{label}</span>
                      <span className="text-[#94A3B8] mx-1.5">·</span>
                      <span className="text-[#F4F4F0] capitalize">{match.mode}</span>
                      <span className="text-[#94A3B8] mx-1.5">vs</span>
                      <span className="text-[#CBD5E1]">{match.opponentName}</span>
                    </div>
                    <span className="text-xs font-mono text-[#94A3B8] shrink-0">
                      {new Date(match.finishedAt).toLocaleDateString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

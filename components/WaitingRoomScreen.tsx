'use client';

import React, { useState } from 'react';
import { ArrowLeft, Bot, Check, Copy } from 'lucide-react';
import { TURN_TAKE_ASSETS } from '@/lib/game/assets';
import type { RoomState } from '@/lib/game/types';
import { TurnTakeLogo } from './TurnTakeLogo';

interface WaitingRoomScreenProps {
  room: RoomState;
  onSwitchToBot: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  heading?: string;
}

export function WaitingRoomScreen({
  room,
  onSwitchToBot,
  onCancel,
  children,
  heading,
}: WaitingRoomScreenProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/room/${room.code}`
      : `/room/${room.code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#10141D] flex flex-col justify-between p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <img
          src={TURN_TAKE_ASSETS.waitingRoomBackground}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-50"
        />
        <div className="absolute inset-0 bg-[#10141D]/60" />
      </div>

      <header className="relative z-10 max-w-[1180px] w-full mx-auto flex items-center justify-between gap-4">
        <TurnTakeLogo size="sm" />
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[#151B28]/90 text-[#F4F4F0] border border-[#65737C]/40 hover:border-[#F4F4F0]/55 active:scale-95 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lobby
        </button>
      </header>

      <main
        suppressHydrationWarning
        className="relative z-10 max-w-md w-full mx-auto my-auto rounded-3xl bg-[#151C2A]/95 border border-[#8B7CFF]/35 p-6 sm:p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
      >
        <div className="relative w-28 h-28 mx-auto mb-3 flex items-center justify-center">
          <img
            src={TURN_TAKE_ASSETS.ornaments.orbitalViolet}
            alt=""
            referrerPolicy="no-referrer"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 w-full h-full object-contain opacity-45 orbit-slow-spin"
          />
          <img
            src={TURN_TAKE_ASSETS.inviteConnection}
            alt="Multiplayer signal arc"
            referrerPolicy="no-referrer"
            className="relative z-10 w-20 h-20 object-contain"
          />
        </div>

        <p className="text-xs sm:text-sm font-medium text-[#8B7CFF]">
          {room.mode === 'classic' ? 'Classic Mode' : 'Clash Mode'} · Private
          Room
        </p>

        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F4F4F0] mt-1">
          {heading ?? 'Waiting for Opponent'}
        </h1>

        <p className="text-sm sm:text-[15px] leading-relaxed text-[#CBD5E1] mt-2">
          Share this invite code or link with a friend to start your match.
        </p>

        <div className="my-6 p-4 rounded-2xl bg-[#10141D] border border-[#65737C]/35">
          <p className="text-xs font-medium text-[#94A3B8]">Invite Code</p>
          <p
            data-testid="room-invite-code"
            className="font-mono text-3xl font-bold tracking-[0.22em] text-[#43DDE6] mt-1"
          >
            {room.code}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {children}
          <button type="button" onClick={() => { void navigator.clipboard.writeText(room.code).then(()=>setCopied(true)).catch(()=>setCopied(false)); }} className="min-h-[44px] text-[#43DDE6] underline">Copy Invite Code</button>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-arcade-sheen w-full inline-flex items-center justify-center gap-2 min-h-[48px] py-3 px-4 rounded-xl font-semibold text-sm sm:text-base bg-[#43DDE6] text-[#10141D] hover:bg-[#62e6ed] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Invite Link Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Invite Link
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onSwitchToBot}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm bg-[#10141D] text-[#E2E8F0] border border-[#65737C]/35 hover:border-[#F4F4F0]/55 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
          >
            <Bot className="w-4 h-4 text-[#FF795E]" />
            Back to Local Games
          </button>
        </div>
      </main>

      <div className="relative z-10 h-4" />
    </div>
  );
}

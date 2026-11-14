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
}

export function WaitingRoomScreen({
  room,
  onSwitchToBot,
  onCancel,
}: WaitingRoomScreenProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?room=${room.code}`
      : `/?room=${room.code}`;

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
    <div className="relative min-h-screen w-full bg-[#10141D] flex flex-col justify-between p-4 sm:p-8 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <img
          src={TURN_TAKE_ASSETS.waitingRoomBackground}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-[#10141D]/55" />
      </div>

      <header className="relative z-10 max-w-4xl w-full mx-auto flex items-center justify-between">
        <TurnTakeLogo size="sm" />
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-[#151B28]/90 text-[#F4F4F0] border border-[#65737C]/35 hover:border-[#F4F4F0]/50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Lobby
        </button>
      </header>

      <main className="relative z-10 max-w-md w-full mx-auto my-auto rounded-3xl bg-[#151C2A]/95 border border-[#65737C]/35 p-6 sm:p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
        <img
          src={TURN_TAKE_ASSETS.inviteConnection}
          alt="Multiplayer signal arc"
          referrerPolicy="no-referrer"
          className="w-24 h-24 mx-auto object-contain mb-3"
        />

        <p className="text-xs font-medium text-[#8B7CFF]">
          {room.mode === 'classic' ? 'Classic Mode' : 'Clash Mode'} · Private
          Room
        </p>

        <h1 className="font-display text-2xl font-bold text-[#F4F4F0] mt-1">
          Waiting for Opponent
        </h1>

        <p className="text-sm text-[#F4F4F0]/70 mt-2">
          Share this invite code or link with a friend to start your match.
        </p>

        <div className="my-6 p-4 rounded-2xl bg-[#10141D] border border-[#65737C]/30">
          <p className="text-[11px] font-medium text-[#65737C]">Invite Code</p>
          <p
            data-testid="room-invite-code"
            className="font-mono text-3xl font-bold tracking-[0.22em] text-[#43DDE6] mt-1"
          >
            {room.code}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-[#43DDE6] text-[#10141D] hover:bg-[#62e6ed] transition-colors cursor-pointer"
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
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-xs bg-[#10141D] text-[#F4F4F0]/85 border border-[#65737C]/30 hover:border-[#F4F4F0]/50 transition-colors cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-[#FF795E]" />
            Play Against Bot Instead
          </button>
        </div>
      </main>

      <div className="relative z-10 h-4" />
    </div>
  );
}

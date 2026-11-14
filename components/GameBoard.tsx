'use client';

import React from 'react';
import { motion } from 'motion/react';
import { TURN_TAKE_ASSETS } from '@/lib/game/assets';
import type { BoardState, Mark } from '@/lib/game/types';

interface GameBoardProps {
  board: BoardState;
  currentTurn: Mark;
  winningLine: number[] | null;
  disabled: boolean;
  onCellClick: (index: number) => void;
  previewMark: Mark;
}

const LINE_COORDS: Record<
  string,
  { x1: number; y1: number; x2: number; y2: number }
> = {
  '0,1,2': { x1: 12, y1: 50, x2: 288, y2: 50 },
  '3,4,5': { x1: 12, y1: 150, x2: 288, y2: 150 },
  '6,7,8': { x1: 12, y1: 250, x2: 288, y2: 250 },
  '0,3,6': { x1: 50, y1: 12, x2: 50, y2: 288 },
  '1,4,7': { x1: 150, y1: 12, x2: 150, y2: 288 },
  '2,5,8': { x1: 250, y1: 12, x2: 250, y2: 288 },
  '0,4,8': { x1: 18, y1: 18, x2: 282, y2: 282 },
  '2,4,6': { x1: 282, y1: 18, x2: 18, y2: 282 },
};

export function GameBoard({
  board,
  currentTurn,
  winningLine,
  disabled,
  onCellClick,
  previewMark,
}: GameBoardProps) {
  const winKey = winningLine ? winningLine.join(',') : null;
  const lineCoords = winKey ? LINE_COORDS[winKey] : null;
  const winnerMark = winningLine ? board[winningLine[0]] : null;

  return (
    <div className="relative w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[440px] aspect-square mx-auto">
      {/* Subtle Non-Interactive Board Frame Ornament */}
      <img
        src={TURN_TAKE_ASSETS.ornaments.boardBrackets}
        alt=""
        referrerPolicy="no-referrer"
        aria-hidden="true"
        className="pointer-events-none select-none absolute -inset-3 sm:-inset-4 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] h-[calc(100%+1.5rem)] sm:h-[calc(100%+2rem)] object-contain opacity-25"
      />

      <div
        data-testid="tic-tac-toe-board"
        className="relative w-full h-full p-3 sm:p-4 rounded-3xl bg-[#141A26]/94 border border-[#65737C]/35 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
      >
        <div className="grid grid-cols-3 grid-rows-3 gap-2.5 sm:gap-3 w-full h-full">
          {board.map((cell, index) => {
            const row = Math.floor(index / 3) + 1;
            const col = (index % 3) + 1;
            const isWinningCell = winningLine?.includes(index) ?? false;
            const isInteractive = !disabled && cell === null;

            return (
              <button
                key={index}
                type="button"
                data-testid={`board-cell-${index}`}
                data-cell-value={cell ?? 'empty'}
                disabled={!isInteractive}
                onClick={() => onCellClick(index)}
                aria-label={`Row ${row} Column ${col}, ${cell ? cell : 'empty'}`}
                className={[
                  'group relative flex items-center justify-center rounded-2xl border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141A26]',
                  isWinningCell
                    ? winnerMark === 'X'
                      ? 'bg-[#43DDE6]/18 border-[#43DDE6] shadow-[0_0_24px_rgba(67,221,230,0.2)]'
                      : 'bg-[#FF795E]/18 border-[#FF795E] shadow-[0_0_24px_rgba(255,121,94,0.2)]'
                    : cell !== null
                      ? 'bg-[#192131] border-[#65737C]/30 cursor-default'
                      : isInteractive
                        ? 'bg-[#171E2C] border-[#65737C]/35 hover:bg-[#1E2738] hover:border-[#43DDE6]/55 active:scale-[0.96] cursor-pointer'
                        : 'bg-[#151B28]/70 border-[#65737C]/20 cursor-not-allowed',
                ].join(' ')}
              >
                {cell === 'X' && (
                  <motion.svg
                    initial={{ scale: 0.8, opacity: 0.4 }}
                    animate={
                      isWinningCell
                        ? { scale: [1, 1.09, 1], opacity: 1 }
                        : { scale: 1, opacity: 1 }
                    }
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    viewBox="0 0 64 64"
                    className="w-12 h-12 sm:w-14 sm:h-14"
                    aria-hidden="true"
                  >
                    <motion.path
                      d="M16 16L48 48"
                      stroke="#43DDE6"
                      strokeWidth="7"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                    />
                    <motion.path
                      d="M48 16L16 48"
                      stroke="#43DDE6"
                      strokeWidth="7"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        duration: 0.14,
                        delay: 0.06,
                        ease: 'easeOut',
                      }}
                    />
                  </motion.svg>
                )}

                {cell === 'O' && (
                  <motion.svg
                    initial={{ scale: 0.8, opacity: 0.4 }}
                    animate={
                      isWinningCell
                        ? { scale: [1, 1.09, 1], opacity: 1 }
                        : { scale: 1, opacity: 1 }
                    }
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    viewBox="0 0 64 64"
                    className="w-12 h-12 sm:w-14 sm:h-14"
                    aria-hidden="true"
                  >
                    <motion.circle
                      cx="32"
                      cy="32"
                      r="17"
                      fill="none"
                      stroke="#FF795E"
                      strokeWidth="7"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    />
                  </motion.svg>
                )}

                {cell === null && isInteractive && (
                  <svg
                    viewBox="0 0 64 64"
                    className="w-11 h-11 sm:w-12 sm:h-12 opacity-0 group-hover:opacity-35 transition-opacity duration-150 pointer-events-none"
                    aria-hidden="true"
                  >
                    {(previewMark || currentTurn) === 'X' ? (
                      <path
                        d="M18 18L46 46M46 18L18 46"
                        stroke="#43DDE6"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                    ) : (
                      <circle
                        cx="32"
                        cy="32"
                        r="15"
                        fill="none"
                        stroke="#FF795E"
                        strokeWidth="6"
                      />
                    )}
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {lineCoords && (
          <svg
            viewBox="0 0 300 300"
            className="absolute inset-3 sm:inset-4 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] h-[calc(100%-1.5rem)] sm:h-[calc(100%-2rem)] pointer-events-none"
            aria-hidden="true"
          >
            <motion.line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke={winnerMark === 'X' ? '#43DDE6' : '#FF795E'}
              strokeOpacity={0.28}
              strokeWidth="16"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke={winnerMark === 'X' ? '#43DDE6' : '#FF795E'}
              strokeWidth="7.5"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.6 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
        )}
      </div>
    </div>
  );
}

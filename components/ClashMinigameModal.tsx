'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Crosshair, RotateCcw, Sparkles, Zap } from 'lucide-react';
import { MINIGAME_META, TURN_TAKE_ASSETS } from '@/lib/game/assets';
import { soundEngine } from '@/lib/game/audio';
import {
  generateFlashPattern,
  scoreFlashMemory,
  scorePerfectTiming,
} from '@/lib/game/rules';
import type {
  Mark,
  MinigameId,
  OpponentType,
  PlayerProfile,
} from '@/lib/game/types';

import type { OnlineRound, Trace } from '@/lib/online/contracts';

export interface OnlineChallenge { round:OnlineRound; offset:number; onTrace:(trace:Trace)=>void; busy:boolean; }

interface ClashMinigameModalProps {
  online?: OnlineChallenge;
  round: number;
  minigame: MinigameId;
  opponentType: OpponentType;
  playerX: PlayerProfile;
  playerO: PlayerProfile;
  localRoomMark: Mark;
  xSubmittedScore: number | null;
  oSubmittedScore: number | null;
  lastSummary: {
    round: number;
    minigame: MinigameId;
    xScore: number;
    oScore: number;
    winner: Mark | null;
    bonusTriggered: boolean;
  } | null;
  onSubmitSingleScore: (mark: Mark, score: number) => void;
  onContinueAfterSummary: () => void;
}

interface TargetBubble {
  id: number;
  x: number;
  y: number;
  radius: number;
  points: number;
  isBonus: boolean;
}

function createTargetBatch(count: number): TargetBubble[] {
  const items: TargetBubble[] = [];
  for (let i = 0; i < count; i++) {
    const isBonus = Math.random() < 0.25;
    items.push({
      id: Math.random(),
      x: 15 + Math.random() * 70,
      y: 18 + Math.random() * 64,
      radius: isBonus ? 22 : 26,
      points: isBonus ? 140 : 90,
      isBonus,
    });
  }
  return items;
}

function PerfectTimingStage({
  round,
  activeMark,
  onSubmitScore,
  online,
}: {
  online?: OnlineChallenge;
  round: number;
  activeMark: Mark;
  onSubmitScore: (mark: Mark, score: number) => void;
}) {
  const targetCenterDeg = online?.round.config.targetCenter ?? (round * 73 + 45) % 360;
  const timingEvents=useRef<Array<{t:number}>>([]);
  const [pressCount,setPressCount]=useState(0);
  const [timingLocked, setTimingLocked] = useState(false);
  const needleRef = useRef(0);
  const needleGroupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const speedDegPerSec = online?.round.config.speed ?? 230 + Math.min(round * 14, 110);

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      needleRef.current = online ? Math.max(0,Date.now()+online.offset-Date.parse(online.round.startAt))*speedDegPerSec/1000%360 : (needleRef.current + speedDegPerSec * dt) % 360;
      if (needleGroupRef.current) {
        needleGroupRef.current.setAttribute(
          'transform',
          `rotate(${needleRef.current} 110 110)`
        );
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [round,online?.round.id,online?.offset,online?.round.startAt,online?.round.config.speed]);

  const arcPath = useMemo(() => {
    const startAngle = ((targetCenterDeg - 22 - 90) * Math.PI) / 180;
    const endAngle = ((targetCenterDeg + 22 - 90) * Math.PI) / 180;
    const r = 84;
    const cx = 110;
    const cy = 110;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  }, [targetCenterDeg]);

  const handleLockTiming = useCallback(() => {
    if (timingLocked) return;
    if(online){
      const t=Math.round(Date.now()+online.offset-Date.parse(online.round.startAt));
      if(t<0||t>online.round.config.durationMs||online.busy||t-(timingEvents.current.at(-1)?.t??-1000)<120)return;
      timingEvents.current.push({t});setPressCount(timingEvents.current.length);
      if(timingEvents.current.length===online.round.config.presses){setTimingLocked(true);online.onTrace({version:1,events:[...timingEvents.current]});}
      soundEngine.playTimingHit(scorePerfectTiming(needleRef.current,targetCenterDeg,22));return;
    }
    setTimingLocked(true);
    const score = scorePerfectTiming(needleRef.current, targetCenterDeg, 22);
    soundEngine.playTimingHit(score);
    onSubmitScore(activeMark, score);
  }, [timingLocked, targetCenterDeg, activeMark, onSubmitScore,online]);

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm sm:text-[15px] text-[#CBD5E1] text-center">
        Stop the rotating needle inside the{' '}
        <span className="text-[#FFDA79] font-semibold">gold target arc</span>.
      </p>

      <svg
        viewBox="0 0 220 220"
        className="w-56 h-56 select-none"
        aria-label="Perfect timing dial"
      >
        <circle
          cx="110"
          cy="110"
          r="94"
          fill="#10141D"
          stroke="#65737C"
          strokeOpacity="0.35"
          strokeWidth="2"
        />
        <circle
          cx="110"
          cy="110"
          r="84"
          fill="none"
          stroke="#43DDE6"
          strokeOpacity="0.24"
          strokeWidth="12"
        />
        <path
          d={arcPath}
          fill="none"
          stroke="#FFDA79"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <circle
          cx="110"
          cy="110"
          r="56"
          fill="none"
          stroke="#FF795E"
          strokeOpacity="0.38"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <g ref={needleGroupRef} transform="rotate(0 110 110)">
          <line
            x1="110"
            y1="110"
            x2="110"
            y2="24"
            stroke="#F4F4F0"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="110" cy="24" r="5" fill="#43DDE6" />
        </g>
        <circle cx="110" cy="110" r="9" fill="#F4F4F0" />
      </svg>

      <button
        type="button"
        onClick={handleLockTiming}
        disabled={timingLocked}
        className="btn-arcade-sheen min-h-[48px] px-8 py-3 rounded-xl font-semibold text-sm sm:text-base bg-[#FFDA79] text-[#10141D] hover:bg-[#ffe396] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
      >
        {online?`Lock In Timing (${pressCount}/${online.round.config.presses})`:'Lock In Timing'}
      </button>
    </div>
  );
}

function FlashMemoryStage({
  round,
  activeMark,
  onSubmitScore,
  online,
}: {
  online?: OnlineChallenge;
  round: number;
  activeMark: Mark;
  onSubmitScore: (mark: Mark, score: number) => void;
}) {
  const [memoryPattern] = useState<number[]>(() => online?.round.config.pattern ?? generateFlashPattern(round));
  const [memoryPhase, setMemoryPhase] = useState<'memorize' | 'recall'>(
    'memorize'
  );
  const [memorySelected, setMemorySelected] = useState<number[]>([]);
  const recallStartRef = useRef<number>(0);
  const memoryEvents=useRef<Array<{t:number;cell:number}>>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMemoryPhase('recall');
      recallStartRef.current = performance.now();
    }, online?Math.max(0,Date.parse(online.round.startAt)+(online.round.config.revealMs??1550)-Date.now()-online.offset):1550);
    return () => clearTimeout(timer);
  }, []);

  const toggleMemoryTile = (idx: number) => {
    if (memoryPhase !== 'recall') return;
    if(online){const t=Math.round(Date.now()+online.offset-Date.parse(online.round.startAt));if(t-(memoryEvents.current.at(-1)?.t??-1000)<35||t>online.round.config.durationMs)return;memoryEvents.current.push({t,cell:idx});}
    soundEngine.playMemoryBlip(memorySelected.length);
    setMemorySelected((prev) =>
      prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
    );
  };

  const submitFlashMemory = () => {
    if(online){online.onTrace({version:1,finishedAt:Math.round(Date.now()+online.offset-Date.parse(online.round.startAt)),events:[...memoryEvents.current]});return;}
    const elapsed = performance.now() - recallStartRef.current;
    const score = scoreFlashMemory(memoryPattern, memorySelected, elapsed);
    soundEngine.playTimingHit(score);
    onSubmitScore(activeMark, score);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center justify-between w-full max-w-[260px] text-sm">
        <span className="text-[#CBD5E1]">
          {memoryPhase === 'memorize'
            ? 'Memorize the lit tiles...'
            : `Select ${memoryPattern.length} tiles (${memorySelected.length}/${memoryPattern.length})`}
        </span>
        <span className="font-mono text-xs font-semibold text-[#8B7CFF]">
          {memoryPhase === 'memorize' ? 'WATCH' : 'RECALL'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-64 h-64 p-3 rounded-2xl bg-[#10141D] border border-[#65737C]/30">
        {Array.from({ length: 9 }).map((_, idx) => {
          const isLit =
            memoryPhase === 'memorize' && memoryPattern.includes(idx);
          const isPicked =
            memoryPhase === 'recall' && memorySelected.includes(idx);

          return (
            <button
              key={idx}
              type="button"
              disabled={memoryPhase === 'memorize'}
              onClick={() => toggleMemoryTile(idx)}
              aria-label={`Memory tile ${idx + 1}`}
              className={[
                'rounded-xl border transition-all duration-150 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]',
                isLit
                  ? 'bg-[#8B7CFF] border-[#43DDE6] shadow-[0_0_20px_rgba(139,124,255,0.45)]'
                  : isPicked
                    ? 'bg-[#43DDE6] border-[#F4F4F0] scale-[0.97]'
                    : 'bg-[#192131] border-[#65737C]/35 hover:border-[#8B7CFF]/75 active:scale-95 cursor-pointer',
              ].join(' ')}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={memoryPhase === 'memorize'}
          onClick={() => { setMemorySelected([]);memoryEvents.current=[]; }}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-[#10141D] text-[#CBD5E1] border border-[#65737C]/35 hover:text-[#F4F4F0] disabled:opacity-40 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6]"
        >
          <RotateCcw className="w-4 h-4" />
          Clear
        </button>
        <button
          type="button"
          disabled={memoryPhase === 'memorize' || memorySelected.length === 0}
          onClick={submitFlashMemory}
          className="btn-arcade-sheen min-h-[44px] px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#8B7CFF] text-[#F4F4F0] hover:bg-[#9c8fff] disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
        >
          Submit Recall
        </button>
      </div>
    </div>
  );
}

function TargetRushStage({
  activeMark,
  onSubmitScore,
  online,
}: {
  online?: OnlineChallenge;
  activeMark: Mark;
  onSubmitScore: (mark: Mark, score: number) => void;
}) {
  const [rushTimeLeft, setRushTimeLeft] = useState(5.5);
  const [rushScore, setRushScore] = useState(0);
  const [targets, setTargets] = useState<TargetBubble[]>(() =>
    online ? [] : createTargetBatch(4)
  );
  const rushScoreRef = useRef(0);
  const rushFinishedRef = useRef(false);
  const hitIds=useRef(new Set<number>());
  const rushEvents=useRef<Trace['events']>([]);

  useEffect(() => {
    const start = performance.now();
    const durationMs = online?.round.config.durationMs ?? 5500;
    const interval = setInterval(() => {
      const elapsed = online?Date.now()+online.offset-Date.parse(online.round.startAt):performance.now() - start;
      if(online)setTargets((online.round.config.targets??[]).filter(t=>t.spawn<=elapsed&&t.end>elapsed&&!hitIds.current.has(t.id)).map(t=>({...t,radius:t.points===140?22:26,isBonus:t.points===140})));
      const remaining = Math.max(0, (durationMs - elapsed) / 1000);
      setRushTimeLeft(remaining);
      if (remaining <= 0 && !rushFinishedRef.current) {
        rushFinishedRef.current = true;
        clearInterval(interval);
        if(online)online.onTrace({version:1,events:[...rushEvents.current]});else onSubmitScore(activeMark, rushScoreRef.current);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [activeMark, onSubmitScore,online?.round.id]);

  const handleHitTarget = (target: TargetBubble, event:React.MouseEvent<HTMLButtonElement>) => {
    if (rushFinishedRef.current) return;
    if(online){
      const t=Math.round(Date.now()+online.offset-Date.parse(online.round.startAt));
      if(hitIds.current.has(target.id)||t-(rushEvents.current.at(-1)?.t??-1000)<40||t>online.round.config.durationMs)return;
      const rect=event.currentTarget.parentElement!.getBoundingClientRect();
      const x=event.detail===0?target.x:(event.clientX-rect.left)/rect.width*100;
      const y=event.detail===0?target.y:(event.clientY-rect.top)/rect.height*100;
      rushEvents.current.push({t,targetId:target.id,x,y});hitIds.current.add(target.id);
    }
    soundEngine.playTargetHit(target.isBonus);
    rushScoreRef.current += target.points;
    setRushScore(rushScoreRef.current);
    setTargets((prev) => [
      ...prev.filter((item) => item.id !== target.id),
      ...(online?[]:createTargetBatch(1)),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2 text-[#CBD5E1]">
          <Crosshair className="w-4 h-4 text-[#FF795E]" />
          Tap targets rapidly
        </span>
        <div className="flex items-center gap-4 font-mono">
          <span className="text-[#43DDE6]">Score {rushScore}</span>
          <span className="text-[#FFDA79]">{rushTimeLeft.toFixed(1)}s</span>
        </div>
      </div>

      <div className="relative w-full h-64 sm:h-72 rounded-2xl bg-[#10141D] border border-[#65737C]/35 overflow-hidden select-none touch-manipulation">
        {targets.map((target) => (
          <button
            key={target.id}
            type="button"
            onClick={event => handleHitTarget(target,event)}
            aria-label={target.isBonus ? 'Bonus gold target' : 'Target'}
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
              width: `${target.radius * 2}px`,
              height: `${target.radius * 2}px`,
            }}
            className={[
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center transition-transform active:scale-90 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]',
              target.isBonus
                ? 'bg-[#FFDA79]/25 border-[#FFDA79] text-[#FFDA79]'
                : 'bg-[#FF795E]/25 border-[#FF795E] text-[#43DDE6]',
            ].join(' ')}
          >
            {target.isBonus ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-[#43DDE6]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ClashMinigameModal({
  online,
  round,
  minigame,
  opponentType,
  playerX,
  playerO,
  localRoomMark,
  xSubmittedScore,
  oSubmittedScore,
  lastSummary,
  onSubmitSingleScore,
  onContinueAfterSummary,
}: ClashMinigameModalProps) {
  const meta = MINIGAME_META[minigame];

  const activeMark: Mark =
    opponentType === 'room'
      ? localRoomMark
      : opponentType === 'local' && xSubmittedScore !== null
        ? 'O'
        : 'X';

  const activePlayer = activeMark === 'X' ? playerX : playerO;
  const waitingForRoomOpponent =
    opponentType === 'room' &&
    !lastSummary &&
    ((localRoomMark === 'X' &&
      xSubmittedScore !== null &&
      oSubmittedScore === null) ||
      (localRoomMark === 'O' &&
        oSubmittedScore !== null &&
        xSubmittedScore === null));

  const [confirmedHandoffRound, setConfirmedHandoffRound] = useState<
    number | null
  >(null);

  const needsLocalHandoff =
    opponentType === 'local' &&
    !lastSummary &&
    xSubmittedScore !== null &&
    oSubmittedScore === null &&
    confirmedHandoffRound !== round;

  const stageKey = `${online?.round.id??round}-${minigame}-${activeMark}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Clash Round ${round}: ${meta.title}`}
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#0B0E15]/85"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl rounded-3xl bg-[#151B28] border border-[#65737C]/40 p-5 sm:p-7 shadow-[0_28px_80px_rgba(0,0,0,0.68)] overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
        >
          <div className="clash-edge-sheen h-full w-1/2" />
        </div>

        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#65737C]/25">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={meta.cardSrc}
              alt={meta.title}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl object-cover border border-[#65737C]/35 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-[#94A3B8]">
                Clash Round {round} · Minigame
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F4F4F0] truncate">
                {meta.title}
              </h2>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-[#94A3B8]">Active Challenger</p>
            <p
              className="text-sm sm:text-base font-semibold"
              style={{ color: activeMark === 'X' ? '#43DDE6' : '#FF795E' }}
            >
              {activePlayer.name} ({activeMark})
            </p>
          </div>
        </div>

        {lastSummary ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="py-6 text-center space-y-5"
          >
            {lastSummary.bonusTriggered && (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={TURN_TAKE_ASSETS.streakBonus}
                  alt="Two-win streak bonus"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 object-contain"
                />
                <p className="font-display text-lg font-bold text-[#FFDA79]">
                  Two-Win Streak Bonus! 2 Board Placements Earned
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              <div
                className={[
                  'p-4 rounded-2xl border',
                  lastSummary.winner === 'X'
                    ? 'bg-[#43DDE6]/12 border-[#43DDE6]/65'
                    : 'bg-[#10141D] border-[#65737C]/25',
                ].join(' ')}
              >
                <p className="text-xs sm:text-sm text-[#94A3B8]">
                  {playerX.name} (X)
                </p>
                <p className="font-mono text-2xl font-bold text-[#43DDE6] mt-1">
                  {lastSummary.xScore}
                </p>
              </div>

              <div
                className={[
                  'p-4 rounded-2xl border',
                  lastSummary.winner === 'O'
                    ? 'bg-[#FF795E]/12 border-[#FF795E]/65'
                    : 'bg-[#10141D] border-[#65737C]/25',
                ].join(' ')}
              >
                <p className="text-xs sm:text-sm text-[#94A3B8]">
                  {playerO.name} (O)
                </p>
                <p className="font-mono text-2xl font-bold text-[#FF795E] mt-1">
                  {lastSummary.oScore}
                </p>
              </div>
            </div>

            <p className="text-base font-medium text-[#F4F4F0]">
              {lastSummary.winner === null
                ? 'Exact tie! Replay this Clash round to break the deadlock.'
                : `${lastSummary.winner === 'X' ? playerX.name : playerO.name} wins the Clash!`}
            </p>

            <button
              type="button"
              onClick={onContinueAfterSummary}
              className="btn-arcade-sheen min-h-[46px] px-7 py-3 rounded-xl font-semibold text-sm sm:text-base bg-[#43DDE6] text-[#10141D] hover:bg-[#5ce5ec] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
            >
              {lastSummary.winner === null
                ? 'Replay Clash'
                : opponentType === 'bot' && lastSummary.winner === 'O'
                  ? 'Continue'
                  : 'Place on Board'}
            </button>
          </motion.div>
        ) : waitingForRoomOpponent ? (
          <div className="py-10 text-center space-y-3">
            <Zap className="w-8 h-8 text-[#FFDA79] mx-auto" />
            <p className="font-display text-lg font-semibold text-[#F4F4F0]">
              {online?'Attempt submitted': 'Score Locked:'}{' '}
              <span className="font-mono text-[#43DDE6]">
                {online?'':localRoomMark === 'X' ? xSubmittedScore : oSubmittedScore}
              </span>
            </p>
            <p className="text-sm text-[#94A3B8]">
              Waiting for your opponent to finish {meta.title}...
            </p>
          </div>
        ) : online && Date.now()+online.offset<Date.parse(online.round.startAt) ? (<p role="status" className="py-12 text-center text-3xl text-[#FFDA79]">Clash starts in {Math.ceil((Date.parse(online.round.startAt)-Date.now()-online.offset)/1000)}</p>) : needsLocalHandoff ? (
          <div className="py-10 text-center space-y-5">
            <p className="text-sm text-[#94A3B8]">
              {playerX.name} scored{' '}
              <span className="font-mono font-bold text-[#43DDE6]">
                {xSubmittedScore}
              </span>
            </p>
            <h3 className="font-display text-2xl font-bold text-[#F4F4F0]">
              Pass Controls to {playerO.name} (O)
            </h3>
            <button
              type="button"
              onClick={() => setConfirmedHandoffRound(round)}
              className="btn-arcade-sheen min-h-[46px] px-6 py-3 rounded-xl font-semibold text-sm sm:text-base bg-[#FF795E] text-[#10141D] hover:bg-[#ff8d76] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F4F0]"
            >
              Ready for {playerO.name}
            </button>
          </div>
        ) : (
          <div className="pt-5">
            {minigame === 'perfect-timing' && (
              <PerfectTimingStage
                key={stageKey}
                round={round}
                activeMark={activeMark}
                online={online}
                onSubmitScore={onSubmitSingleScore}
              />
            )}
            {minigame === 'flash-memory' && (
              <FlashMemoryStage
                key={stageKey}
                round={round}
                activeMark={activeMark}
                online={online}
                onSubmitScore={onSubmitSingleScore}
              />
            )}
            {minigame === 'target-rush' && (
              <TargetRushStage
                key={stageKey}
                activeMark={activeMark}
                online={online}
                onSubmitScore={onSubmitSingleScore}
              />
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

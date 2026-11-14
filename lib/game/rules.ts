import type {
  BoardState,
  BotDifficulty,
  ClashResolution,
  Mark,
  MinigameId,
  MinigameSelection,
  StreakState,
  WinResult,
} from './types';

export const WINNING_LINES: readonly number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createEmptyBoard(): BoardState {
  return Array<Mark | null>(9).fill(null);
}

export function getAvailableMoves(board: BoardState): number[] {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) moves.push(i);
  }
  return moves;
}

export function checkWinner(board: BoardState): WinResult {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const val = board[a];
    if (val && val === board[b] && val === board[c]) {
      return { winner: val, line };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }
  return { winner: null, line: null };
}

function findImmediateWinningMove(board: BoardState, mark: Mark): number | null {
  for (const idx of getAvailableMoves(board)) {
    const next = [...board];
    next[idx] = mark;
    if (checkWinner(next).winner === mark) {
      return idx;
    }
  }
  return null;
}

function minimax(
  board: BoardState,
  depth: number,
  isMaximizing: boolean,
  botMark: Mark,
  humanMark: Mark,
  alpha: number,
  beta: number
): number {
  const { winner } = checkWinner(board);
  if (winner === botMark) return 10 - depth;
  if (winner === humanMark) return depth - 10;
  if (winner === 'draw') return 0;

  const available = getAvailableMoves(board);

  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of available) {
      board[idx] = botMark;
      const score = minimax(board, depth + 1, false, botMark, humanMark, alpha, beta);
      board[idx] = null;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const idx of available) {
      board[idx] = humanMark;
      const score = minimax(board, depth + 1, true, botMark, humanMark, alpha, beta);
      board[idx] = null;
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function chooseBotMove(
  board: BoardState,
  botMark: Mark,
  difficulty: BotDifficulty = 'tactical',
  rng: () => number = Math.random
): number {
  const available = getAvailableMoves(board);
  if (available.length === 0) return -1;

  const humanMark: Mark = botMark === 'X' ? 'O' : 'X';

  if (difficulty === 'casual') {
    const winMove = findImmediateWinningMove(board, botMark);
    if (winMove !== null && rng() < 0.6) return winMove;
    return available[Math.floor(rng() * available.length)];
  }

  if (difficulty === 'tactical') {
    const winMove = findImmediateWinningMove(board, botMark);
    if (winMove !== null) return winMove;

    const blockMove = findImmediateWinningMove(board, humanMark);
    if (blockMove !== null) return blockMove;

    if (board[4] === null && rng() < 0.65) return 4;
    if (rng() < 0.55) {
      const strategic = [0, 2, 6, 8].filter((idx) => board[idx] === null);
      if (strategic.length > 0) {
        return strategic[Math.floor(rng() * strategic.length)];
      }
    }
    return available[Math.floor(rng() * available.length)];
  }

  // Master difficulty: optimal minimax
  if (available.length === 9) {
    return 4;
  }

  const working = [...board];
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const idx of available) {
    working[idx] = botMark;
    const score = minimax(working, 0, false, botMark, humanMark, -Infinity, Infinity);
    working[idx] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [idx];
    } else if (score === bestScore) {
      bestMoves.push(idx);
    }
  }

  return bestMoves[Math.floor(rng() * bestMoves.length)] ?? available[0];
}

const MINIGAME_ROTATION: MinigameId[] = [
  'perfect-timing',
  'flash-memory',
  'target-rush',
];

export function pickNextMinigame(
  selection: MinigameSelection,
  roundIndex: number
): MinigameId {
  if (selection !== 'rotating') return selection;
  const idx = Math.max(0, roundIndex - 1) % MINIGAME_ROTATION.length;
  return MINIGAME_ROTATION[idx];
}

export function resolveClashRound(
  xScore: number,
  oScore: number,
  streaks: StreakState,
  remainingCells: number
): ClashResolution {
  if (xScore === oScore) {
    return {
      winner: null,
      isTie: true,
      placementsAwarded: 0,
      bonusTriggered: false,
      nextStreaks: { ...streaks },
    };
  }

  const winner: Mark = xScore > oScore ? 'X' : 'O';
  const nextCount = streaks[winner] + 1;
  const bonusTriggered = nextCount >= 2;
  const rawPlacements = bonusTriggered ? 2 : 1;
  const placementsAwarded = Math.min(rawPlacements, Math.max(0, remainingCells));

  const nextStreaks: StreakState = bonusTriggered
    ? { X: 0, O: 0 }
    : winner === 'X'
      ? { X: nextCount, O: 0 }
      : { X: 0, O: nextCount };

  return {
    winner,
    isTie: false,
    placementsAwarded,
    bonusTriggered,
    nextStreaks,
  };
}

export function scorePerfectTiming(
  needleAngleDeg: number,
  targetCenterDeg: number,
  targetHalfWidthDeg = 22
): number {
  const rawDiff = ((needleAngleDeg - targetCenterDeg + 540) % 360) - 180;
  const diff = Math.abs(rawDiff);

  if (diff <= targetHalfWidthDeg) {
    const precision = 1 - diff / targetHalfWidthDeg;
    return Math.round(700 + precision * 300);
  }

  const missPenalty = Math.min(1, (diff - targetHalfWidthDeg) / 95);
  return Math.max(40, Math.round(620 * (1 - missPenalty)));
}

export function generateFlashPattern(
  roundNumber: number,
  rng: () => number = Math.random
): number[] {
  const count = roundNumber <= 2 ? 3 : roundNumber <= 5 ? 4 : 5;
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function scoreFlashMemory(
  targetPattern: number[],
  selectedIndices: number[],
  elapsedMs: number
): number {
  if (targetPattern.length === 0) return 0;
  const targetSet = new Set(targetPattern);
  const uniqueSelected = Array.from(new Set(selectedIndices));

  let hits = 0;
  let misses = 0;
  for (const idx of uniqueSelected) {
    if (targetSet.has(idx)) hits++;
    else misses++;
  }

  const accuracyRatio = Math.max(0, (hits - misses * 0.5) / targetPattern.length);
  const perfectMatch = hits === targetPattern.length && misses === 0;
  const speedBonus = perfectMatch
    ? Math.max(0, Math.min(200, Math.round(200 - elapsedMs / 35)))
    : 0;

  return Math.max(0, Math.round(accuracyRatio * 800 + speedBonus));
}

export function generateBotClashScore(
  minigame: MinigameId,
  difficulty: BotDifficulty,
  rng: () => number = Math.random
): number {
  const ranges: Record<BotDifficulty, [number, number]> = {
    casual: [360, 690],
    tactical: [540, 840],
    master: [700, 940],
  };

  const [min, max] = ranges[difficulty];
  const base = min + rng() * (max - min);

  if (minigame === 'target-rush') {
    // Target rush increments in clean 20-pt arcade steps
    return Math.round(base / 20) * 20;
  }
  return Math.round(base);
}

export function generateRoomCode(rng: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return code;
}

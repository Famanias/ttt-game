import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkWinner,
  chooseBotMove,
  createEmptyBoard,
  generateFlashPattern,
  pickNextMinigame,
  resolveClashRound,
  scoreFlashMemory,
  scorePerfectTiming,
} from './rules';
import type { BoardState } from './types';

test('all eight winning triples recognize both marks without mutating the board', () => {
  const triples = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const mark of ['X', 'O'] as const) {
    for (const triple of triples) {
      const board = createEmptyBoard();
      triple.forEach(i => { board[i] = mark; });
      const original = [...board];
      assert.deepEqual(checkWinner(board), { winner: mark, line: triple });
      assert.deepEqual(board, original);
    }
  }
});

test('all bot difficulties choose an empty cell and preserve the caller board', () => {
  const board: BoardState = ['X', null, null, null, 'O', null, null, null, 'X'];
  for (const difficulty of ['casual', 'tactical', 'master'] as const) {
    const original = [...board];
    const index = chooseBotMove(board, 'O', difficulty, () => 0.5);
    assert.equal(board[index], null);
    assert.deepEqual(board, original);
  }
});

test('alternating Clash winners break the previous streak; ties never grant a cell', () => {
  assert.deepEqual(resolveClashRound(10, 20, { X: 1, O: 0 }, 9).nextStreaks, { X: 0, O: 1 });
  assert.equal(resolveClashRound(20, 20, { X: 1, O: 0 }, 9).placementsAwarded, 0);
  assert.equal(resolveClashRound(20, 10, { X: 1, O: 0 }, 1).placementsAwarded, 1);
});

test('checkWinner detects horizontal, vertical, diagonal, and draw states', () => {
  const rowWin: BoardState = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
  assert.deepEqual(checkWinner(rowWin), { winner: 'X', line: [0, 1, 2] });

  const colWin: BoardState = ['O', 'X', null, 'O', 'X', null, 'O', null, 'X'];
  assert.deepEqual(checkWinner(colWin), { winner: 'O', line: [0, 3, 6] });

  const diagWin: BoardState = ['X', 'O', null, null, 'X', 'O', null, null, 'X'];
  assert.deepEqual(checkWinner(diagWin), { winner: 'X', line: [0, 4, 8] });

  const drawBoard: BoardState = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
  assert.deepEqual(checkWinner(drawBoard), { winner: 'draw', line: null });

  assert.deepEqual(checkWinner(createEmptyBoard()), { winner: null, line: null });
});

test('master minimax bot takes immediate win and blocks opponent threats', () => {
  const winningOpportunity: BoardState = ['O', 'O', null, 'X', 'X', null, null, null, null];
  assert.equal(chooseBotMove(winningOpportunity, 'O', 'master'), 2);

  const urgentBlock: BoardState = ['X', 'X', null, null, 'O', null, null, null, null];
  assert.equal(chooseBotMove(urgentBlock, 'O', 'master'), 2);
});

test('resolveClashRound awards 1 placement normally and 2 placements on 2 consecutive wins', () => {
  const firstWin = resolveClashRound(820, 610, { X: 0, O: 0 }, 9);
  assert.equal(firstWin.winner, 'X');
  assert.equal(firstWin.placementsAwarded, 1);
  assert.equal(firstWin.bonusTriggered, false);
  assert.deepEqual(firstWin.nextStreaks, { X: 1, O: 0 });

  const secondConsecutiveWin = resolveClashRound(750, 500, firstWin.nextStreaks, 8);
  assert.equal(secondConsecutiveWin.winner, 'X');
  assert.equal(secondConsecutiveWin.placementsAwarded, 2);
  assert.equal(secondConsecutiveWin.bonusTriggered, true);
  assert.deepEqual(secondConsecutiveWin.nextStreaks, { X: 0, O: 0 });
});

test('resolveClashRound clamps bonus placement to remaining board cells and handles ties', () => {
  const clamped = resolveClashRound(900, 400, { X: 1, O: 0 }, 1);
  assert.equal(clamped.placementsAwarded, 1);
  assert.equal(clamped.bonusTriggered, true);

  const tie = resolveClashRound(700, 700, { X: 1, O: 0 }, 5);
  assert.equal(tie.isTie, true);
  assert.equal(tie.winner, null);
  assert.equal(tie.placementsAwarded, 0);
  assert.deepEqual(tie.nextStreaks, { X: 1, O: 0 });
});

test('pickNextMinigame rotates deterministically across all 3 arcade challenges', () => {
  assert.equal(pickNextMinigame('rotating', 1), 'perfect-timing');
  assert.equal(pickNextMinigame('rotating', 2), 'flash-memory');
  assert.equal(pickNextMinigame('rotating', 3), 'target-rush');
  assert.equal(pickNextMinigame('rotating', 4), 'perfect-timing');
  assert.equal(pickNextMinigame('flash-memory', 3), 'flash-memory');
});

test('scorePerfectTiming scores bullseye highest and handles wrap-around 360/0', () => {
  const bullseye = scorePerfectTiming(2, 359, 22);
  const miss = scorePerfectTiming(180, 0, 22);
  assert.ok(bullseye >= 950);
  assert.ok(miss < 300);
});

test('generateFlashPattern and scoreFlashMemory reward exact fast recall', () => {
  const pattern = generateFlashPattern(1, () => 0.42);
  assert.equal(pattern.length, 3);
  assert.equal(new Set(pattern).size, 3);

  const fastPerfect = scoreFlashMemory([0, 4, 8], [0, 4, 8], 1200);
  const partial = scoreFlashMemory([0, 4, 8], [0, 1, 8], 2000);
  assert.ok(fastPerfect > 900);
  assert.ok(partial < fastPerfect);
});

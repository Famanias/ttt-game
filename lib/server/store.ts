import {
  checkWinner,
  createEmptyBoard,
  generateRoomCode,
  getAvailableMoves,
  pickNextMinigame,
  resolveClashRound,
} from '@/lib/game/rules';
import type {
  AvatarId,
  GameMode,
  LeaderboardEntry,
  Mark,
  MinigameSelection,
  PlayerProfile,
  RoomState,
} from '@/lib/game/types';

interface TurnTakeStore {
  rooms: Map<string, RoomState>;
  leaderboard: LeaderboardEntry[];
}

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-kael',
    name: 'Kaelen',
    avatarId: 'comet-mask',
    wins: 14,
    losses: 4,
    draws: 2,
    bestStreak: 4,
    clashWins: 9,
    classicWins: 5,
    updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'seed-mira',
    name: 'Mira_V',
    avatarId: 'orb-bot',
    wins: 11,
    losses: 5,
    draws: 3,
    bestStreak: 3,
    clashWins: 6,
    classicWins: 5,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'seed-soren',
    name: 'Soren',
    avatarId: 'shield-face',
    wins: 9,
    losses: 6,
    draws: 1,
    bestStreak: 2,
    clashWins: 4,
    classicWins: 5,
    updatedAt: Date.now() - 3600000 * 12,
  },
  {
    id: 'seed-nova',
    name: 'Nova7',
    avatarId: 'spark-eye',
    wins: 7,
    losses: 5,
    draws: 2,
    bestStreak: 2,
    clashWins: 5,
    classicWins: 2,
    updatedAt: Date.now() - 3600000 * 5,
  },
  {
    id: 'seed-jun',
    name: 'Jun_K',
    avatarId: 'pixel-blob',
    wins: 5,
    losses: 4,
    draws: 1,
    bestStreak: 1,
    clashWins: 2,
    classicWins: 3,
    updatedAt: Date.now() - 3600000 * 2,
  },
];

const globalForStore = globalThis as unknown as {
  __turnTakeStore?: TurnTakeStore;
};

function getStore(): TurnTakeStore {
  if (!globalForStore.__turnTakeStore) {
    globalForStore.__turnTakeStore = {
      rooms: new Map<string, RoomState>(),
      leaderboard: [...INITIAL_LEADERBOARD],
    };
  }
  return globalForStore.__turnTakeStore;
}

function pruneOldRooms() {
  const store = getStore();
  const cutoff = Date.now() - 1000 * 60 * 60 * 4;
  for (const [code, room] of store.rooms.entries()) {
    if (room.updatedAt < cutoff) {
      store.rooms.delete(code);
    }
  }
}

export function createRoom(params: {
  player: PlayerProfile;
  mode: GameMode;
  minigameSelection: MinigameSelection;
}): RoomState {
  pruneOldRooms();
  const store = getStore();

  let code = generateRoomCode();
  while (store.rooms.has(code)) {
    code = generateRoomCode();
  }

  const room: RoomState = {
    code,
    mode: params.mode,
    minigameSelection: params.minigameSelection,
    status: 'waiting',
    board: createEmptyBoard(),
    currentTurn: 'X',
    startingMark: 'X',
    winner: null,
    winningLine: null,
    players: {
      X: params.player,
      O: null,
    },
    scores: {
      X: 0,
      O: 0,
      draws: 0,
    },
    moveCount: 0,
    clashRound: 1,
    clashStreaks: { X: 0, O: 0 },
    pendingPlacements: 0,
    pendingPlacer: null,
    activeMinigame: pickNextMinigame(params.minigameSelection, 1),
    clashSubmissions: { X: null, O: null },
    lastClashSummary: null,
    updatedAt: Date.now(),
  };

  store.rooms.set(code, room);
  return room;
}

export function getRoom(code: string): RoomState | null {
  const store = getStore();
  return store.rooms.get(code.toUpperCase().trim()) ?? null;
}

export function joinRoom(
  code: string,
  player: PlayerProfile
): { room?: RoomState; error?: string; status?: number } {
  const store = getStore();
  const key = code.toUpperCase().trim();
  const room = store.rooms.get(key);
  if (!room) {
    return { error: 'Room not found. Check your invite code.', status: 404 };
  }

  if (room.players.O && room.players.O.name !== player.name) {
    return { error: 'Room already has two players.', status: 409 };
  }

  room.players.O = player;
  if (room.status === 'waiting') {
    room.status = 'active';
  }
  room.updatedAt = Date.now();
  return { room };
}

export function submitRoomMove(
  code: string,
  mark: Mark,
  cellIndex: number
): { room?: RoomState; error?: string; status?: number } {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found.', status: 404 };
  if (room.status !== 'active') {
    return { error: 'Match is not active.', status: 400 };
  }
  if (cellIndex < 0 || cellIndex > 8 || room.board[cellIndex] !== null) {
    return { error: 'Cell is unavailable.', status: 400 };
  }

  if (room.mode === 'classic') {
    if (room.currentTurn !== mark) {
      return { error: 'Not your turn.', status: 400 };
    }
    room.board[cellIndex] = mark;
    room.moveCount += 1;

    const result = checkWinner(room.board);
    if (result.winner) {
      room.winner = result.winner;
      room.winningLine = result.line;
      room.status = 'finished';
      if (result.winner === 'X') room.scores.X += 1;
      else if (result.winner === 'O') room.scores.O += 1;
      else room.scores.draws += 1;
    } else {
      room.currentTurn = mark === 'X' ? 'O' : 'X';
    }
    room.updatedAt = Date.now();
    return { room };
  }

  // Clash placement
  if (room.pendingPlacer !== mark || room.pendingPlacements <= 0) {
    return { error: 'No pending Clash placement for this player.', status: 400 };
  }

  room.board[cellIndex] = mark;
  room.moveCount += 1;
  room.pendingPlacements -= 1;

  const result = checkWinner(room.board);
  if (result.winner) {
    room.winner = result.winner;
    room.winningLine = result.line;
    room.status = 'finished';
    room.pendingPlacements = 0;
    if (result.winner === 'X') room.scores.X += 1;
    else if (result.winner === 'O') room.scores.O += 1;
    else room.scores.draws += 1;
  } else if (room.pendingPlacements === 0) {
    room.pendingPlacer = null;
    room.clashRound += 1;
    room.activeMinigame = pickNextMinigame(room.minigameSelection, room.clashRound);
    room.clashSubmissions = { X: null, O: null };
  }

  room.updatedAt = Date.now();
  return { room };
}

export function submitRoomClashScore(
  code: string,
  mark: Mark,
  score: number
): { room?: RoomState; error?: string; status?: number } {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found.', status: 404 };
  if (room.status !== 'active' || room.mode !== 'clash') {
    return { error: 'Clash round not active.', status: 400 };
  }
  if (room.pendingPlacements > 0) {
    return { error: 'Waiting for board placement.', status: 400 };
  }

  room.clashSubmissions[mark] = Math.max(0, Math.round(score));

  const xScore = room.clashSubmissions.X;
  const oScore = room.clashSubmissions.O;

  if (xScore !== null && oScore !== null) {
    const remaining = getAvailableMoves(room.board).length;
    const resolution = resolveClashRound(
      xScore,
      oScore,
      room.clashStreaks,
      remaining
    );

    room.lastClashSummary = {
      round: room.clashRound,
      minigame: room.activeMinigame,
      xScore,
      oScore,
      winner: resolution.winner,
      bonusTriggered: resolution.bonusTriggered,
    };

    if (resolution.isTie) {
      room.clashSubmissions = { X: null, O: null };
    } else {
      room.clashStreaks = resolution.nextStreaks;
      room.pendingPlacer = resolution.winner;
      room.pendingPlacements = resolution.placementsAwarded;
      room.currentTurn = resolution.winner ?? room.currentTurn;
    }
  }

  room.updatedAt = Date.now();
  return { room };
}

export function rematchRoom(code: string): RoomState | null {
  const room = getRoom(code);
  if (!room) return null;

  const nextStarter: Mark = room.startingMark === 'X' ? 'O' : 'X';
  room.startingMark = nextStarter;
  room.currentTurn = nextStarter;
  room.board = createEmptyBoard();
  room.winner = null;
  room.winningLine = null;
  room.status = room.players.O ? 'active' : 'waiting';
  room.moveCount = 0;
  room.clashRound = 1;
  room.clashStreaks = { X: 0, O: 0 };
  room.pendingPlacements = 0;
  room.pendingPlacer = null;
  room.activeMinigame = pickNextMinigame(room.minigameSelection, 1);
  room.clashSubmissions = { X: null, O: null };
  room.lastClashSummary = null;
  room.updatedAt = Date.now();
  return room;
}

export function getLeaderboard(): LeaderboardEntry[] {
  const store = getStore();
  return [...store.leaderboard]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 15);
}

export function recordLeaderboardMatch(params: {
  name: string;
  avatarId: AvatarId;
  outcome: 'win' | 'loss' | 'draw';
  mode: GameMode;
  streakAchieved: number;
}): LeaderboardEntry[] {
  const store = getStore();
  const cleanName = params.name.trim().slice(0, 18) || 'Player';
  const existing = store.leaderboard.find(
    (entry) => entry.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (existing) {
    existing.avatarId = params.avatarId;
    if (params.outcome === 'win') {
      existing.wins += 1;
      if (params.mode === 'clash') existing.clashWins += 1;
      else existing.classicWins += 1;
    } else if (params.outcome === 'loss') {
      existing.losses += 1;
    } else {
      existing.draws += 1;
    }
    existing.bestStreak = Math.max(existing.bestStreak, params.streakAchieved);
    existing.updatedAt = Date.now();
  } else {
    store.leaderboard.push({
      id: `player-${Date.now()}`,
      name: cleanName,
      avatarId: params.avatarId,
      wins: params.outcome === 'win' ? 1 : 0,
      losses: params.outcome === 'loss' ? 1 : 0,
      draws: params.outcome === 'draw' ? 1 : 0,
      bestStreak: params.streakAchieved,
      clashWins: params.outcome === 'win' && params.mode === 'clash' ? 1 : 0,
      classicWins: params.outcome === 'win' && params.mode === 'classic' ? 1 : 0,
      updatedAt: Date.now(),
    });
  }

  return getLeaderboard();
}

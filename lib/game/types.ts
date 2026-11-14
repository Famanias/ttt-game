export type Mark = 'X' | 'O';
export type CellValue = Mark | null;
export type BoardState = CellValue[]; // length 9

export type GameMode = 'classic' | 'clash';
export type OpponentType = 'bot' | 'local' | 'room';
export type BotDifficulty = 'casual' | 'tactical' | 'master';

export type MinigameId = 'perfect-timing' | 'flash-memory' | 'target-rush';
export type MinigameSelection = MinigameId | 'rotating';

export type AvatarId =
  | 'orb-bot'
  | 'pixel-blob'
  | 'shield-face'
  | 'cube-runner'
  | 'spark-eye'
  | 'comet-mask';

export type GameScreen = 'title' | 'waiting' | 'playing' | 'gameover';

export interface PlayerProfile {
  name: string;
  avatarId: AvatarId;
}

export interface WinResult {
  winner: Mark | 'draw' | null;
  line: number[] | null;
}

export interface StreakState {
  X: number;
  O: number;
}

export interface ClashResolution {
  winner: Mark | null;
  isTie: boolean;
  placementsAwarded: number;
  bonusTriggered: boolean;
  nextStreaks: StreakState;
}

export interface ClashRoundHistory {
  round: number;
  minigame: MinigameId;
  xScore: number;
  oScore: number;
  winner: Mark | null;
  bonusTriggered: boolean;
}

export interface RoomState {
  code: string;
  mode: GameMode;
  minigameSelection: MinigameSelection;
  status: 'waiting' | 'active' | 'finished';
  board: BoardState;
  currentTurn: Mark;
  startingMark: Mark;
  winner: Mark | 'draw' | null;
  winningLine: number[] | null;
  players: {
    X: PlayerProfile;
    O: PlayerProfile | null;
  };
  scores: {
    X: number;
    O: number;
    draws: number;
  };
  moveCount: number;
  clashRound: number;
  clashStreaks: StreakState;
  pendingPlacements: number;
  pendingPlacer: Mark | null;
  activeMinigame: MinigameId;
  clashSubmissions: {
    X: number | null;
    O: number | null;
  };
  lastClashSummary: {
    round: number;
    minigame: MinigameId;
    xScore: number;
    oScore: number;
    winner: Mark | null;
    bonusTriggered: boolean;
  } | null;
  updatedAt: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarId: AvatarId;
  wins: number;
  losses: number;
  draws: number;
  bestStreak: number;
  clashWins: number;
  classicWins: number;
  updatedAt: number;
}

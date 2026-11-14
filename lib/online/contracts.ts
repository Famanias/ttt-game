import { z } from 'zod';
import type { AvatarId, BoardState, GameMode, Mark, PlayerProfile, RoomState } from '../game/types';

export const avatarIds = ['orb-bot','pixel-blob','shield-face','cube-runner','spark-eye','comet-mask'] as const;
export const roomCode = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const receipt = { clientCommandId: z.uuid() };
const version = { ...receipt, expectedVersion: z.number().int().nonnegative() };
export const schemas = {
  create: z.object({ ...receipt, mode: z.enum(['classic','clash']) }).strict(),
  join: z.object(receipt).strict(),
  profile: z.object({ ...receipt, name: z.string().trim().min(2).max(18).regex(/^[A-Za-z0-9 _.-]+$/), avatarId: z.enum(avatarIds), publicLeaderboard: z.boolean() }).strict(),
  ready: z.object({ ...version, ready: z.boolean() }).strict(),
  leave: z.object(version).strict(),
  heartbeat: z.object(receipt).strict(),
  move: z.object({ ...version, cellIndex: z.number().int().min(0).max(8) }).strict(),
  rematch: z.object({ ...version, accepted: z.boolean() }).strict(),
  submit: z.object({ ...version, roundId: z.uuid(), trace: z.object({ version: z.literal(1), finishedAt: z.number().int().min(0).max(20000).optional(), events: z.array(z.object({ t: z.number().int().min(0).max(20000), cell: z.number().int().min(0).max(8).optional(), targetId: z.number().int().min(-1).max(79).optional(), x: z.number().min(0).max(100).optional(), y: z.number().min(0).max(100).optional() }).strict()).max(80) }).strict() }).strict(),
} as const;
export type Mutation = keyof typeof schemas;
export type Trace = z.infer<typeof schemas.submit>['trace'];
export interface OnlineRound {
  id: string; index: number; type: 'perfect-timing'|'flash-memory'|'target-rush'; seed: number;
  startAt: string; endAt: string; submitBy: string; status: string; suddenDeath: boolean;
  config: { durationMs: number; presses?: number; targetCenter?: number; speed?: number; pattern?: number[]; revealMs?: number; targets?: Array<{id:number;x:number;y:number;spawn:number;end:number;points:number}> };
  submitted: { X:boolean; O:boolean }; scores: { X:number; O:number } | null;
}
export interface OnlineMatch {
  id:string; version:number; phase:'countdown'|'classic_turn'|'round'|'claim'|'paused'|'finished';
  board:BoardState; turn:Mark; winner:Mark|'draw'|'abandoned'|null; winningLine:number[]|null;
  moveCount:number; streaks:{X:number;O:number}; pendingClaims:number; claimant:Mark|null;
  round:OnlineRound|null; startAt:string; deadlineAt:string|null; reconnectDeadline:string|null; reason:string|null;
  rematchVotes: Array<{userId:string;accepted:boolean}>;
}
export interface OnlineRoom {
  id:string; code:string; mode:GameMode; status:'waiting'|'active'|'finished'|'closed'; version:number; myMark:Mark;
  members:Array<{userId:string;slot:Mark;ready:boolean;lastSeenAt:string;profile:PlayerProfile}>;
  match:OnlineMatch|null; serverNow:string; expiresAt:string;
}

export function adaptRoom(dto: OnlineRoom): RoomState {
  const m=dto.match;
  return { code:dto.code, mode:dto.mode, minigameSelection:'rotating', status:dto.status==='closed'?'waiting':dto.status,
    board:m?.board ?? Array(9).fill(null), currentTurn:m?.turn ?? 'X', startingMark:'X',
    winner:m?.winner==='abandoned'?'draw':m?.winner ?? null, winningLine:m?.winningLine ?? null,
    players:{X:dto.members.find(p=>p.slot==='X')?.profile ?? {name:'Host',avatarId:'orb-bot'},O:dto.members.find(p=>p.slot==='O')?.profile ?? null},
    scores:{X:0,O:0,draws:0}, moveCount:m?.moveCount ?? 0,clashRound:m?.round?.index ?? 1,
    clashStreaks:m?.streaks ?? {X:0,O:0},pendingPlacements:m?.pendingClaims ?? 0,pendingPlacer:m?.claimant ?? null,
    activeMinigame:m?.round?.type ?? 'perfect-timing',clashSubmissions:{X:m?.round?.submitted.X?0:null,O:m?.round?.submitted.O?0:null},
    lastClashSummary:null,updatedAt:Date.parse(dto.serverNow) };
}
export type PublicProfile = {name:string;avatarId:AvatarId;publicLeaderboard:boolean};

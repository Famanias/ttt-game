import type { AvatarId, MinigameId } from './types';

export const TURN_TAKE_ASSETS = {
  lobbyBackground: '/assets/turn-take/01-lobby-background.webp',
  boardBackground: '/assets/turn-take/02-board-background.webp',
  waitingRoomBackground: '/assets/turn-take/10-waiting-room.webp',
  victoryBurst: '/assets/turn-take/06-victory-burst.png',
  streakBonus: '/assets/turn-take/07-streak-bonus.png',
  drawEmblem: '/assets/turn-take/11-draw-emblem.png',
  inviteConnection: '/assets/turn-take/12-invite-connection.png',
  ornaments: {
    reticleCyan: '/assets/turn-take/ornaments/reticle-cyan.png',
    orbitalViolet: '/assets/turn-take/ornaments/orbital-violet.png',
    chevronRush: '/assets/turn-take/ornaments/chevron-rush.png',
    frameCorners: '/assets/turn-take/ornaments/frame-corners.png',
    clashDiamond: '/assets/turn-take/ornaments/clash-diamond.png',
    telemetryRibbons: '/assets/turn-take/ornaments/telemetry-ribbons.png',
    concentricDial: '/assets/turn-take/ornaments/concentric-dial.png',
    boardBrackets: '/assets/turn-take/ornaments/board-brackets.png',
  },
} as const;

export interface AvatarOption {
  id: AvatarId;
  label: string;
  src: string;
  accentHex: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'orb-bot',
    label: 'Orb Bot',
    src: '/assets/turn-take/08a-avatar-orb-bot.png',
    accentHex: '#43DDE6',
  },
  {
    id: 'pixel-blob',
    label: 'Pixel Blob',
    src: '/assets/turn-take/08b-avatar-pixel-blob.png',
    accentHex: '#8B7CFF',
  },
  {
    id: 'shield-face',
    label: 'Shield Face',
    src: '/assets/turn-take/08c-avatar-shield-face.png',
    accentHex: '#FF795E',
  },
  {
    id: 'cube-runner',
    label: 'Cube Runner',
    src: '/assets/turn-take/08d-avatar-cube-runner.png',
    accentHex: '#43DDE6',
  },
  {
    id: 'spark-eye',
    label: 'Spark Eye',
    src: '/assets/turn-take/08e-avatar-spark-eye.png',
    accentHex: '#FFDA79',
  },
  {
    id: 'comet-mask',
    label: 'Comet Mask',
    src: '/assets/turn-take/08f-avatar-comet-mask.png',
    accentHex: '#FF795E',
  },
];

export function getAvatarSrc(avatarId: AvatarId): string {
  return (
    AVATAR_OPTIONS.find((item) => item.id === avatarId)?.src ??
    AVATAR_OPTIONS[0].src
  );
}

export interface MinigameMeta {
  id: MinigameId;
  title: string;
  tagline: string;
  cardSrc: string;
  accentHex: string;
}

export const MINIGAME_META: Record<MinigameId, MinigameMeta> = {
  'perfect-timing': {
    id: 'perfect-timing',
    title: 'Perfect Timing',
    tagline: 'Lock the dial inside the golden zone.',
    cardSrc: '/assets/turn-take/03-perfect-timing-card.webp',
    accentHex: '#FFDA79',
  },
  'flash-memory': {
    id: 'flash-memory',
    title: 'Flash Memory',
    tagline: 'Memorize and repeat the lit tile sequence.',
    cardSrc: '/assets/turn-take/04-flash-memory-card.webp',
    accentHex: '#8B7CFF',
  },
  'target-rush': {
    id: 'target-rush',
    title: 'Target Rush',
    tagline: 'Strike high-value targets before time expires.',
    cardSrc: '/assets/turn-take/05-target-rush-card.webp',
    accentHex: '#FF795E',
  },
};

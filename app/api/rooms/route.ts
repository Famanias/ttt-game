import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/server/store';
import type { AvatarId, GameMode, MinigameSelection } from '@/lib/game/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body?.playerName === 'string' && body.playerName.trim()
      ? body.playerName.trim().slice(0, 18)
      : 'Player X';
    const avatarId: AvatarId = body?.avatarId || 'orb-bot';
    const mode: GameMode = body?.mode === 'clash' ? 'clash' : 'classic';
    const minigameSelection: MinigameSelection =
      body?.minigameSelection || 'rotating';

    const room = createRoom({
      player: { name, avatarId },
      mode,
      minigameSelection,
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Unable to create room.' },
      { status: 400 }
    );
  }
}

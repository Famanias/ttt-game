import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, recordLeaderboardMatch } from '@/lib/server/store';
import type { AvatarId, GameMode } from '@/lib/game/types';

export async function GET() {
  return NextResponse.json({ entries: getLeaderboard() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name =
      typeof body?.name === 'string' && body.name.trim()
        ? body.name.trim().slice(0, 18)
        : 'Player';
    const avatarId: AvatarId = body?.avatarId || 'orb-bot';
    const outcome =
      body?.outcome === 'win' || body?.outcome === 'loss' ? body.outcome : 'draw';
    const mode: GameMode = body?.mode === 'clash' ? 'clash' : 'classic';
    const streakAchieved = Number(body?.streakAchieved ?? 0);

    const entries = recordLeaderboardMatch({
      name,
      avatarId,
      outcome,
      mode,
      streakAchieved,
    });

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json(
      { error: 'Unable to update leaderboard.' },
      { status: 400 }
    );
  }
}

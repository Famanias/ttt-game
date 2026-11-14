import { NextRequest, NextResponse } from 'next/server';
import {
  getRoom,
  joinRoom,
  rematchRoom,
  submitRoomClashScore,
  submitRoomMove,
} from '@/lib/server/store';
import type { AvatarId, Mark } from '@/lib/game/types';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  }
  return NextResponse.json({ room });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const action = body?.action;

    if (action === 'join') {
      const name =
        typeof body?.playerName === 'string' && body.playerName.trim()
          ? body.playerName.trim().slice(0, 18)
          : 'Player O';
      const avatarId: AvatarId = body?.avatarId || 'shield-face';
      const result = joinRoom(code, { name, avatarId });
      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status || 400 }
        );
      }
      return NextResponse.json({ room: result.room });
    }

    if (action === 'move') {
      const mark: Mark = body?.mark === 'O' ? 'O' : 'X';
      const cellIndex = Number(body?.cellIndex);
      const result = submitRoomMove(code, mark, cellIndex);
      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status || 400 }
        );
      }
      return NextResponse.json({ room: result.room });
    }

    if (action === 'clash_score') {
      const mark: Mark = body?.mark === 'O' ? 'O' : 'X';
      const score = Number(body?.score ?? 0);
      const result = submitRoomClashScore(code, mark, score);
      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status || 400 }
        );
      }
      return NextResponse.json({ room: result.room });
    }

    if (action === 'rematch') {
      const room = rematchRoom(code);
      if (!room) {
        return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
      }
      return NextResponse.json({ room });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid room request.' },
      { status: 400 }
    );
  }
}

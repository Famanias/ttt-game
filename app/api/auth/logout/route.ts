import { NextResponse } from 'next/server';
import { failure, readBody } from '@/lib/server/api';
import { serverSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await readBody(request);
    const client = await serverSupabase();
    if (client) {
      await client.auth.signOut();
    }
    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return failure(
      error instanceof Error &&
        ['INVALID_ORIGIN', 'PAYLOAD_TOO_LARGE', 'INVALID_INPUT'].includes(error.message)
        ? error.message
        : 'INVALID_INPUT'
    );
  }
}

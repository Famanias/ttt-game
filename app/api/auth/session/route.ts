import { NextResponse } from 'next/server';
import { getInitialAccount } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await getInitialAccount();
  return NextResponse.json(
    account ?? { registered: false },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

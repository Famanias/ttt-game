import { TurnTakeApp } from '@/components/TurnTakeApp';
import { getInitialAccount } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ autostart?: string; room?: string }>;
}) {
  const [params, initialAccount] = await Promise.all([
    searchParams,
    getInitialAccount(),
  ]);
  return (
    <TurnTakeApp
      initialAutostart={params.autostart === '1'}
      initialRoomCode={params.room ?? null}
      initialAccount={initialAccount}
    />
  );
}

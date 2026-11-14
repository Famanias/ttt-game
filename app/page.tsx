import { TurnTakeApp } from '@/components/TurnTakeApp';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ autostart?: string; room?: string }>;
}) {
  const params = await searchParams;
  return (
    <TurnTakeApp
      initialAutostart={params.autostart === '1'}
      initialRoomCode={params.room ?? null}
    />
  );
}

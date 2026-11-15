import { TurnTakeApp } from '@/components/TurnTakeApp';
import { getInitialAccount } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export default async function Room({params}:{params:Promise<{code:string}>}){const [{code},initialAccount]=await Promise.all([params,getInitialAccount()]);return <TurnTakeApp initialRoomCode={code} initialAccount={initialAccount}/>;}

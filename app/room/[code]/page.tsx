import { TurnTakeApp } from '@/components/TurnTakeApp';
export const dynamic='force-dynamic';
export default async function Room({params}:{params:Promise<{code:string}>}){return <TurnTakeApp initialRoomCode={(await params).code}/>;}

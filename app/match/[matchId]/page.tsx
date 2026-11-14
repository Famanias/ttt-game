import { TurnTakeApp } from '@/components/TurnTakeApp';
import { serverSupabase } from '@/lib/supabase/server';
import { z } from 'zod';
export const dynamic='force-dynamic';
export default async function Match({params}:{params:Promise<{matchId:string}>}) {
  const id=z.uuid().safeParse((await params).matchId);
  const client=await serverSupabase();
  if(id.success&&client){
    const {data:{user}}=await client.auth.getUser();
    if(user){const {data}=await client.rpc('game_request',{p_action:'match_snapshot',p_resource:id.data,p_payload:{}});if(data?.room)return <TurnTakeApp initialRoomCode={data.room.code}/>;}
  }
  return <><p role="alert" className="p-4 text-center bg-[#151B28] text-[#FF795E]">Open the room invite in the browser that joined this match.</p><TurnTakeApp/></>;
}

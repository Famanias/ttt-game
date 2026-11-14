import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { failure } from '@/lib/server/api';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const client=await serverSupabase();if(!client)return failure('ONLINE_NOT_CONFIGURED',503);
  const mode=new URL(request.url).searchParams.get('mode')??'clash';if(!['classic','clash'].includes(mode))return failure('INVALID_INPUT');
  const {data,error}=await client.rpc('game_leaderboard',{p_mode:mode});
  return error?failure('SERVER_ERROR',500):NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
}

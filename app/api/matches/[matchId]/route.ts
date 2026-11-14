import { z } from 'zod';
import { api, failure } from '@/lib/server/api';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{matchId:string}>}) {
  const id=z.uuid().safeParse((await params).matchId);
  return id.success?api(request,'match_snapshot',id.data):failure('INVALID_INPUT');
}

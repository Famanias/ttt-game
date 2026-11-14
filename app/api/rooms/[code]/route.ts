import { api, failure, readBody } from '@/lib/server/api';
import { roomCode } from '@/lib/online/contracts';
export const dynamic='force-dynamic';
type Context={params:Promise<{code:string}>};
export async function GET(request:Request,{params}:Context){
  const code=roomCode.safeParse((await params).code);
  return code.success?api(request,'snapshot',code.data):failure('INVALID_CODE');
}
export async function POST(request:Request,{params}:Context){
  try {
    const code=roomCode.safeParse((await params).code);if(!code.success)return failure('INVALID_CODE');
    const body=await readBody(request);
    if(!body || typeof body!=='object' || !['join','ready','leave','heartbeat','move','submit','rematch'].includes(body.action))return failure('INVALID_INPUT');
    const {action,...payload}=body;
    return api(request,action,code.data,payload);
  } catch {return failure('INVALID_INPUT');}
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { schemas, type Mutation } from '../online/contracts';
import { serverSupabase } from '../supabase/server';

export function failure(code:string,status=400) {
  return NextResponse.json({error:{code}},{status,headers:{'Cache-Control':'private, no-store'}});
}
export async function readBody(request:Request) {
  if (request.headers.get('origin')!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site') throw new Error('INVALID_ORIGIN');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('INVALID_INPUT');
  const reader=request.body?.getReader(); if (!reader) throw new Error('INVALID_INPUT');
  let size=0; const chunks:Uint8Array[]=[];
  while (true) { const {done,value}=await reader.read(); if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new Error('PAYLOAD_TOO_LARGE');}chunks.push(value); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function api(request:Request,action:string,resource='',payload?:unknown) {
  try {
    const client=await serverSupabase(); if(!client)return failure('ONLINE_NOT_CONFIGURED',503);
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)return failure('RECONNECT_REQUIRED',401);
    const body=action in schemas ? schemas[action as Mutation].parse(payload ?? await readBody(request)) : {};
    const {data,error}=await client.rpc('game_request',{p_action:action,p_resource:resource,p_payload:body});
    if(error)return failure('SERVER_ERROR',500);
    if(data?.error) {
      const code=String(data.error.code);
      const status=code==='NOT_MEMBER'?403:code==='RATE_LIMITED'?429:code==='STALE_VERSION'?409:400;
      return failure(code,status);
    }
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    if(error instanceof z.ZodError)return failure('INVALID_INPUT');
    return failure(error instanceof Error && ['INVALID_ORIGIN','PAYLOAD_TOO_LARGE','INVALID_INPUT'].includes(error.message)?error.message:'INVALID_INPUT');
  }
}

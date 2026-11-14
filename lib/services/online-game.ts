'use client';
import { browserSupabase } from '../supabase/browser';
import type { OnlineRoom, PublicProfile, Mutation } from '../online/contracts';

const messages:Record<string,string>={RESUME_LIMIT:'This match has reached its reload restart limit. Return to local games if you cannot finish the current attempt.',ONLINE_NOT_CONFIGURED:'Online play is not configured. Local games are available.',CAPTCHA_REQUIRED:'Complete the security check to continue online.',ROOM_FULL:'This room already has two players.',ROOM_EXPIRED:'This room has closed or expired.',INVALID_CODE:'Check your six-character invite code.',NOT_MEMBER:'You are not an active member of this room.',NAME_TAKEN:'That display name is taken. Choose another.',RATE_LIMITED:'Too many requests. Wait a minute and try again.',STALE_VERSION:'The game changed. Synced the latest state; try again.',RECONNECT_REQUIRED:'Your guest session needs to reconnect.',INVALID_INPUT:'Check the display name and request details.'};
export class GameError extends Error { constructor(public code:string){super(messages[code]??code.replaceAll('_',' ').toLowerCase());} }

export async function gameFetch<T>(url:string,body?:unknown,method='POST'):Promise<T> {
  const response=await fetch(url,{method:body===undefined?'GET':method,cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new GameError(data.error?.code??'SERVER_ERROR');return data;
}
let guestRequest:Promise<string>|undefined;
export async function ensureGuest(captchaToken?:string):Promise<string> {
  if(guestRequest){
    if(!captchaToken)return guestRequest;
    await guestRequest.catch(()=>undefined);
  }
  guestRequest=(async()=>{
    const client=browserSupabase();const {data:{user}}=await client.auth.getUser();
    if(user)return user.id;
    const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    if(siteKey&&!captchaToken)throw new GameError('CAPTCHA_REQUIRED');
    const {data,error}=await client.auth.signInAnonymously(captchaToken?{options:{captchaToken}}:undefined);
    if(error||!data.user)throw new Error(error?.message??'Guest sign-in failed.');return data.user.id;
  })().finally(()=>{guestRequest=undefined;});
  return guestRequest;
}
export const onlineGame={
  async profile(profile:PublicProfile,captchaToken?:string){await ensureGuest(captchaToken);return gameFetch('/api/profile',{...profile,clientCommandId:crypto.randomUUID()},'PUT');},
  async create(mode:'classic'|'clash'){return gameFetch<{room:OnlineRoom}>('/api/rooms',{mode,clientCommandId:crypto.randomUUID()});},
  async join(code:string){return gameFetch<{room:OnlineRoom}>(`/api/rooms/${encodeURIComponent(code.trim().toUpperCase())}`,{action:'join',clientCommandId:crypto.randomUUID()});},
  snapshot(code:string){return gameFetch<{room:OnlineRoom}>(`/api/rooms/${code}`);},
  command(room:OnlineRoom,action:Mutation,payload:Record<string,unknown>={}){
    return gameFetch<{room:OnlineRoom}>(`/api/rooms/${room.code}`,{action,clientCommandId:crypto.randomUUID(),...(['heartbeat','join'].includes(action)?{}:{expectedVersion:action==='rematch'?room.version:room.match?.version??room.version}),...payload});
  },
};

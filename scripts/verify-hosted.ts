/** Opt-in integration smoke against a real migrated Supabase project.
 * Creates three anonymous test guests and real matches. Never logs tokens.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import type { OnlineRoom, Trace, OnlineRound } from '../lib/online/contracts';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key){console.error('Not run: configure Supabase variables in .env.local; apply migrations and enable anonymous auth first.');process.exit(2);}
const guests=[0,1,2].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:true}}));
const codes=new Set<string>();
const channels:Array<{client:SupabaseClient;channel:ReturnType<SupabaseClient['channel']>}>=[];
const ids:string[]=[];
const suffix=Date.now().toString(36).slice(-7);
async function rpc(who:number,action:string,resource='',payload:Record<string,unknown>={}){
  const {data,error}=await guests[who].rpc('game_request',{p_action:action,p_resource:resource,p_payload:payload});
  assert.ifError(error);return data;
}
const command=(p:Record<string,unknown>={})=>({clientCommandId:crypto.randomUUID(),...p});
async function get(who:number,code:string):Promise<OnlineRoom>{const data=await rpc(who,'snapshot',code);assert(!data.error,JSON.stringify(data));return data.room;}
async function mutate(who:number,action:string,r:OnlineRoom,p:Record<string,unknown>={}):Promise<OnlineRoom>{
  const data=await rpc(who,action,r.code,command({expectedVersion:action==='rematch'?r.version:r.match?.version??r.version,...p}));
  assert(!data.error,JSON.stringify(data));return data.room;
}
const waitUntil=async(when:number)=>{const remaining=when-Date.now();if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));};
async function start(mode:'classic'|'clash'){
  let data=await rpc(0,'create','',command({mode}));assert(!data.error,JSON.stringify(data));let r:OnlineRoom=data.room;codes.add(r.code);
  data=await rpc(1,'join',r.code,command());assert(!data.error,JSON.stringify(data));r=data.room;
  assert.equal((await rpc(2,'join',r.code,command())).error.code,'ROOM_FULL');
  assert.equal((await rpc(2,'snapshot',r.code)).error.code,'NOT_MEMBER');
  r=await mutate(0,'ready',r,{ready:true});assert.equal(r.match,null);r=await mutate(1,'ready',r,{ready:true});
  await waitUntil(Date.parse(r.match!.startAt)+100);return get(0,r.code);
}
async function subscribe(who:number,r:OnlineRoom,allowed:boolean){
  const {data:{session}}=await guests[who].auth.getSession();await guests[who].realtime.setAuth(session!.access_token);
  const channel=guests[who].channel(`room:${r.id}`,{config:{private:true}}).on('broadcast',{event:'room_updated'},()=>{});
  channels.push({client:guests[who],channel});
  const status=await new Promise<string>((resolve)=>{const timer=setTimeout(()=>resolve('TIMEOUT'),12000);channel.subscribe(state=>{if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT'].includes(state)){clearTimeout(timer);resolve(state);}});});
  if(allowed)assert.equal(status,'SUBSCRIBED');else assert.notEqual(status,'SUBSCRIBED');
}
function trace(round:OnlineRound,good:boolean):Trace{
  const c=round.config;
  if(round.type==='perfect-timing')return {version:1,events:Array.from({length:c.presses!},(_,i)=>({t:good?Math.round((c.targetCenter!+(i+1)*360)/c.speed!*1000):200+i*130}))};
  if(round.type==='flash-memory')return {version:1,finishedAt:2500,events:(good?c.pattern!:[Array.from({length:9},(_,i)=>i).find(i=>!c.pattern!.includes(i))!]).map((cell,i)=>({cell,t:1650+i*100}))};
  const target=c.targets![0];return {version:1,events:good?[{t:target.spawn+100,targetId:target.id,x:target.x,y:target.y}]:[]};
}

let heartbeat:ReturnType<typeof setInterval>|undefined;
try{
  for(let who=0;who<3;who++){
    const {data,error}=await guests[who].auth.signInAnonymously();assert.ifError(error);assert(data.user);ids.push(data.user.id);
    const result=await rpc(who,'profile','',command({name:`Smoke${who}-${suffix}`,avatarId:'orb-bot',publicLeaderboard:true}));assert(!result.error,JSON.stringify(result));
  }
  heartbeat=setInterval(()=>{for(const code of codes)for(const who of [0,1])void rpc(who,'heartbeat',code,command()).catch(()=>{});},4000);
  let r=await start('classic');await subscribe(0,r,true);await subscribe(2,r,false);
  r=await get(0,r.code);
  const sameVersion=r.match!.version;
  const races=await Promise.all([rpc(0,'move',r.code,command({expectedVersion:sameVersion,cellIndex:0})),rpc(1,'move',r.code,command({expectedVersion:sameVersion,cellIndex:1}))]);
  assert.equal(races.filter(result=>!result.error).length,1);
  r=await get(0,r.code);
  for(const [who,cellIndex] of [[1,3],[0,1],[1,4],[0,2]])r=await mutate(who,'move',r,{cellIndex});
  assert.equal(r.match!.winner,'X');const oldId=r.match!.id;
  r=await mutate(0,'rematch',r,{accepted:true});assert.equal(r.match!.id,oldId);
  r=await mutate(1,'rematch',r,{accepted:true});assert.notEqual(r.match!.id,oldId);
  assert.deepEqual(r.match!.board,Array(9).fill(null));
  console.log('PASS hosted Classic: private seats/channel, nonmember denial, move race, finalization and rematch.');

  r=await start('clash');
  for(let index=0;index<3;index++){
    const round=r.match!.round!;assert.equal(round.type,['perfect-timing','flash-memory','target-rush'][index]);
    const other=await get(1,r.code);assert.deepEqual(other.match!.round,round);
    await waitUntil(Date.parse(round.endAt)+50);
    r=await mutate(0,'submit',await get(0,r.code),{roundId:round.id,trace:trace(round,true)});
    assert.equal(r.match!.round!.scores,null);
    r=await mutate(1,'submit',r,{roundId:round.id,trace:trace(round,false)});
    assert.equal(r.match!.claimant,'X');
    assert.equal((await rpc(1,'move',r.code,command({expectedVersion:r.match!.version,cellIndex:2}))).error.code,'NOT_YOUR_TURN');
    for(const cellIndex of index===0?[0]:index===1?[1,8]:[2])r=await mutate(0,'move',r,{cellIndex});
  }
  assert.equal(r.match!.winner,'X');
  const {data:board,error}=await guests[2].rpc('game_leaderboard',{p_mode:'clash'});assert.ifError(error);
  assert(board.entries.some((entry:{name:string;wins:number})=>entry.name===`Smoke0-${suffix}`&&entry.wins===1));
  console.log('PASS hosted Clash: all three shared challenges, hidden attempts, authorized bonus claims and one persisted win.');
} finally {
  if(heartbeat)clearInterval(heartbeat);
  for(const {client,channel} of channels)await client.removeChannel(channel);
  for(const code of codes){try{const r=await get(0,code);await rpc(0,'leave',code,command({expectedVersion:r.match?.version??r.version}));}catch{}}
  for(const client of guests)await client.auth.signOut();
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mutation, OnlineRoom } from '@/lib/online/contracts';
import { browserSupabase } from '@/lib/supabase/browser';
import { ensureGuest, onlineGame } from '@/lib/services/online-game';

export function countdownRefreshDelay(startAt: string, offset: number, now = Date.now()): number {
  const target = Date.parse(startAt);
  if (!Number.isFinite(target)) return 50;
  return Math.max(50, target - (now + offset) + 150);
}

export function useOnlineRoom(initial:OnlineRoom) {
  const [room,setRoom]=useState(initial);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [connected,setConnected]=useState(false);
  const [present,setPresent]=useState<string[]>([]);
  const [offset,setOffset]=useState(()=>Date.parse(initial.serverNow)-Date.now());
  const recoveryAttempted=useRef(false);
  const latest=useRef(initial);const active=useRef(true);const sending=useRef(false);
  const accept=useCallback((next:OnlineRoom,sentAt:number)=>{
    if(!active.current || next.id!==latest.current.id || next.version<latest.current.version)return;
    latest.current=next;setRoom(next);setOffset(Date.parse(next.serverNow)-(sentAt+Date.now())/2);
  },[]);
  const refresh=useCallback(async()=>{
    const sent=Date.now();
    try{const data=await onlineGame.snapshot(initial.code);accept(data.room,sent);if(active.current)setError(null);return data.room;}
    catch(err){if(active.current)setError(err instanceof Error?err.message:'Connection lost. Reconnecting…');}
  },[initial.code,accept]);
  const send=useCallback(async(action:Mutation,payload:Record<string,unknown>={})=>{
    if(sending.current)return false;
    sending.current=true;setBusy(true);setError(null);
    const runCommand=async(target:OnlineRoom)=>{
      const sent=Date.now();
      const data=await onlineGame.command(target,action,payload);
      if(data.room)accept(data.room,sent);
    };
    try{
      await runCommand(latest.current);
      return true;
    }catch(err){
      const refreshed=await refresh();
      const errCode=typeof err==='object'&&err!==null&&'code' in err?err.code:null;
      if(errCode==='STALE_VERSION'&&(action==='ready'||action==='rematch')&&refreshed){
        try{
          await runCommand(refreshed);
          return true;
        }catch(retryErr){
          await refresh();
          if(active.current)setError(retryErr instanceof Error?retryErr.message:'Command failed.');
          return false;
        }
      }
      if(active.current)setError(err instanceof Error?err.message:'Command failed.');
      return false;
    }finally{sending.current=false;if(active.current)setBusy(false);}
  },[accept,refresh]);
  useEffect(()=>{
    let disposed=false;
    active.current=true;let channel:ReturnType<ReturnType<typeof browserSupabase>['channel']>|undefined;
    let unsubscribe:(()=>void)|undefined;
    const client=browserSupabase();
    const sendHeartbeat=(markDisconnectedOnError:boolean)=>{
      const sent=Date.now();
      void onlineGame.command(latest.current,'heartbeat')
        .then(data=>{if(!disposed&&data?.room)accept(data.room,sent);})
        .catch(()=>{if(!disposed&&markDisconnectedOnError&&active.current)setConnected(false);});
    };
    const boot=async()=>{
      await ensureGuest();const snapshot=await refresh();
      if(disposed||!active.current)return;
      if(initial.match?.phase==='round' && snapshot?.match?.phase==='round' && snapshot.match.round && !snapshot.match.round.submitted[snapshot.myMark] && !recoveryAttempted.current){
        recoveryAttempted.current=true;const sent=Date.now();
        try {
          const resumed=await onlineGame.command(snapshot,'resume',{roundId:snapshot.match.round.id});
          accept(resumed.room,sent);
        } catch(err) {
          // A pending submission may have committed since the initial read.
          // Reconcile, then establish the channel even if no restart is legal.
          await refresh();
          if(!disposed&&active.current)setError(err instanceof Error?err.message:'Could not restart the attempt.');
        }
      }
      if(disposed||!active.current)return;
      // Reset last_seen_at immediately on mount/reload instead of waiting 5s for the first heartbeat tick.
      sendHeartbeat(false);
      const {data:{session}}=await client.auth.getSession();
      await client.realtime.setAuth(session?.access_token);
      if(disposed||!active.current)return;
      const me=latest.current.members.find(member=>member.slot===latest.current.myMark)!;
      channel=client.channel(`room:${initial.id}`,{config:{private:true,presence:{key:me.userId}}});
      channel.on('broadcast',{event:'room_updated'},()=>{void refresh();})
        .on('presence',{event:'sync'},()=>{
          if(active.current&&channel)setPresent(Object.keys(channel.presenceState()).filter(id=>latest.current.members.some(member=>member.userId===id)));
        }).subscribe(status=>{
          if(disposed||!active.current)return;
          setConnected(status==='SUBSCRIBED');
          if(status==='SUBSCRIBED'){void channel?.track({online:true});void refresh();}
        });
      const {data}=client.auth.onAuthStateChange((_event,newSession)=>{void client.realtime.setAuth(newSession?.access_token);});
      unsubscribe=()=>data.subscription.unsubscribe();
    };
    void boot().catch(err=>{if(active.current)setError(err.message);});
    const heartbeat=setInterval(()=>sendHeartbeat(true),5000);
    const poll=setInterval(()=>void refresh(),2500);
    const focus=()=>{sendHeartbeat(false);void refresh();};
    const visible=()=>{if(document.visibilityState==='visible')focus();};
    window.addEventListener('focus',focus);
    document.addEventListener('visibilitychange',visible);
    return ()=>{disposed=true;active.current=false;clearInterval(heartbeat);clearInterval(poll);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);unsubscribe?.();if(channel)void client.removeChannel(channel);};
  },[initial.code,initial.id,initial.match?.phase,accept,refresh]);
  const countdownMatchId = room.match?.phase === 'countdown' ? room.match.id : null;
  const countdownStartAt = room.match?.phase === 'countdown' ? room.match.startAt : null;
  useEffect(() => {
    if (!countdownMatchId || !countdownStartAt) return;
    // Refresh right after the server countdown ends so clients do not wait up to 2.5s for the next poll.
    const timer = setTimeout(() => {
      void refresh();
    }, countdownRefreshDelay(countdownStartAt, offset));
    return () => clearTimeout(timer);
  }, [countdownMatchId, countdownStartAt, offset, refresh]);
  return {room,error,busy,connected,present,offset,send,refresh};
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mutation, OnlineRoom } from '@/lib/online/contracts';
import { browserSupabase } from '@/lib/supabase/browser';
import { ensureGuest, onlineGame } from '@/lib/services/online-game';

export function useOnlineRoom(initial:OnlineRoom) {
  const [room,setRoom]=useState(initial);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [connected,setConnected]=useState(false);
  const [present,setPresent]=useState<string[]>([]);
  const [offset,setOffset]=useState(Date.parse(initial.serverNow)-Date.now());
  const latest=useRef(initial);const active=useRef(true);const sending=useRef(false);
  const accept=useCallback((next:OnlineRoom,sentAt:number)=>{
    if(!active.current || next.id!==latest.current.id || next.version<latest.current.version)return;
    latest.current=next;setRoom(next);setOffset(Date.parse(next.serverNow)-(sentAt+Date.now())/2);
  },[]);
  const refresh=useCallback(async()=>{
    const sent=Date.now();
    try{const data=await onlineGame.snapshot(initial.code);accept(data.room,sent);if(active.current)setError(null);}
    catch(err){if(active.current)setError(err instanceof Error?err.message:'Connection lost. Reconnecting…');}
  },[initial.code,accept]);
  const send=useCallback(async(action:Mutation,payload:Record<string,unknown>={})=>{
    if(sending.current)return false;
    sending.current=true;setBusy(true);setError(null);const sent=Date.now();
    try{const data=await onlineGame.command(latest.current,action,payload);if(data.room)accept(data.room,sent);return true;}
    catch(err){await refresh();if(active.current)setError(err instanceof Error?err.message:'Command failed.');return false;}
    finally{sending.current=false;if(active.current)setBusy(false);}
  },[accept,refresh]);
  useEffect(()=>{
    active.current=true;let channel:ReturnType<ReturnType<typeof browserSupabase>['channel']>|undefined;
    let unsubscribe:(()=>void)|undefined;
    const client=browserSupabase();
    const boot=async()=>{
      await ensureGuest();await refresh();
      if(!active.current)return;
      const {data:{session}}=await client.auth.getSession();
      await client.realtime.setAuth(session?.access_token);
      if(!active.current)return;
      const me=latest.current.members.find(member=>member.slot===latest.current.myMark)!;
      channel=client.channel(`room:${initial.id}`,{config:{private:true,presence:{key:me.userId}}});
      channel.on('broadcast',{event:'room_updated'},()=>{void refresh();})
        .on('presence',{event:'sync'},()=>{
          if(active.current&&channel)setPresent(Object.keys(channel.presenceState()).filter(id=>latest.current.members.some(member=>member.userId===id)));
        }).subscribe(status=>{
          if(!active.current)return;
          setConnected(status==='SUBSCRIBED');
          if(status==='SUBSCRIBED'){void channel?.track({online:true});void refresh();}
        });
      const {data}=client.auth.onAuthStateChange((_event,newSession)=>{void client.realtime.setAuth(newSession?.access_token);});
      unsubscribe=()=>data.subscription.unsubscribe();
    };
    void boot().catch(err=>{if(active.current)setError(err.message);});
    const heartbeat=setInterval(()=>{
      const sent=Date.now();
      void onlineGame.command(latest.current,'heartbeat').then(data=>accept(data.room,sent)).catch(()=>{if(active.current)setConnected(false);});
    },5000);
    const poll=setInterval(()=>void refresh(),2500);
    const focus=()=>{void refresh();};window.addEventListener('focus',focus);
    return ()=>{active.current=false;clearInterval(heartbeat);clearInterval(poll);window.removeEventListener('focus',focus);unsubscribe?.();if(channel)void client.removeChannel(channel);};
  },[initial.code,initial.id,accept,refresh]);
  return {room,error,busy,connected,present,offset,send,refresh};
}

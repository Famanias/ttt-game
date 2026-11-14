'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMode, LeaderboardEntry } from '@/lib/game/types';
import { gameFetch } from '@/lib/services/online-game';

export function useLeaderboard(open:boolean) {
  const sequence=useRef(0);
  const [mode,setMode]=useState<GameMode>('clash');
  const [entries,setEntries]=useState<LeaderboardEntry[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const refresh=useCallback(async()=>{
    const requestId=++sequence.current;setLoading(true);
    try{const data=await gameFetch<{entries:LeaderboardEntry[]}>(`/api/leaderboard?mode=${mode}`);if(requestId===sequence.current){setEntries(data.entries);setError(null);}}
    catch(err){if(requestId===sequence.current){setEntries([]);setError(err instanceof Error?err.message:'Rankings unavailable.');}}
    finally{if(requestId===sequence.current)setLoading(false);}
  },[mode]);
  const invalidate=useCallback(()=>{sequence.current+=1;},[]);
  useEffect(()=>{
    if(!open)return;
    let disposed=false;queueMicrotask(()=>{if(!disposed)void refresh();});const timer=setInterval(()=>void refresh(),10000);const focus=()=>{void refresh();};window.addEventListener('focus',focus);
    return()=>{disposed=true;invalidate();clearInterval(timer);window.removeEventListener('focus',focus);};
  },[open,refresh,invalidate]);
  return {mode,setMode,entries,loading,error,refresh};
}

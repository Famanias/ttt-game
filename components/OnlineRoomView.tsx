'use client';
import { useEffect, useState } from 'react';
import type { OnlineRoom } from '@/lib/online/contracts';
import { adaptRoom } from '@/lib/online/contracts';
import { onlineGame } from '@/lib/services/online-game';
import { WaitingRoomScreen } from './WaitingRoomScreen';

export function OnlineRoomView({initialRoom,onExit}:{initialRoom:OnlineRoom;onExit:()=>void;muted:boolean;onToggleMute:()=>void}) {
  const [room,setRoom]=useState(initialRoom);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;
    const refresh=()=>onlineGame.snapshot(initialRoom.code).then(data=>{if(active){setRoom(data.room);setError(null);}}).catch(err=>{if(active)setError(err.message);});
    const timer=setInterval(refresh,2500);
    return ()=>{active=false;clearInterval(timer);};
  },[initialRoom.code]);
  return <>
    <WaitingRoomScreen room={adaptRoom(room)} onCancel={onExit} onSwitchToBot={onExit}/>
    <div role="status" className="fixed bottom-6 inset-x-4 z-20 text-center text-sm text-[#CBD5E1]">
      {room.members.map(member=><p key={member.userId}>{member.profile.name} ({member.slot}) — {member.ready?'Ready':'Not ready'}</p>)}
      {error && <p role="alert" className="text-[#FF795E]">{error}</p>}
    </div>
  </>;
}

'use client';
import { useEffect, useState } from 'react';
import type { OnlineRoom } from '@/lib/online/contracts';
import { adaptRoom } from '@/lib/online/contracts';
import { useOnlineRoom } from '@/hooks/use-online-room';
import { ClashMinigameModal } from './ClashMinigameModal';
import { WaitingRoomScreen } from './WaitingRoomScreen';
import { ArenaScreen } from './ArenaScreen';
import { OutcomeModal } from './OutcomeModal';
import { LeaderboardModal } from './LeaderboardModal';
import type { Trace } from '@/lib/online/contracts';
import { useLeaderboard } from '@/hooks/use-leaderboard';


const ignoreLocalScore=()=>{};

export function OnlineRoomView({initialRoom,onExit,muted,onToggleMute}:{initialRoom:OnlineRoom;onExit:()=>void;muted:boolean;onToggleMute:()=>void}) {
  const {room,error,busy,connected,present,offset,send}=useOnlineRoom(initialRoom);
  const [now,setNow]=useState(0);
  const [leaderboard,setLeaderboard]=useState(false);
  const leaderboardState=useLeaderboard(leaderboard);
  const [pendingTrace,setPendingTrace]=useState<{roundId:string;trace:Trace}|null>(null);
  useEffect(()=>{const tick=()=>setNow(Date.now()+offset);tick();const timer=setInterval(tick,150);return()=>clearInterval(timer);},[offset]);
  const local=adaptRoom(room);const match=room.match;
  const mine=room.members.find(member=>member.slot===room.myMark)!;
  const leave=()=>{void send('leave').catch(()=>{});onExit();};
  const openLeaderboard=()=>setLeaderboard(true);
  const status=<div role="status" className="text-sm text-[#CBD5E1] space-y-2">
    <p>{connected?'Live connection':'Reconnecting live updates ? checking saved state'}</p>
    {room.members.map(member=><p key={member.userId}>{member.profile.name} ({member.slot}) ? {member.status==='left'?'left the room':present.includes(member.userId)?'online':'connecting'} ? {member.ready?'Ready':'Not ready'}</p>)}
    {error&&<p role="alert" className="text-[#FF795E]">{error} <button onClick={onExit} className="underline">Return to lobby</button></p>}
  </div>;
  if(!match || match.phase==='countdown')return <WaitingRoomScreen room={local} onCancel={()=>void leave()} onSwitchToBot={()=>void leave()} heading={match?`Match starts in ${Math.max(0,Math.ceil((Date.parse(match.startAt)-now)/1000))}`:room.members.length<2?'Waiting for Opponent':'Ready to play?'}>
    {status}
    <button disabled={busy} onClick={()=>void send('ready',{ready:!mine.ready})} className="min-h-[46px] rounded-xl px-4 py-3 bg-[#FFDA79] text-[#10141D] font-semibold disabled:opacity-50">{mine.ready?'Not Ready':'Ready Up'}</button>
    <p className="text-xs text-[#94A3B8]">Guest identity stays in this browser. Clearing site data loses access. Both players must ready up.</p>
  </WaitingRoomScreen>;
  const locked=busy||!!error||match.phase==='paused'||match.phase==='finished'||(match.phase!=='classic_turn'&&match.phase!=='claim');
  const o=local.players.O!;
  return <>
    <button type="button" onClick={leave} className="fixed bottom-4 right-4 z-[70] min-h-[44px] px-4 rounded-xl bg-[#151B28] border border-[#65737C] text-sm text-[#43DDE6]">Return to Local Games</button>
    <div className="fixed top-0 inset-x-0 z-[60] bg-[#10141D]/95 px-4 py-2 text-center text-sm text-[#CBD5E1]" role="status">
      {error??(match.phase==='paused'?`Paused for reconnect ? ${Math.max(0,Math.ceil((Date.parse(match.reconnectDeadline!)-now)/1000))}s grace remaining`:match.phase==='claim'?`${match.claimant} claims ? ${Math.max(0,Math.ceil((Date.parse(match.deadlineAt!)-now)/1000))}s remaining`:connected?'Private room ? live saved state':'Reconnecting updates ? checking saved state')}
      {match.phase==='finished'&&<span> ? {room.members.some(m=>m.status==='left')?'Opponent left the room. ':''}{match.reason?.replaceAll('_',' ')} ? Rematch votes: {match.rematchVotes.filter(v=>v.accepted).length}/2</span>}
    </div>
    <ArenaScreen mode={room.mode} opponentType="room" botDifficulty="tactical" roomCode={room.code} localRoomMark={room.myMark}
      board={local.board} currentTurn={local.currentTurn} winningLine={local.winningLine} winner={local.winner} playerX={local.players.X} playerO={o}
      sessionScores={local.scores} clashRound={local.clashRound} clashStreaks={local.clashStreaks} pendingPlacements={local.pendingPlacements}
      pendingPlacer={local.pendingPlacer} activeMinigame={local.activeMinigame} botThinking={false} muted={muted} networkLocked={locked}
      onCellClick={cellIndex=>{if(!locked)void send('move',{cellIndex});}} onLaunchClash={()=>{}}
      onRestart={()=>{if(match.phase==='finished')void send('rematch',{accepted:true});}} onBackToLobby={()=>void leave()} onOpenLeaderboard={openLeaderboard} onToggleMute={onToggleMute}/>
    {match.phase==='round'&&match.round&&<ClashMinigameModal key={match.round.id} round={match.round.index} minigame={match.round.type} opponentType="room" playerX={local.players.X} playerO={o} localRoomMark={room.myMark}
      xSubmittedScore={match.round.submitted.X?0:null} oSubmittedScore={match.round.submitted.O?0:null} lastSummary={null} onSubmitSingleScore={ignoreLocalScore} onContinueAfterSummary={()=>{}}
      online={{round:match.round,offset,now,busy,onTrace:trace=>{const attempt={roundId:match.round!.id,trace};setPendingTrace(attempt);void send('submit',attempt);}}}/>}
    {match.phase==='finished'&&local.winner&&<OutcomeModal winner={local.winner} mode={room.mode} playerX={local.players.X} playerO={o} moveCount={local.moveCount} sessionScores={local.scores} bestStreak={match.bestStreaks[room.myMark]}
      outcomeLabel={match.winner==='abandoned'?'Match Abandoned':match.reason==='reconnect_timeout'||match.reason==='submission_timeout'||match.reason==='deliberate_leave'?`${match.winner==='X'?local.players.X.name:o.name} Wins by Forfeit`:undefined}
      playAgainLabel={match.rematchVotes.some(v=>v.userId===mine.userId&&v.accepted)?'Waiting for Opponent?':'Request Rematch'}
      onPlayAgain={()=>{void send('rematch',{accepted:true});}} onBackToLobby={()=>void leave()} onOpenLeaderboard={openLeaderboard}/>}
    {match.phase==='round'&&pendingTrace?.roundId===match.round?.id&&!match.round?.submitted[room.myMark]&&<button disabled={busy} onClick={()=>{if(pendingTrace)void send('submit',pendingTrace);}} className="fixed bottom-4 inset-x-4 z-50 min-h-[44px] rounded-xl bg-[#FFDA79] text-[#10141D] font-semibold">{busy?'Sending attempt?':'Retry saved attempt'}</button>}
    {leaderboard&&<LeaderboardModal entries={leaderboardState.entries} loading={leaderboardState.loading} error={leaderboardState.error} mode={leaderboardState.mode} onModeChange={leaderboardState.setMode} onClose={()=>setLeaderboard(false)}/>}

  </>;
}

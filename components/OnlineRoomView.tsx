'use client';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
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
  const activeMembers = room.members.filter((member) => member.status === 'active');
  const opponentMark = room.myMark === 'X' ? 'O' : 'X';
  const opponentMember = activeMembers.find((member) => member.slot === opponentMark);
  const opponentJoined = Boolean(opponentMember);
  const readyHint = !opponentJoined
    ? 'Waiting for a 2nd player to join. (Note: two Incognito windows in the same browser share one guest session.)'
    : match?.phase === 'countdown'
      ? 'Both players ready — match starting now!'
      : mine.ready
        ? 'You are ready! Waiting for opponent to ready up...'
        : opponentMember?.ready
          ? 'Opponent is ready! Click Ready Up to start.'
          : 'Both players must click Ready Up to start the match.';
  const status = (
    <div role="status" className="text-sm text-[#CBD5E1] space-y-2">
      <p className="inline-flex items-center gap-2 text-xs font-medium text-[#94A3B8]">
        <span
          aria-hidden="true"
          className={`w-2 h-2 rounded-full ${connected ? 'bg-[#4ADE80]' : 'bg-[#FFDA79] animate-pulse'}`}
        />
        {connected ? 'Live connection' : 'Reconnecting live updates · checking saved state'}
      </p>
      <div className="space-y-1.5 text-left">
        {room.members.map((member) => {
          const isMe = member.slot === room.myMark;
          const presenceLabel =
            member.status === 'left'
              ? 'left the room'
              : present.includes(member.userId)
                ? 'online'
                : 'connecting';
          return (
            <div
              key={member.userId}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border text-xs sm:text-sm ${
                member.ready
                  ? 'bg-[#16A34A]/10 border-[#4ADE80]/40 text-[#E2E8F0]'
                  : 'bg-[#10141D]/80 border-[#65737C]/30 text-[#CBD5E1]'
              }`}
            >
              {member.profile.name} ({member.slot}){isMe ? ' (You)' : ''} · {presenceLabel}
              <span
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  member.ready
                    ? 'bg-[#16A34A]/20 text-[#4ADE80]'
                    : 'bg-[#65737C]/20 text-[#94A3B8]'
                }`}
              >
                {member.ready ? 'Ready' : 'Not ready'}
              </span>
            </div>
          );
        })}
        {!opponentJoined && (
          <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 border border-dashed border-[#65737C]/40 bg-[#10141D]/50 text-xs sm:text-sm text-[#94A3B8]">
            Opponent ({opponentMark}) · Waiting to join...
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[#FF795E]">
          {error}{' '}
          <button onClick={onExit} className="underline">
            Return to lobby
          </button>
        </p>
      )}
    </div>
  );
  if (!match || match.phase === 'countdown') {
    return (
      <WaitingRoomScreen
        room={local}
        onCancel={() => void leave()}
        onSwitchToBot={() => void leave()}
        heading={
          match
            ? `Match starts in ${Math.max(0, Math.ceil((Date.parse(match.startAt) - now) / 1000))}`
            : !opponentJoined
              ? 'Waiting for Opponent'
              : 'Ready to play?'
        }
      >
        {status}
        <button
          type="button"
          disabled={busy}
          aria-pressed={mine.ready}
          onClick={() => void send('ready', { ready: !mine.ready })}
          className={`min-h-[48px] w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43DDE6] ${
            mine.ready
              ? 'bg-[#16A34A]/20 text-[#4ADE80] border-2 border-[#4ADE80]/80 hover:bg-[#16A34A]/30'
              : 'bg-[#FFDA79] text-[#10141D] border-2 border-[#FFDA79] hover:bg-[#ffe394] active:scale-[0.98]'
          }`}
        >
          {mine.ready ? (
            <>
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ready — Click to Unready</span>
            </>
          ) : (
            'Ready Up'
          )}
        </button>
        <p className="text-xs text-[#94A3B8]">{readyHint}</p>
        <p className="text-[11px] text-[#64748B]">
          Guest identity stays in this browser. Clearing site data loses access.
        </p>
      </WaitingRoomScreen>
    );
  }
  const locked=busy||!!error||match.phase==='paused'||match.phase==='finished'||(match.phase!=='classic_turn'&&match.phase!=='claim');
  const o=local.players.O!;
  return <>
    <button type="button" onClick={leave} className="fixed bottom-4 right-4 z-[70] min-h-[44px] px-4 rounded-xl bg-[#151B28] border border-[#65737C] text-sm text-[#43DDE6]">Return to Local Games</button>
    <div className="fixed top-0 inset-x-0 z-[60] bg-[#10141D]/95 px-4 py-2 text-center text-sm text-[#CBD5E1]" role="status">
      {error??(match.phase==='paused'?`Paused for reconnect · ${Math.max(0,Math.ceil((Date.parse(match.reconnectDeadline!)-now)/1000))}s grace remaining`:match.phase==='claim'?`${match.claimant} claims · ${Math.max(0,Math.ceil((Date.parse(match.deadlineAt!)-now)/1000))}s remaining`:connected?'Private room · live saved state':'Reconnecting updates · checking saved state')}
      {match.phase==='finished'&&<span> · {room.members.some(m=>m.status==='left')?'Opponent left the room. ':''}{match.reason?.replaceAll('_',' ')} · Rematch votes: {match.rematchVotes.filter(v=>v.accepted).length}/2</span>}
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
      playAgainLabel={match.rematchVotes.some(v=>v.userId===mine.userId&&v.accepted)?'Waiting for Opponent...':'Request Rematch'}
      onPlayAgain={()=>{void send('rematch',{accepted:true});}} onBackToLobby={()=>void leave()} onOpenLeaderboard={openLeaderboard}/>}
    {match.phase==='round'&&pendingTrace?.roundId===match.round?.id&&!match.round?.submitted[room.myMark]&&<button disabled={busy} onClick={()=>{if(pendingTrace)void send('submit',pendingTrace);}} className="fixed bottom-4 inset-x-4 z-50 min-h-[44px] rounded-xl bg-[#FFDA79] text-[#10141D] font-semibold">{busy?'Sending attempt...':'Retry saved attempt'}</button>}
    {leaderboard&&<LeaderboardModal entries={leaderboardState.entries} loading={leaderboardState.loading} error={leaderboardState.error} mode={leaderboardState.mode} onModeChange={leaderboardState.setMode} onClose={()=>setLeaderboard(false)}/>}

  </>;
}

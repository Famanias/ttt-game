import test from 'node:test';
import assert from 'node:assert/strict';
import { database, request, command, startMatch, USERS } from './helpers/database';
import type { PGlite } from '@electric-sql/pglite';

async function elapsedRound(db:PGlite,id:string) {
  await db.query("update private.clash_rounds set start_at=now()-((config->>'durationMs')::integer*interval '1 millisecond'),end_at=now(),submit_by=now()+interval '3 seconds' where id=$1",[id]);
}
function traceFor(round:any,good=true) {
  const c=round.config;
  if(round.type==='perfect-timing') {
    const times=Array.from({length:c.presses},(_,i)=>Math.round(((c.targetCenter+(i+1)*360)/c.speed)*1000));
    return {version:1,events:(good?times:Array.from({length:c.presses},(_,i)=>200+i*130)).map(t=>({t}))};
  }
  if(round.type==='flash-memory')return {version:1,finishedAt:2500,events:(good?c.pattern:[Array.from({length:9},(_,i)=>i).find(i=>!c.pattern.includes(i))]).map((cell:number,i:number)=>({cell,t:1650+i*100}))};
  const t=c.targets[0];
  return {version:1,events:good?[{t:t.spawn+100,targetId:t.id,x:t.x,y:t.y}]:[]};
}
async function winRound(db:PGlite,r:any) {
  await elapsedRound(db,r.match.round.id);
  let response=await request(db,USERS[0],'submit',r.code,command({expectedVersion:r.match.version,roundId:r.match.round.id,trace:traceFor(r.match.round)}));
  assert(!response.error,JSON.stringify(response));r=response.room;
  assert.equal(r.match.round.scores,null);
  response=await request(db,USERS[1],'submit',r.code,command({expectedVersion:r.match.version,roundId:r.match.round.id,trace:traceFor(r.match.round,false)}));
  assert(!response.error,JSON.stringify(response));return response.room;
}

test('server scoring derives all games, rejects duplicate targets, extra timing samples and impossible timestamps',async()=>{
  const db=await database();try{
    const score=async(type:string,config:object,trace:object)=> (await db.query<{score:{score:number}}>('select private.derive_score($1,$2::jsonb,$3::jsonb,10000) as score',[type,JSON.stringify(config),JSON.stringify(trace)])).rows[0].score.score;
    assert.equal(await score('perfect-timing',{durationMs:10000,presses:3,targetCenter:0,speed:360},{version:1,events:[{t:1000},{t:2000},{t:3000}]}),1000);
    await assert.rejects(score('perfect-timing',{durationMs:10000,presses:3,targetCenter:0,speed:360},{version:1,events:[{t:1000},{t:2000},{t:3000},{t:4000}]}),/INVALID_INPUT/);
    assert.equal(await score('flash-memory',{durationMs:8550,pattern:[0,2,4],revealMs:1550},{version:1,finishedAt:2000,events:[{cell:0,t:1600},{cell:2,t:1700},{cell:4,t:1800}]}),987);
    const c={durationMs:5500,targets:[{id:0,x:30,y:40,spawn:0,end:1000,points:90}]};
    assert.equal(await score('target-rush',c,{version:1,events:[{t:500,targetId:0,x:30,y:40}]}),90);
    await assert.rejects(score('target-rush',c,{version:1,events:[{t:500,targetId:0,x:30,y:40},{t:600,targetId:0,x:30,y:40}]}),/INVALID_INPUT/);
    await assert.rejects(score('target-rush',c,{version:1,events:[{t:1001,targetId:0,x:30,y:40}]}),/INVALID_INPUT/);
  }finally{await db.close();}
});

test('shared rounds hide submissions, authorize one claim then two-win bonus and check terminal placement immediately',async()=>{
  const db=await database();try{
    let r=await startMatch(db,'clash');
    const other=(await request(db,USERS[1],'snapshot',r.code)).room;
    assert.deepEqual(other.match.round,r.match.round);assert.equal(r.match.pendingClaims,0);
    r=await winRound(db,r);assert.equal(r.match.pendingClaims,1);assert.equal(r.match.claimant,'X');
    assert.equal((await request(db,USERS[1],'move',r.code,command({expectedVersion:r.match.version,cellIndex:0}))).error.code,'NOT_YOUR_TURN');
    r=(await request(db,USERS[0],'move',r.code,command({expectedVersion:r.match.version,cellIndex:0}))).room;
    assert.equal(r.match.round.type,'flash-memory');
    r=await winRound(db,r);assert.equal(r.match.pendingClaims,2);assert.deepEqual(r.match.streaks,{X:0,O:0});
    r=(await request(db,USERS[0],'move',r.code,command({expectedVersion:r.match.version,cellIndex:1}))).room;
    assert.equal(r.match.pendingClaims,1);
    r=(await request(db,USERS[0],'move',r.code,command({expectedVersion:r.match.version,cellIndex:2}))).room;
    assert.equal(r.match.winner,'X');assert.equal(r.match.pendingClaims,0);
  }finally{await db.close();}
});

test('exact tie produces shared sudden death with no placement; duplicate submit cannot resolve twice',async()=>{
  const db=await database();try{
    let r=await startMatch(db,'clash');await elapsedRound(db,r.match.round.id);
    const old=r.match.round.id;const trace=traceFor(r.match.round);
    const c=command({expectedVersion:r.match.version,roundId:old,trace});
    r=(await request(db,USERS[0],'submit',r.code,c)).room;
    assert.equal((await request(db,USERS[0],'submit',r.code,c)).room.match.version,r.match.version);
    assert.equal((await request(db,USERS[0],'submit',r.code,command({expectedVersion:r.match.version,roundId:old,trace}))).error.code,'ALREADY_SUBMITTED');
    r=(await request(db,USERS[1],'submit',r.code,command({expectedVersion:r.match.version,roundId:old,trace}))).room;
    assert.equal(r.match.pendingClaims,0);assert(r.match.round.suddenDeath);assert.notEqual(r.match.round.id,old);assert.equal(r.match.round.type,'perfect-timing');
  }finally{await db.close();}
});

test('claim deadline auto-places once and terminal first claim discards remaining bonus',async()=>{
  const db=await database();try{
    let r=await startMatch(db,'clash');r=await winRound(db,r);
    await db.query("update private.matches set deadline_at=now()-interval '1 second' where id=$1",[r.match.id]);
    r=(await request(db,USERS[0],'snapshot',r.code)).room;
    assert.equal(r.match.board[0],'X');assert.equal(r.match.moveCount,1);
    await request(db,USERS[1],'snapshot',r.code);
    assert.equal((await db.query<{count:number}>('select count(*)::int from private.moves')).rows[0].count,1);
    await db.query("update private.matches set board=array['X','X',null,'O',null,null,null,null,null],move_count=3,phase='claim',claimant='X',pending_claims=2,deadline_at=now()+interval '15 seconds' where id=$1",[r.match.id]);
    r=(await request(db,USERS[0],'snapshot',r.code)).room;
    r=(await request(db,USERS[0],'move',r.code,command({expectedVersion:r.match.version,cellIndex:2}))).room;
    assert.equal(r.match.winner,'X');assert.equal(r.match.pendingClaims,0);assert.equal(r.match.board.filter(Boolean).length,4);
  }finally{await db.close();}
});

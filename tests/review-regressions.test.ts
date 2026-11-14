import test from 'node:test';
import assert from 'node:assert/strict';
import { database, request, command, startMatch, room, profile, USERS } from './helpers/database';

test('both valid same-round submissions commit from the same initial match version',async()=>{
  const db=await database();try{
    let r=await startMatch(db,'clash');const round=r.match.round;
    await db.query("update private.clash_rounds set start_at=now()-interval '10 seconds',end_at=now(),submit_by=now()+interval '2 seconds' where id=$1",[round.id]);
    const version=r.match.version;
    const trace={version:1,events:[{t:500},{t:1500},{t:2500}]};
    const first=await request(db,USERS[0],'submit',r.code,command({expectedVersion:version,roundId:round.id,trace}));assert(!first.error,JSON.stringify(first));
    const second=await request(db,USERS[1],'submit',r.code,command({expectedVersion:version,roundId:round.id,trace}));assert(!second.error,JSON.stringify(second));
    assert.notEqual(second.room.match.round.id,round.id);assert.equal(second.room.match.pendingClaims,0);
  }finally{await db.close();}
});

test('normal mobile Target Rush edge tap stays inside the accepted hit region',async()=>{
  const db=await database();try{
    // A 24px vertical offset in the real 256px mobile field is 9.375%,
    // inside the rendered normal target's 26px radius.
    const config={durationMs:5500,targets:[{id:0,x:50,y:50,spawn:0,end:550,points:90}]};
    const trace={version:1,events:[{t:500,targetId:0,x:50,y:59.375}]};
    const result=(await db.query<{result:{score:number}}>("select private.derive_score('target-rush',$1::jsonb,$2::jsonb,1000) result",[JSON.stringify(config),JSON.stringify(trace)])).rows[0].result;
    assert.equal(result.score,90);
  }finally{await db.close();}
});

test('O leaving countdown clears current match and readiness before a replacement guest joins',async()=>{
  const db=await database();try{
    let r=(await room(db)).room;r=(await request(db,USERS[1],'join',r.code,command())).room;
    r=(await request(db,USERS[0],'ready',r.code,command({expectedVersion:r.version,ready:true}))).room;
    r=(await request(db,USERS[1],'ready',r.code,command({expectedVersion:r.version,ready:true}))).room;
    await request(db,USERS[1],'leave',r.code,command({expectedVersion:r.match.version}));
    r=(await request(db,USERS[0],'snapshot',r.code)).room;
    assert.equal(r.status,'waiting');assert.equal(r.match,null);assert.equal(r.members.length,1);assert.equal(r.members[0].ready,false);
    await profile(db,USERS[2],'Replacement');r=(await request(db,USERS[2],'join',r.code,command())).room;
    assert.equal(r.members.length,2);assert.equal(r.members.filter((m:any)=>m.slot==='O').length,1);assert.equal(r.members.find((m:any)=>m.slot==='O').profile.name,'Replacement');
    assert.equal(r.match,null);
    r=(await request(db,USERS[0],'ready',r.code,command({expectedVersion:r.version,ready:true}))).room;assert.equal(r.match,null);
    r=(await request(db,USERS[2],'ready',r.code,command({expectedVersion:r.version,ready:true}))).room;assert.equal(r.match.phase,'countdown');
  }finally{await db.close();}
});

test('fast reload explicitly restarts each unsubmitted challenge, including after its short submit window',async()=>{
  const db=await database();try{
    let r=await startMatch(db,'clash');
    for(const type of ['perfect-timing','flash-memory','target-rush']){
      const round=r.match.round;assert.equal(round.type,type);
      await db.query("update private.clash_rounds set submit_by=now()-interval '3 seconds' where id=$1",[round.id]);
      const response=await request(db,USERS[0],'resume',r.code,command({expectedVersion:r.match.version,roundId:round.id}));assert(!response.error,JSON.stringify(response));r=response.room;
      assert.notEqual(r.match.round.id,round.id);assert.deepEqual(r.match.round.config,round.config);assert.deepEqual(r.match.board,Array(9).fill(null));
      await db.query('select private.start_round($1)',[r.match.id]);r=(await request(db,USERS[0],'snapshot',r.code)).room;
    }
    const limited=await request(db,USERS[0],'resume',r.code,command({expectedVersion:r.match.version,roundId:r.match.round.id}));assert.equal(limited.error.code,'RESUME_LIMIT');
  }finally{await db.close();}
});

test('reload after a confirmed submission preserves it and does not restart either player',async()=>{
  const db=await database();try{
    let r=await startMatch(db,'clash');const round=r.match.round;
    await db.query("update private.clash_rounds set start_at=now()-interval '10 seconds',end_at=now(),submit_by=now()+interval '2 seconds' where id=$1",[round.id]);
    r=(await request(db,USERS[0],'submit',r.code,command({expectedVersion:r.match.version,roundId:round.id,trace:{version:1,events:[{t:500},{t:1500},{t:2500}]}}))).room;
    const response=await request(db,USERS[0],'resume',r.code,command({expectedVersion:r.match.version,roundId:round.id}));assert(!response.error,JSON.stringify(response));
    assert.equal(response.room.match.round.id,round.id);assert.equal(response.room.match.round.submitted.X,true);
  }finally{await db.close();}
});

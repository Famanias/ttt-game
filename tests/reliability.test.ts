import test from 'node:test';
import assert from 'node:assert/strict';
import { database, request, command, startMatch, profile, register, USERS } from './helpers/database';

test('stats finalize once, opt-in leaderboard is minimal and authenticated history persists',async()=>{
  const db=await database();try{
    let r=await startMatch(db);
    await register(db,USERS[0],'Alpha',true);
    await register(db,USERS[1],'Beta',true);
    await register(db,USERS[2],'Gamma',true);
    for(const [actor,cell] of [[0,0],[1,3],[0,1],[1,4],[0,2]])r=(await request(db,USERS[actor],'move',r.code,command({expectedVersion:r.match.version,cellIndex:cell}))).room;
    await db.query("select private.finish_match($1,'X','retry')",[r.match.id]);
    const stats=(await db.query<{classic_wins:number;classic_losses:number}>('select classic_wins,classic_losses from private.player_stats where user_id=$1',[USERS[0]])).rows[0];
    assert.equal(stats.classic_wins,1);assert.equal(stats.classic_losses,0);
    assert.equal(r.scores.X,1);assert.equal(r.scores.O,0);
    const publicBoard=async()=> (await db.query<{result:any}>("select public.game_leaderboard('classic') result")).rows[0].result;
    let board=await publicBoard();assert.equal(board.entries.length,2);assert.equal(board.entries[0].wins,1);
    assert(!('userId' in board.entries[0]));assert(!JSON.stringify(board).includes(USERS[0]));
    await request(db,USERS[0],'profile','',command({name:'Alpha',avatarId:'orb-bot',publicLeaderboard:false}));
    board=await publicBoard();assert.equal(board.entries.length,1);
    const history=await request(db,USERS[0],'history');assert.equal(history.matches.length,1);assert.equal(history.matches[0].winner,'X');
    const stranger=await request(db,USERS[2],'history');assert.equal(stranger.matches.length,0);
  }finally{await db.close();}
});

test('finished match rows remain immutable when rematch votes change',async()=>{
  const db=await database();try{
    let r=await startMatch(db);await db.query("select private.finish_match($1,'draw','fixture')",[r.match.id]);r=(await request(db,USERS[0],'snapshot',r.code)).room;
    const before=(await db.query('select to_jsonb(m) as row from private.matches m where id=$1',[r.match.id])).rows;
    const voted=await request(db,USERS[0],'rematch',r.code,command({expectedVersion:r.version,accepted:true}));assert(!voted.error,JSON.stringify(voted));
    assert.deepEqual((await db.query('select to_jsonb(m) as row from private.matches m where id=$1',[r.match.id])).rows,before);
  }finally{await db.close();}
});

test('revoked guests cannot replay receipts to retrieve private snapshots',async()=>{
  const db=await database();try{
    let r=await startMatch(db);const c=command({expectedVersion:r.match.version,cellIndex:0});r=(await request(db,USERS[0],'move',r.code,c)).room;
    await request(db,USERS[0],'leave',r.code,command({expectedVersion:r.match.version}));
    assert.equal((await request(db,USERS[0],'move',r.code,c)).error.code,'NOT_MEMBER');
    const remaining=(await request(db,USERS[1],'snapshot',r.code)).room;
    assert.equal(remaining.match.winner,'O');assert.equal(remaining.match.reason,'deliberate_leave');
    assert.equal(remaining.members.find((member:any)=>member.slot==='X').profile.name,'Alpha');
    assert.equal((await request(db,USERS[1],'rematch',r.code,command({expectedVersion:remaining.version,accepted:true}))).error.code,'NOT_READY');
  }finally{await db.close();}
});

test('heartbeat resumes within grace and cannot resurrect a match after timeout',async()=>{
  const db=await database();try{
    let r=await startMatch(db);
    await db.query("update private.room_members set last_seen_at=now()-interval '15 seconds' where user_id=$1",[USERS[0]]);
    r=(await request(db,USERS[1],'snapshot',r.code)).room;assert.equal(r.match.phase,'paused');
    r=(await request(db,USERS[0],'heartbeat',r.code,command())).room;assert.equal(r.match.phase,'classic_turn');assert.deepEqual(r.match.board,Array(9).fill(null));
    await db.query("update private.room_members set last_seen_at=now()-interval '45 seconds' where user_id=$1",[USERS[0]]);
    await db.exec('select private.sweep_deadlines()');
    r=(await request(db,USERS[0],'heartbeat',r.code,command())).room;assert.equal(r.match.phase,'finished');assert.equal(r.match.winner,'O');assert.equal(r.match.reason,'reconnect_timeout');
  }finally{await db.close();}
});

test('Clash reconnect restarts identical config, and missing submissions get a 30-second grace before forfeit',async()=>{
  const db=await database();try{
    let r=await startMatch(db,'clash');const previous=r.match.round;
    await db.query("update private.room_members set last_seen_at=now()-interval '15 seconds' where user_id=$1",[USERS[0]]);
    r=(await request(db,USERS[1],'snapshot',r.code)).room;assert.equal(r.match.phase,'paused');
    r=(await request(db,USERS[0],'heartbeat',r.code,command())).room;
    assert.equal(r.match.phase,'round');assert.notEqual(r.match.round.id,previous.id);assert.deepEqual(r.match.round.config,previous.config);
    await db.query("update private.clash_rounds set submit_by=now()-interval '1 second' where id=$1",[r.match.round.id]);
    r=(await request(db,USERS[1],'snapshot',r.code)).room;assert.equal(r.match.phase,'round');
    await db.query("update private.clash_rounds set submit_by=now()-interval '31 seconds' where id=$1",[r.match.round.id]);
    await db.exec('select private.sweep_deadlines()');
    r=(await request(db,USERS[1],'snapshot',r.code)).room;assert.equal(r.match.winner,'abandoned');
  }finally{await db.close();}
});

test('direct RPC malformed profile returns a bounded error and anonymous callers may only read public rankings',async()=>{
  const db=await database();try{
    assert.equal((await request(db,USERS[0],'profile','',command({name:null,avatarId:'orb-bot',publicLeaderboard:true}))).error.code,'INVALID_INPUT');
    await db.exec('set role anon');
    const result=(await db.query<{result:{entries:unknown[]}}>("select public.game_leaderboard('classic') result")).rows[0].result;
    assert.deepEqual(result.entries,[]);await db.exec('reset role');
    await profile(db,USERS[0],'Alpha');
  }finally{await db.close();}
});

test('leaving countdown does not credit a played match',async()=>{
  const db=await database();try{
    let r=(await import('./helpers/database').then(h=>h.room(db))).room;
    r=(await request(db,USERS[1],'join',r.code,command())).room;
    r=(await request(db,USERS[0],'ready',r.code,command({expectedVersion:r.version,ready:true}))).room;
    r=(await request(db,USERS[1],'ready',r.code,command({expectedVersion:r.version,ready:true}))).room;
    assert.equal(r.match.phase,'countdown');
    await request(db,USERS[0],'leave',r.code,command({expectedVersion:r.match.version}));
    const stats=(await db.query<{wins:number}>('select sum(classic_wins)::int wins from private.player_stats')).rows[0];
    assert.equal(stats.wins,0);
  }finally{await db.close();}
});

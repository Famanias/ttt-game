import test from 'node:test';
import assert from 'node:assert/strict';
import { database, request, command, room, USERS } from './helpers/database';
import type { PGlite } from '@electric-sql/pglite';

export async function start(db:PGlite,mode='classic') {
  let r=(await room(db,mode)).room;
  r=(await request(db,USERS[1],'join',r.code,command())).room;
  r=(await request(db,USERS[0],'ready',r.code,command({expectedVersion:r.version,ready:true}))).room;
  assert.equal(r.match,null);
  r=(await request(db,USERS[1],'ready',r.code,command({expectedVersion:r.version,ready:true}))).room;
  assert.equal(r.match.phase,'countdown');
  await db.query("update private.matches set start_at=now()-interval '1 second' where id=$1",[r.match.id]);
  return (await request(db,USERS[0],'snapshot',r.code)).room;
}

test('Classic starts only after both ready and rejects early, wrong, occupied, stale and terminal moves',async()=>{
  const db=await database();try{
    let r=await start(db);
    assert.equal(r.match.turn,'X');
    const bad=await request(db,USERS[1],'move',r.code,command({expectedVersion:r.match.version,cellIndex:0}));
    assert.equal(bad.error.code,'NOT_YOUR_TURN');
    const first=command({expectedVersion:r.match.version,cellIndex:0});
    r=(await request(db,USERS[0],'move',r.code,first)).room;
    assert.deepEqual((await request(db,USERS[0],'move',r.code,first)).room,r);
    assert.equal((await request(db,USERS[1],'move',r.code,command({expectedVersion:r.match.version-1,cellIndex:1}))).error.code,'STALE_VERSION');
    assert.equal((await request(db,USERS[1],'move',r.code,command({expectedVersion:r.match.version,cellIndex:0}))).error.code,'CELL_OCCUPIED');
    for(const [actor,cell] of [[1,3],[0,1],[1,4],[0,2]])r=(await request(db,USERS[actor],'move',r.code,command({expectedVersion:r.match.version,cellIndex:cell}))).room;
    assert.equal(r.match.winner,'X');assert.equal(r.match.phase,'finished');
    assert.equal((await request(db,USERS[1],'move',r.code,command({expectedVersion:r.match.version,cellIndex:5}))).error.code,'WRONG_PHASE');
    assert.equal((await db.query<{count:number}>('select count(*)::int from private.moves')).rows[0].count,5);
    const oldId=r.match.id;
    r=(await request(db,USERS[0],'rematch',r.code,command({expectedVersion:r.match.version,accepted:true}))).room;
    assert.equal(r.match.id,oldId);
    r=(await request(db,USERS[1],'rematch',r.code,command({expectedVersion:r.match.version,accepted:true}))).room;
    assert.notEqual(r.match.id,oldId);assert.deepEqual(r.match.board,Array(9).fill(null));assert.equal(r.match.turn,'X');
    assert.equal((await db.query<{outcome:string}>('select outcome from private.matches where id=$1',[oldId])).rows[0].outcome,'X');
  }finally{await db.close();}
});

test('database checks every winning triple and full-board draws',async()=>{
  const db=await database();try{
    const triples=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const triple of triples){
      const {rows}=await db.query<{result:{winner:string;line:number[]}}>('select private.board_result($1::text[]) as result',[Array.from({length:9},(_,i)=>triple.includes(i)?'O':null)]);
      assert.equal(rows[0].result.winner,'O');assert.deepEqual(rows[0].result.line,triple);
    }
    assert.equal((await db.query<{result:{winner:string}}>('select private.board_result($1::text[]) as result',[['X','O','X','X','O','O','O','X','X']])).rows[0].result.winner,'draw');
  }finally{await db.close();}
});

test('private channel denies nonmembers and prevents reading other room events or forging broadcasts',async()=>{
  const db=await database();try{
    const a=(await room(db)).room;
    await request(db,USERS[1],'create','',command({mode:'classic'}));
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('realtime.topic',$2,false)",[USERS[0],`room:${a.id}`]);
    const rows=(await db.query<{topic:string}>('select topic from realtime.messages')).rows;
    assert(rows.length>0);assert(rows.every(row=>row.topic===`room:${a.id}`));
    await assert.rejects(db.query("insert into realtime.messages(topic,extension,payload) values($1,'broadcast','{}')",[`room:${a.id}`]),/row-level security|permission denied/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[USERS[2]]);
    assert.equal((await db.query('select * from realtime.messages')).rows.length,0);
    await db.exec('reset role');
  }finally{await db.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { database, request, command, profile, room, USERS } from './helpers/database';

test('private room seats, replay, duplicate join and nonmember snapshot are database enforced', async () => {
  const db = await database();
  try {
    const c = command({ mode: 'classic' });
    await profile(db, USERS[0], 'Alpha'); await profile(db, USERS[1], 'Beta');
    const first = await request(db, USERS[0], 'create', '', c);
    assert.match(first.room.code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(first.room.members.length, 1);
    assert.deepEqual(await request(db, USERS[0], 'create', '', c), first);
    assert.equal((await request(db, USERS[2], 'snapshot', first.room.code)).error.code, 'NOT_MEMBER');
    const joined = await request(db, USERS[1], 'join', first.room.code.toLowerCase(), command());
    assert.equal(joined.room.members.length, 2);
    assert.equal(joined.room.status, 'waiting');
    assert.equal((await request(db, USERS[1], 'join', first.room.code, command())).room.members.length, 2);
    await profile(db, USERS[2], 'Gamma');
    assert.equal((await request(db, USERS[2], 'join', first.room.code, command())).error.code, 'ROOM_FULL');
  } finally { await db.close(); }
});

test('expired codes, invalid profiles and room guessing are bounded even when requests fail', async () => {
  const db = await database();
  try {
    const created = await room(db);
    await db.query("update private.rooms set expires_at = now() - interval '1 second' where code=$1", [created.room.code]);
    assert.equal((await request(db, USERS[1], 'join', created.room.code, command())).error.code, 'ROOM_EXPIRED');
    assert.equal((await request(db, USERS[2], 'profile', '', command({ name:'<script>', avatarId:'anything' }))).error.code, 'INVALID_INPUT');
    let last;
    for (let i=0;i<25;i++) last = await request(db, USERS[2], 'join', 'AAAAAA', command());
    assert.equal(last!.error.code, 'RATE_LIMITED');
  } finally { await db.close(); }
});

test('direct writes and anonymous RPC cannot bypass authoritative commands', async () => {
  const db = await database();
  try {
    await room(db);
    await db.exec('set role authenticated');
    await assert.rejects(db.exec("update private.rooms set status='active'"), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query("select public.game_request('create','','{}')"), /permission denied/);
    await db.exec('reset role');
    const { rows } = await db.query<{count:number}>("select count(*)::int from pg_tables where schemaname='private' and not rowsecurity");
    assert.equal(rows[0].count, 0);
  } finally { await db.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { database, request, command, startMatch, profile, register, USERS } from './helpers/database';

test('unregistered guests cannot join leaderboard or access persistent history', async () => {
  const db = await database();
  try {
    const blockedOptIn = await request(db, USERS[0], 'profile', '', command({
      name: 'GuestOne',
      avatarId: 'orb-bot',
      publicLeaderboard: true,
    }));
    assert.equal(blockedOptIn.error.code, 'ACCOUNT_REQUIRED');

    let r = await startMatch(db);
    for (const [actor, cell] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]]) {
      r = (await request(db, USERS[actor], 'move', r.code, command({ expectedVersion: r.match.version, cellIndex: cell }))).room;
    }

    const board = (await db.query<{ result: { entries: unknown[] } }>("select public.game_leaderboard('classic') result")).rows[0].result;
    assert.equal(board.entries.length, 0);

    const history = await request(db, USERS[0], 'history');
    assert.equal(history.error.code, 'ACCOUNT_REQUIRED');

    const profileGet = await request(db, USERS[0], 'profile_get');
    assert.equal(profileGet.profile.isRegistered, false);
    assert.equal(profileGet.stats, null);
  } finally {
    await db.close();
  }
});

test('guests share casual names cleanly and cannot claim a registered username', async () => {
  const db = await database();
  try {
    await register(db, USERS[2], 'Hero_99', true);

    const g1 = await profile(db, USERS[0], 'Player X');
    const g2 = await profile(db, USERS[1], 'Player X');
    assert.equal(g1.profile.name, 'Player X');
    assert.equal(g2.profile.name, 'Player X');

    const impersonate = await profile(db, USERS[0], 'hero_99');
    assert.equal(impersonate.error.code, 'NAME_TAKEN');
  } finally {
    await db.close();
  }
});

test('guest progress and match history carry over cleanly on account registration', async () => {
  const db = await database();
  try {
    let r = await startMatch(db, 'classic');
    for (const [actor, cell] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]]) {
      r = (await request(db, USERS[0] === USERS[actor] ? USERS[0] : USERS[1], 'move', r.code, command({ expectedVersion: r.match.version, cellIndex: cell }))).room;
    }
    assert.equal(r.match.winner, 'X');

    const account = await register(db, USERS[3], 'CarriedHero', true, USERS[0]);
    assert.equal(account.registered, true);
    assert.equal(account.username, 'CarriedHero');
    assert.equal(account.stats.classicWins, 1);

    const board = (await db.query<{ result: { entries: Array<{ name: string; wins: number }> } }>("select public.game_leaderboard('classic') result")).rows[0].result;
    assert.equal(board.entries.length, 1);
    assert.equal(board.entries[0].name, 'CarriedHero');
    assert.equal(board.entries[0].wins, 1);

    const history = await request(db, USERS[3], 'history');
    assert.equal(history.matches.length, 1);
    assert.equal(history.matches[0].winner, 'X');
    assert.equal(history.matches[0].myMark, 'X');
    assert.equal(history.matches[0].opponentName, 'Beta');

    // Registered user's display username cannot be overwritten by profile saves, while avatar & leaderboard opt-in update cleanly.
    const updated = await request(db, USERS[3], 'profile', '', command({
      name: 'Impostor',
      avatarId: 'spark-eye',
      publicLeaderboard: false,
    }));
    assert.equal(updated.profile.name, 'CarriedHero');
    assert.equal(updated.profile.avatarId, 'spark-eye');
    assert.equal(updated.profile.publicLeaderboard, false);
    assert.equal(updated.profile.isRegistered, true);
  } finally {
    await db.close();
  }
});

test('auth helpers enforce unique usernames, rate limits and privilege separation', async () => {
  const db = await database();
  try {
    await register(db, USERS[0], 'UniqueUser', true);
    await assert.rejects(register(db, USERS[1], 'uniqueuser', true), /USERNAME_TAKEN/);
    await assert.rejects(register(db, USERS[2], 'BlockedCarry', true, USERS[0]));

    for (let i = 0; i < 6; i++) {
      const ok = (await db.query<{ ok: boolean }>("select public.auth_check_rate_limit('test-bucket', 6, 60) ok")).rows[0].ok;
      assert.equal(ok, true);
    }
    const over = (await db.query<{ ok: boolean }>("select public.auth_check_rate_limit('test-bucket', 6, 60) ok")).rows[0].ok;
    assert.equal(over, false);

    await db.exec('set role authenticated');
    await assert.rejects(db.query("select public.auth_username_available('Someone')"), /permission denied/);
    await assert.rejects(db.query("select public.auth_account_session($1)", [USERS[0]]), /permission denied/);
    await assert.rejects(db.query("select public.auth_complete_registration($1,'Hacker','orb-bot',true,null)", [USERS[1]]), /permission denied/);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});

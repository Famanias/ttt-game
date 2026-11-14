import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const USERS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];

export async function database() {
  const db = new PGlite();
  // Only hosted Auth and message transport are stand-ins. All application SQL,
  // privileges, policies and RPC execute in real embedded PostgreSQL.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create schema realtime;
    create table realtime.messages(id bigint generated always as identity, topic text, extension text, payload jsonb);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated;
    grant select,insert on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as
      $$ select current_setting('realtime.topic',true) $$;
    create function realtime.send(payload jsonb,event text,topic text,private boolean default true)
    returns void language sql as $$ insert into realtime.messages(topic,extension,payload) values(topic,'broadcast',payload) $$;
  `);
  for (const id of USERS) await db.query('insert into auth.users(id) values ($1)', [id]);
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  return db;
}

export async function request(db: PGlite, user: string, action: string, resource = '', payload: Record<string, unknown> = {}) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    const { rows } = await db.query<{ result: Record<string, any> }>('select public.game_request($1,$2,$3::jsonb) as result', [action, resource, JSON.stringify(payload)]);
    return rows[0].result;
  } finally { await db.exec('reset role'); }
}

export function command(payload: Record<string, unknown> = {}) {
  return { clientCommandId: randomUUID(), ...payload };
}

export async function profile(db: PGlite, user: string, name: string) {
  return request(db, user, 'profile', '', command({ name, avatarId: 'orb-bot', publicLeaderboard: true }));
}

export async function room(db: PGlite, mode = 'classic') {
  await profile(db, USERS[0], 'Alpha'); await profile(db, USERS[1], 'Beta');
  return request(db, USERS[0], 'create', '', command({ mode }));
}

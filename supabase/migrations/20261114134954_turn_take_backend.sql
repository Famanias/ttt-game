-- Online authority is private. The only exposed entry point is game_request.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (name ~ '^[[:alnum:] _.-]{2,18}$'),
  normalized_name text generated always as (lower(btrim(name))) stored unique,
  avatar_id text not null check (avatar_id in ('orb-bot','pixel-blob','shield-face','cube-runner','spark-eye','comet-mask')),
  public_leaderboard boolean not null default false,
  updated_at timestamptz not null default now()
);
create table private.rooms (
  id uuid primary key default gen_random_uuid(), code text unique not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null references auth.users(id), mode text not null check(mode in ('classic','clash')),
  status text not null default 'waiting' check(status in ('waiting','active','finished','closed')),
  version integer not null default 1, current_match_id uuid,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '2 hours'
);
create table private.room_members (
  room_id uuid not null references private.rooms(id), user_id uuid not null references private.profiles(user_id),
  slot text not null check(slot in ('X','O')), ready boolean not null default false,
  status text not null default 'active' check(status in ('active','left')),
  joined_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  primary key(room_id,user_id)
);
create unique index room_active_seat on private.room_members(room_id,slot) where status='active';
create index room_user on private.room_members(user_id,room_id) where status='active';
create table private.matches (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references private.rooms(id),
  x_id uuid not null references auth.users(id), o_id uuid not null references auth.users(id), check(x_id<>o_id),
  mode text not null check(mode in ('classic','clash')), version integer not null default 1,
  phase text not null default 'countdown' check(phase in ('countdown','classic_turn','round','claim','paused','finished')),
  board text[] not null default array[null,null,null,null,null,null,null,null,null]::text[] check(array_length(board,1)=9 and board <@ array['X','O',null]::text[]),
  turn text not null default 'X' check(turn in ('X','O')), outcome text check(outcome in ('X','O','draw','abandoned')),
  winning_line integer[], reason text, move_count integer not null default 0,
  streak_x integer not null default 0, streak_o integer not null default 0,
  best_x integer not null default 0, best_o integer not null default 0,
  pending_claims integer not null default 0 check(pending_claims between 0 and 2), claimant text check(claimant in ('X','O')),
  round_index integer not null default 0, current_round_id uuid,
  start_at timestamptz not null default now()+interval '3 seconds', deadline_at timestamptz,
  paused_phase text, paused_at timestamptz, reconnect_deadline timestamptz,
  result_applied boolean not null default false, created_at timestamptz not null default now(), finished_at timestamptz
);
alter table private.rooms add constraint room_current_match foreign key(current_match_id) references private.matches(id);
create index match_room on private.matches(room_id,created_at desc);
create index match_deadline on private.matches(deadline_at) where phase<>'finished';
create table private.moves (
  match_id uuid not null references private.matches(id), sequence integer not null,
  player_id uuid not null references auth.users(id), cell integer not null check(cell between 0 and 8),
  kind text not null check(kind in ('normal','bonus','auto')), created_at timestamptz not null default now(),
  primary key(match_id,sequence), unique(match_id,cell)
);
create table private.clash_rounds (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references private.matches(id),
  round_index integer not null, type text not null check(type in ('perfect-timing','flash-memory','target-rush')),
  seed integer not null, config jsonb not null, scoring_version integer not null default 1,
  start_at timestamptz not null, end_at timestamptz not null, submit_by timestamptz not null,
  status text not null default 'playing' check(status in ('playing','resolved','cancelled')),
  winner text check(winner in ('X','O')), sudden_death boolean not null default false,
  parent_id uuid references private.clash_rounds(id), unique(match_id,round_index)
);
alter table private.matches add constraint current_round foreign key(current_round_id) references private.clash_rounds(id);
create table private.clash_submissions (
  round_id uuid not null references private.clash_rounds(id), user_id uuid not null references auth.users(id),
  trace jsonb not null, score integer not null, tie_break integer not null default 0,
  received_at timestamptz not null default now(), primary key(round_id,user_id)
);
create table private.rematch_votes (
  match_id uuid not null references private.matches(id), user_id uuid not null references auth.users(id),
  accepted boolean not null, created_at timestamptz not null default now(), primary key(match_id,user_id)
);
create table private.player_stats (
  user_id uuid primary key references private.profiles(user_id),
  classic_wins integer not null default 0, classic_losses integer not null default 0, classic_draws integer not null default 0,
  clash_wins integer not null default 0, clash_losses integer not null default 0, clash_draws integer not null default 0,
  rounds_won integer not null default 0, rounds_played integer not null default 0, longest_streak integer not null default 0,
  updated_at timestamptz not null default now()
);
create index leaderboard_clash on private.player_stats(clash_wins desc,user_id);
create table private.command_receipts (
  actor uuid not null references auth.users(id), command_id uuid not null,
  action text not null, resource text not null, payload jsonb not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(actor,command_id)
);
create table private.rate_limits (
  actor uuid not null references auth.users(id), action text not null,
  window_at timestamptz not null, count integer not null, primary key(actor,action)
);

do $$ declare t text; begin
  foreach t in array array['profiles','rooms','room_members','matches','moves','clash_rounds','clash_submissions','rematch_votes','player_stats','command_receipts','rate_limits'] loop
    execute format('alter table private.%I enable row level security',t);
  end loop;
end $$;
revoke all on all tables in schema private from public,anon,authenticated;

create function private.is_member(room_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.room_members m join private.rooms r on r.id=m.room_id
    where m.room_id=$1 and m.user_id=(select auth.uid()) and m.status='active' and r.status<>'closed' and r.expires_at>now())
$$;
create function private.can_receive(topic text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.rooms r where 'room:'||r.id::text=$1 and private.is_member(r.id))
$$;
create policy room_broadcast_read on realtime.messages for select to authenticated
  using (extension in ('broadcast','presence') and private.can_receive(realtime.topic()));
create policy room_presence_write on realtime.messages for insert to authenticated
  with check (extension='presence' and private.can_receive(realtime.topic()));

create function private.notify_room() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform realtime.send(jsonb_build_object('roomId',new.id,'version',new.version),'room_updated','room:'||new.id::text,true);
  return new;
end $$;
create trigger room_committed after insert or update of version on private.rooms for each row execute function private.notify_room();

create function private.snapshot(room_id uuid,actor uuid) returns jsonb language plpgsql set search_path='' as $$
declare r private.rooms; members jsonb;
begin
  select * into r from private.rooms where id=room_id;
  if not private.is_member(room_id) then raise exception 'NOT_MEMBER'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'slot',m.slot,'ready',m.ready,
    'lastSeenAt',m.last_seen_at,'profile',jsonb_build_object('name',p.name,'avatarId',p.avatar_id)) order by m.slot),'[]')
    into members from private.room_members m join private.profiles p on p.user_id=m.user_id where m.room_id=r.id and m.status='active';
  return jsonb_build_object('room',jsonb_build_object('id',r.id,'code',r.code,'mode',r.mode,'status',r.status,'version',r.version,
    'members',members,'myMark',(select slot from private.room_members where room_members.room_id=r.id and user_id=actor),
    'match',null,'serverNow',clock_timestamp(),'expiresAt',r.expires_at));
end $$;

create function private.room_command(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare r private.rooms; code text; i integer; uid uuid;
begin
  if action='profile_get' then
    return jsonb_build_object('profile',(select jsonb_build_object('name',name,'avatarId',avatar_id,'publicLeaderboard',public_leaderboard) from private.profiles where user_id=actor));
  elsif action='profile' then
    if not (p->>'name' ~ '^[[:alnum:] _.-]{2,18}$') or coalesce(p->>'avatarId','') not in ('orb-bot','pixel-blob','shield-face','cube-runner','spark-eye','comet-mask') or jsonb_typeof(p->'publicLeaderboard') is distinct from 'boolean' then raise exception 'INVALID_INPUT'; end if;
    insert into private.profiles(user_id,name,avatar_id,public_leaderboard) values(actor,btrim(p->>'name'),p->>'avatarId',(p->>'publicLeaderboard')::boolean)
      on conflict(user_id) do update set name=excluded.name,avatar_id=excluded.avatar_id,public_leaderboard=excluded.public_leaderboard,updated_at=now();
    insert into private.player_stats(user_id) values(actor) on conflict do nothing;
    return private.room_command(actor,'profile_get','',p);
  elsif action='create' then
    if coalesce(p->>'mode','') not in ('classic','clash') then raise exception 'INVALID_INPUT'; end if;
    if not exists(select 1 from private.profiles where user_id=actor) then raise exception 'PROFILE_REQUIRED'; end if;
    for i in 1..8 loop
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',get_byte(decode(replace(gen_random_uuid()::text,'-',''),'hex'),0)%32+1,1),'') into code from generate_series(1,6);
      begin
        insert into private.rooms(code,host_id,mode) values(code,actor,p->>'mode') returning * into r;
        exit;
      exception when unique_violation then if i=8 then raise exception 'RETRY_REQUIRED'; end if;
      end;
    end loop;
    insert into private.room_members(room_id,user_id,slot) values(r.id,actor,'X');
    return private.snapshot(r.id,actor);
  end if;
  select * into r from private.rooms where rooms.code=resource for update;
  if not found then raise exception 'INVALID_CODE'; end if;
  if r.expires_at<=now() or r.status='closed' then raise exception 'ROOM_EXPIRED'; end if;
  if action='join' then
    if exists(select 1 from private.room_members where room_id=r.id and user_id=actor and status='active') then return private.snapshot(r.id,actor); end if;
    if not exists(select 1 from private.profiles where user_id=actor) then raise exception 'PROFILE_REQUIRED'; end if;
    if (select count(*) from private.room_members where room_id=r.id and status='active')>=2 then raise exception 'ROOM_FULL'; end if;
    if r.status<>'waiting' then raise exception 'WRONG_PHASE'; end if;
    insert into private.room_members(room_id,user_id,slot) values(r.id,actor,'O')
      on conflict(room_id,user_id) do update set status='active',ready=false,last_seen_at=now();
    update private.rooms set version=version+1 where id=r.id;
    return private.snapshot(r.id,actor);
  end if;
  if not private.is_member(r.id) then raise exception 'NOT_MEMBER'; end if;
  if action='snapshot' then return private.snapshot(r.id,actor); end if;
  raise exception 'WRONG_PHASE';
end $$;

-- Error trapping encloses the command, NOT the limiter, so failed guesses count.
create function private.request(p_action text,p_resource text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); c uuid; prior private.command_receipts; result jsonb; v_count integer; limit_count integer; normalized text:=upper(btrim(p_resource));
begin
  if v_actor is null then return jsonb_build_object('error',jsonb_build_object('code','RECONNECT_REQUIRED')); end if;
  if octet_length(p::text)>16384 or jsonb_typeof(p)<>'object' then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT')); end if;
  if p_action not in ('snapshot','profile_get','match_snapshot','leaderboard','history') then
    begin c:=(p->>'clientCommandId')::uuid; exception when others then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT')); end;
    if c is null then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT')); end if;
    -- Same-v_actor commands (including identical first requests) are serialized.
    perform pg_advisory_xact_lock(hashtextextended(v_actor::text,0));
    select * into prior from private.command_receipts where command_id=c and command_receipts.actor=v_actor;
    if found then
      if prior.action<>p_action or prior.resource<>normalized or prior.payload<>p then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT')); end if;
      return prior.result;
    end if;
  end if;
  limit_count:=case p_action when 'create' then 10 when 'join' then 20 when 'submit' then 20 else 240 end;
  insert into private.rate_limits(actor,action,window_at,count) values(v_actor,p_action,date_trunc('minute',now()),1)
    on conflict on constraint rate_limits_pkey do update set count=case when private.rate_limits.window_at=excluded.window_at then private.rate_limits.count+1 else 1 end,window_at=excluded.window_at returning rate_limits.count into v_count;
  if v_count>limit_count then return jsonb_build_object('error',jsonb_build_object('code','RATE_LIMITED')); end if;
  begin
    result:=private.room_command(v_actor,p_action,normalized,p);
    if c is not null then insert into private.command_receipts(actor,command_id,action,resource,payload,result) values(v_actor,c,p_action,normalized,p,result); end if;
    return result;
  exception when unique_violation then return jsonb_build_object('error',jsonb_build_object('code','NAME_TAKEN'));
    when others then
      if sqlerrm in ('INVALID_INPUT','INVALID_CODE','ROOM_FULL','ROOM_EXPIRED','PROFILE_REQUIRED','NOT_MEMBER','WRONG_PHASE','STALE_VERSION','NOT_READY','NOT_YOUR_TURN','CELL_OCCUPIED','ROUND_CLOSED','ALREADY_SUBMITTED','RECONNECT_REQUIRED','RETRY_REQUIRED') then
        return jsonb_build_object('error',jsonb_build_object('code',sqlerrm));
      end if;
      raise;
  end;
end $$;
create function public.game_request(p_action text,p_resource text default '',p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
  select private.request(p_action,p_resource,p_payload)
$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.request(text,text,jsonb),private.can_receive(text) to authenticated;
revoke all on function public.game_request(text,text,jsonb) from public,anon;
grant execute on function public.game_request(text,text,jsonb) to authenticated;

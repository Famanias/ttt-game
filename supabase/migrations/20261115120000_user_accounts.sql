-- Optional username+password accounts with guest progress carry-over and account-gated leaderboard/history.
alter table private.profiles add column is_registered boolean not null default false;

do $$ declare con text; begin
  select conname into con from pg_constraint where conrelid='private.profiles'::regclass and contype='u' limit 1;
  if con is not null then execute format('alter table private.profiles drop constraint %I',con); end if;
end $$;

create unique index profiles_registered_username_key on private.profiles(normalized_name) where is_registered;

create table private.auth_rate_limits (
  key text primary key,
  window_at timestamptz not null,
  count integer not null
);
alter table private.auth_rate_limits enable row level security;
revoke all on table private.auth_rate_limits from public,anon,authenticated;

create or replace function private.reject_finished_update() returns trigger language plpgsql set search_path='' as $$
declare migrating text:=nullif(current_setting('turn_take.migrating_guest',true),'');
begin
  if old.phase='finished' and to_jsonb(new)<>to_jsonb(old) then
    if migrating is not null
      and (to_jsonb(new)-'x_id'-'o_id')=(to_jsonb(old)-'x_id'-'o_id')
      and (
        (old.x_id::text=migrating and new.o_id=old.o_id and new.x_id<>old.x_id)
        or (old.o_id::text=migrating and new.x_id=old.x_id and new.o_id<>old.o_id)
      ) then
      return new;
    end if;
    raise exception 'WRONG_PHASE';
  end if;
  return new;
end $$;

create or replace function public.game_leaderboard(p_mode text default 'clash') returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('casual',true,'mode',p_mode,'entries',coalesce(jsonb_agg(entry order by rank),'[]')) from (
    select row_number() over(order by wins desc, case when wins+losses+draws>0 then wins::numeric/(wins+losses+draws) else 0 end desc,name) rank,
      jsonb_build_object('id','position-'||row_number() over(order by wins desc,case when wins+losses+draws>0 then wins::numeric/(wins+losses+draws) else 0 end desc,name),
      'name',name,'avatarId',avatar_id,'wins',wins,'losses',losses,'draws',draws,'matchesPlayed',wins+losses+draws,
      'bestStreak',longest_streak,'clashWins',clash_wins,'classicWins',classic_wins,'updatedAt',floor(extract(epoch from updated_at)*1000)) entry
    from (
      select p.name,p.avatar_id,s.*,case when p_mode='classic' then s.classic_wins else s.clash_wins end wins,
        case when p_mode='classic' then s.classic_losses else s.clash_losses end losses,
        case when p_mode='classic' then s.classic_draws else s.clash_draws end draws
      from private.player_stats s join private.profiles p on p.user_id=s.user_id
      where p.is_registered and p.public_leaderboard and p_mode in ('classic','clash') and s.classic_wins+s.classic_losses+s.classic_draws+s.clash_wins+s.clash_losses+s.clash_draws>0
    ) stats order by wins desc,case when wins+losses+draws>0 then wins::numeric/(wins+losses+draws) else 0 end desc,name limit 50
  ) standings
$$;
revoke all on function public.game_leaderboard(text) from public;
grant execute on function public.game_leaderboard(text) to anon,authenticated;

create or replace function private.room_base(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare r private.rooms; code text; i integer; uid uuid; v_registered boolean:=false;
begin
  if action='profile_get' then
    return jsonb_build_object(
      'profile',(select jsonb_build_object('name',p2.name,'avatarId',p2.avatar_id,'publicLeaderboard',p2.public_leaderboard,'isRegistered',p2.is_registered) from private.profiles p2 where p2.user_id=actor),
      'stats',(select jsonb_build_object(
        'classicWins',s.classic_wins,'classicLosses',s.classic_losses,'classicDraws',s.classic_draws,
        'clashWins',s.clash_wins,'clashLosses',s.clash_losses,'clashDraws',s.clash_draws,
        'roundsWon',s.rounds_won,'roundsPlayed',s.rounds_played,'longestStreak',s.longest_streak
      ) from private.profiles p2 join private.player_stats s on s.user_id=p2.user_id where p2.user_id=actor and p2.is_registered)
    );
  elsif action='profile' then
    if not (btrim(coalesce(p->>'name','')) ~ '^[[:alnum:] _.-]{2,18}$')
      or coalesce(p->>'avatarId','') not in ('orb-bot','pixel-blob','shield-face','cube-runner','spark-eye','comet-mask')
      or jsonb_typeof(p->'publicLeaderboard') is distinct from 'boolean' then
      raise exception 'INVALID_INPUT';
    end if;
    v_registered:=coalesce((select is_registered from private.profiles where user_id=actor),false);
    if not v_registered and (p->>'publicLeaderboard')::boolean then
      raise exception 'ACCOUNT_REQUIRED';
    end if;
    if not v_registered and exists(
      select 1 from private.profiles p2
      where p2.is_registered and p2.normalized_name=lower(btrim(p->>'name')) and p2.user_id<>actor
    ) then
      raise exception 'NAME_TAKEN';
    end if;
    insert into private.profiles(user_id,name,avatar_id,public_leaderboard,is_registered)
      values(actor,btrim(p->>'name'),p->>'avatarId',case when v_registered then (p->>'publicLeaderboard')::boolean else false end,v_registered)
      on conflict(user_id) do update set
        name=case when private.profiles.is_registered then private.profiles.name else excluded.name end,
        avatar_id=excluded.avatar_id,
        public_leaderboard=case when private.profiles.is_registered then excluded.public_leaderboard else false end,
        updated_at=now();
    insert into private.player_stats(user_id) values(actor) on conflict do nothing;
    return private.room_base(actor,'profile_get','',p);
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

alter function private.room_command(uuid,text,text,jsonb) rename to pre_account_command;
create function private.room_command(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
begin
  if action='history' then
    if not coalesce((select is_registered from private.profiles where user_id=actor),false) then
      raise exception 'ACCOUNT_REQUIRED';
    end if;
    return jsonb_build_object('matches',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',h.id,
        'mode',h.mode,
        'winner',h.outcome,
        'myMark',case when h.x_id=actor then 'X' else 'O' end,
        'opponentName',coalesce((select op.name from private.profiles op where op.user_id=case when h.x_id=actor then h.o_id else h.x_id end),'Opponent'),
        'finishedAt',h.finished_at,
        'board',h.board
      ) order by h.finished_at desc)
      from (select * from private.matches where (x_id=actor or o_id=actor) and phase='finished' and outcome<>'abandoned' order by finished_at desc limit 50) h
    ),'[]'));
  end if;
  return private.pre_account_command(actor,action,resource,p);
end $$;

create or replace function private.request(p_action text,p_resource text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); c uuid; prior private.command_receipts; result jsonb; v_count integer; limit_count integer; normalized text:=upper(btrim(p_resource));
begin
  if v_actor is null then return jsonb_build_object('error',jsonb_build_object('code','RECONNECT_REQUIRED')); end if;
  if octet_length(p::text)>16384 or jsonb_typeof(p)<>'object' then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT')); end if;
  if p_action not in ('snapshot','profile_get','match_snapshot','leaderboard','history') then
    begin c:=(p->>'clientCommandId')::uuid; exception when others then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT')); end;
    if c is null then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT')); end if;
    perform pg_advisory_xact_lock(hashtextextended(v_actor::text,0));
    select * into prior from private.command_receipts where command_id=c and command_receipts.actor=v_actor;
    if found then
      if prior.action<>p_action or prior.resource<>normalized or prior.payload<>p then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT')); end if;
      if prior.result#>>'{room,id}' is not null and not private.is_member((prior.result#>>'{room,id}')::uuid) then return jsonb_build_object('error',jsonb_build_object('code','NOT_MEMBER')); end if;
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
  exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error',jsonb_build_object('code','INVALID_INPUT'));
    when unique_violation then return jsonb_build_object('error',jsonb_build_object('code','NAME_TAKEN'));
    when others then
      if sqlerrm in ('INVALID_INPUT','INVALID_CODE','ROOM_FULL','ROOM_EXPIRED','PROFILE_REQUIRED','NOT_MEMBER','WRONG_PHASE','STALE_VERSION','NOT_READY','NOT_YOUR_TURN','CELL_OCCUPIED','ROUND_CLOSED','ALREADY_SUBMITTED','RECONNECT_REQUIRED','RETRY_REQUIRED','RESUME_LIMIT','ACCOUNT_REQUIRED','USERNAME_TAKEN','NAME_TAKEN') then
        return jsonb_build_object('error',jsonb_build_object('code',sqlerrm));
      end if;
      raise;
  end;
end $$;

create function public.auth_check_rate_limit(p_key text,p_limit integer,p_window_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare bucket timestamptz; v_count integer;
begin
  if coalesce(btrim(p_key),'')='' or p_limit<1 or p_window_seconds<1 then return false; end if;
  bucket:=to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into private.auth_rate_limits(key,window_at,count) values(p_key,bucket,1)
    on conflict(key) do update set
      count=case when private.auth_rate_limits.window_at=excluded.window_at then private.auth_rate_limits.count+1 else 1 end,
      window_at=excluded.window_at
    returning private.auth_rate_limits.count into v_count;
  return v_count<=p_limit;
end $$;

create function public.auth_username_available(p_username text) returns boolean language sql stable security definer set search_path='' as $$
  select btrim(coalesce(p_username,'')) ~ '^[A-Za-z0-9_.-]{3,18}$'
    and not exists(select 1 from private.profiles where is_registered and normalized_name=lower(btrim(p_username)))
$$;

create function public.auth_account_session(p_user_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(
    (select jsonb_build_object(
      'registered',true,
      'username',p.name,
      'avatarId',p.avatar_id,
      'publicLeaderboard',p.public_leaderboard,
      'stats',jsonb_build_object(
        'classicWins',coalesce(s.classic_wins,0),
        'classicLosses',coalesce(s.classic_losses,0),
        'classicDraws',coalesce(s.classic_draws,0),
        'clashWins',coalesce(s.clash_wins,0),
        'clashLosses',coalesce(s.clash_losses,0),
        'clashDraws',coalesce(s.clash_draws,0),
        'roundsWon',coalesce(s.rounds_won,0),
        'roundsPlayed',coalesce(s.rounds_played,0),
        'longestStreak',coalesce(s.longest_streak,0)
      )
    )
    from private.profiles p left join private.player_stats s on s.user_id=p.user_id
    where p.user_id=p_user_id and p.is_registered),
    jsonb_build_object('registered',false)
  )
$$;

create function public.auth_complete_registration(
  p_user_id uuid,
  p_username text,
  p_avatar_id text default 'orb-bot',
  p_public_leaderboard boolean default false,
  p_guest_user_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_username text:=btrim(coalesce(p_username,''));
  g private.player_stats;
  v_has_guest boolean:=false;
begin
  if v_username !~ '^[A-Za-z0-9_.-]{3,18}$'
    or coalesce(p_avatar_id,'') not in ('orb-bot','pixel-blob','shield-face','cube-runner','spark-eye','comet-mask') then
    raise exception 'INVALID_INPUT';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'INVALID_INPUT'; end if;
  if exists(select 1 from private.profiles where user_id=p_user_id and is_registered) then raise exception 'ALREADY_REGISTERED'; end if;
  if exists(select 1 from private.profiles where is_registered and normalized_name=lower(v_username) and user_id<>p_user_id) then
    raise exception 'USERNAME_TAKEN';
  end if;

  if p_guest_user_id is not null and p_guest_user_id<>p_user_id then
    if exists(select 1 from private.profiles where user_id=p_guest_user_id and is_registered) then
      raise exception 'INVALID_INPUT';
    end if;
    v_has_guest:=true;
    select * into g from private.player_stats where user_id=p_guest_user_id for update;
  end if;

  insert into private.profiles(user_id,name,avatar_id,public_leaderboard,is_registered)
    values(p_user_id,v_username,p_avatar_id,coalesce(p_public_leaderboard,false),true)
    on conflict(user_id) do update set
      name=excluded.name,
      avatar_id=excluded.avatar_id,
      public_leaderboard=excluded.public_leaderboard,
      is_registered=true,
      updated_at=now();

  insert into private.player_stats(
    user_id,classic_wins,classic_losses,classic_draws,
    clash_wins,clash_losses,clash_draws,
    rounds_won,rounds_played,longest_streak
  ) values (
    p_user_id,
    coalesce(g.classic_wins,0),coalesce(g.classic_losses,0),coalesce(g.classic_draws,0),
    coalesce(g.clash_wins,0),coalesce(g.clash_losses,0),coalesce(g.clash_draws,0),
    coalesce(g.rounds_won,0),coalesce(g.rounds_played,0),coalesce(g.longest_streak,0)
  )
  on conflict(user_id) do update set
    classic_wins=private.player_stats.classic_wins+coalesce(g.classic_wins,0),
    classic_losses=private.player_stats.classic_losses+coalesce(g.classic_losses,0),
    classic_draws=private.player_stats.classic_draws+coalesce(g.classic_draws,0),
    clash_wins=private.player_stats.clash_wins+coalesce(g.clash_wins,0),
    clash_losses=private.player_stats.clash_losses+coalesce(g.clash_losses,0),
    clash_draws=private.player_stats.clash_draws+coalesce(g.clash_draws,0),
    rounds_won=private.player_stats.rounds_won+coalesce(g.rounds_won,0),
    rounds_played=private.player_stats.rounds_played+coalesce(g.rounds_played,0),
    longest_streak=greatest(private.player_stats.longest_streak,coalesce(g.longest_streak,0)),
    updated_at=now();

  if v_has_guest then
    update private.rooms set host_id=p_user_id where host_id=p_guest_user_id;
    update private.room_members set user_id=p_user_id where user_id=p_guest_user_id;
    perform set_config('turn_take.migrating_guest',p_guest_user_id::text,true);
    update private.matches set x_id=p_user_id where x_id=p_guest_user_id;
    update private.matches set o_id=p_user_id where o_id=p_guest_user_id;
    perform set_config('turn_take.migrating_guest','',true);
    update private.moves set player_id=p_user_id where player_id=p_guest_user_id;
    update private.clash_submissions set user_id=p_user_id where user_id=p_guest_user_id;
    update private.rematch_votes set user_id=p_user_id where user_id=p_guest_user_id;
    delete from private.command_receipts where actor=p_guest_user_id;
    delete from private.rate_limits where actor=p_guest_user_id;
    delete from private.player_stats where user_id=p_guest_user_id;
    delete from private.profiles where user_id=p_guest_user_id;
  end if;

  return public.auth_account_session(p_user_id);
exception when unique_violation then
  raise exception 'USERNAME_TAKEN';
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.request(text,text,jsonb),private.can_receive(text) to authenticated;

revoke all on function
  public.auth_check_rate_limit(text,integer,integer),
  public.auth_username_available(text),
  public.auth_account_session(uuid),
  public.auth_complete_registration(uuid,text,text,boolean,uuid)
from public,anon,authenticated;

do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    execute 'grant execute on function
      public.auth_check_rate_limit(text,integer,integer),
      public.auth_username_available(text),
      public.auth_account_session(uuid),
      public.auth_complete_registration(uuid,text,text,boolean,uuid)
      to service_role';
  end if;
end $$;

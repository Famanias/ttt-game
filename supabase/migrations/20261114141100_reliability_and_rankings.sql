-- Harden replay/malformed input and keep finalized history immutable.
create or replace function private.request(p_action text,p_resource text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
      if sqlerrm in ('INVALID_INPUT','INVALID_CODE','ROOM_FULL','ROOM_EXPIRED','PROFILE_REQUIRED','NOT_MEMBER','WRONG_PHASE','STALE_VERSION','NOT_READY','NOT_YOUR_TURN','CELL_OCCUPIED','ROUND_CLOSED','ALREADY_SUBMITTED','RECONNECT_REQUIRED','RETRY_REQUIRED') then
        return jsonb_build_object('error',jsonb_build_object('code',sqlerrm));
      end if;
      raise;
  end;
end $$;
create or replace function private.classic_command(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare r private.rooms; m private.matches; mark text; idx integer; result jsonb; requested_id uuid;
begin
  if action in ('profile','profile_get','create','join') then return private.room_base(actor,action,resource,p); end if;
  if action='match_snapshot' then
    select room_id,id into r.id,requested_id from private.matches where id=resource::uuid;
    if not found or not private.is_member(r.id) then raise exception 'NOT_MEMBER'; end if;
    select * into r from private.rooms where id=r.id for update;
  else
    select * into r from private.rooms where code=resource for update;
  end if;
  if r.id is null then raise exception 'INVALID_CODE'; end if;
  if r.status='closed' or r.expires_at<=now() then raise exception 'ROOM_EXPIRED'; end if;
  if not private.is_member(r.id) then raise exception 'NOT_MEMBER'; end if;
  perform private.advance_match(r.current_match_id);
  select * into r from private.rooms where id=r.id;
  select * into m from private.matches where id=r.current_match_id for update;
  if action='heartbeat' then
    update private.room_members set last_seen_at=now() where room_id=r.id and user_id=actor;
    perform private.advance_match(r.current_match_id);
    return private.snapshot(r.id,actor);
  elsif action in ('snapshot','match_snapshot') then
    result:=private.snapshot(r.id,actor);
    if requested_id is not null then
      select * into m from private.matches where id=requested_id;
      result:=jsonb_set(result,'{room,match}',private.match_dto(m));
    end if;
    return result;
  end if;
  if coalesce(p->>'expectedVersion','') !~ '^[0-9]{1,9}$' then raise exception 'INVALID_INPUT'; end if;
  if (case when action='rematch' then r.version else coalesce(m.version,r.version) end)<>(p->>'expectedVersion')::integer then raise exception 'STALE_VERSION'; end if;
  select slot into mark from private.room_members where room_id=r.id and user_id=actor and status='active';
  if action='ready' then
    if jsonb_typeof(p->'ready') is distinct from 'boolean' then raise exception 'INVALID_INPUT'; end if;
    if m.id is not null and m.phase='countdown' and not (p->>'ready')::boolean then
      perform private.finish_match(m.id,'abandoned','countdown_cancelled');
      update private.room_members set ready=false where room_id=r.id;
      update private.rooms set status='waiting',current_match_id=null,version=version+1 where id=r.id;
    elsif r.status<>'waiting' then raise exception 'WRONG_PHASE';
    end if;
    update private.room_members set ready=(p->>'ready')::boolean,last_seen_at=now() where room_id=r.id and user_id=actor;
    update private.rooms set version=version+1 where id=r.id returning * into r;
    if (select count(*) from private.room_members where room_id=r.id and ready and status='active' and last_seen_at>now()-interval '10 seconds')=2 then perform private.start_match(r); end if;
  elsif action='leave' then
    if m.id is not null and m.phase='countdown' then perform private.finish_match(m.id,'abandoned','countdown_cancelled');
    elsif m.id is not null and m.phase<>'finished' then perform private.finish_match(m.id,case when mark='X' then 'O' else 'X' end,'deliberate_leave'); end if;
    update private.room_members set status='left',ready=false where room_id=r.id and user_id=actor;
    update private.rooms set status=case when m.id is null or m.phase='countdown' then case when r.host_id=actor then 'closed' else 'waiting' end else 'finished' end,version=version+1 where id=r.id;
    return jsonb_build_object('left',true);
  elsif action='move' then
    if m.phase is distinct from 'classic_turn' or m.mode<>'classic' then raise exception 'WRONG_PHASE'; end if;
    if m.turn<>mark then raise exception 'NOT_YOUR_TURN'; end if;
    if coalesce(p->>'cellIndex','') !~ '^[0-8]$' then raise exception 'INVALID_INPUT'; end if;
    idx:=(p->>'cellIndex')::integer;
    if m.board[idx+1] is not null then raise exception 'CELL_OCCUPIED'; end if;
    m.board[idx+1]:=mark;
    insert into private.moves(match_id,sequence,player_id,cell,kind) values(m.id,m.move_count+1,actor,idx,'normal');
    result:=private.board_result(m.board);
    update private.matches set board=m.board,move_count=move_count+1,turn=case when mark='X' then 'O' else 'X' end,version=version+1,
      winning_line=case when result->>'winner' not in ('draw') then array(select jsonb_array_elements_text(result->'line')::integer) else null end where id=m.id;
    update private.rooms set version=version+1 where id=r.id;
    if result->>'winner' is not null then perform private.finish_match(m.id,result->>'winner','board_result'); end if;
  elsif action='rematch' then
    if m.phase is distinct from 'finished' then raise exception 'WRONG_PHASE'; end if;
    if (select count(*) from private.room_members where room_id=r.id and status='active')<>2 then raise exception 'NOT_READY'; end if;
    if jsonb_typeof(p->'accepted') is distinct from 'boolean' then raise exception 'INVALID_INPUT'; end if;
    insert into private.rematch_votes(match_id,user_id,accepted) values(m.id,actor,(p->>'accepted')::boolean)
      on conflict(match_id,user_id) do update set accepted=excluded.accepted,created_at=now();
    update private.rooms set version=version+1 where id=r.id;
    if (select count(*) from private.rematch_votes where match_id=m.id and accepted)=2 then
      update private.room_members set ready=true where room_id=r.id and status='active';
      perform private.start_match(r);
    end if;
  else raise exception 'WRONG_PHASE';
  end if;
  return private.snapshot(r.id,actor);
end $$;
create or replace function private.resolve_round(p_id uuid) returns void language plpgsql set search_path='' as $$
declare m private.matches; r private.clash_rounds; x private.clash_submissions; o private.clash_submissions;
  v_winner text; streak integer; bonus boolean; remaining integer;
begin
  select * into m from private.matches where id=p_id;
  select * into r from private.clash_rounds where id=m.current_round_id;
  if r.status<>'playing' or m.phase<>'round' then return; end if;
  select * into x from private.clash_submissions where round_id=r.id and user_id=m.x_id;
  select * into o from private.clash_submissions where round_id=r.id and user_id=m.o_id;
  if x.user_id is null or o.user_id is null then
    if now()>=r.submit_by+interval '30 seconds' then
      update private.clash_rounds set status='cancelled' where id=r.id;
      perform private.finish_match(m.id,case when x.user_id is null and o.user_id is null then 'abandoned' when x.user_id is null then 'O' else 'X' end,'submission_timeout');
    end if;
    return;
  end if;
  v_winner:=case when x.score>o.score or (x.score=o.score and x.tie_break<o.tie_break) then 'X' when o.score>x.score or (x.score=o.score and o.tie_break<x.tie_break) then 'O' else null end;
  update private.clash_rounds set status='resolved',winner=v_winner where id=r.id;
  if v_winner is null then perform private.start_round(m.id,true);return; end if;
  streak:=case when v_winner='X' then m.streak_x else m.streak_o end+1;bonus:=streak>=2;
  select count(*)::integer into remaining from unnest(m.board) b where b is null;
  update private.matches set phase='claim',claimant=v_winner,pending_claims=least(remaining,case when bonus then 2 else 1 end),claim_is_bonus=false,
    streak_x=case when v_winner='X' and not bonus then streak else 0 end,streak_o=case when v_winner='O' and not bonus then streak else 0 end,
    best_x=greatest(best_x,case when v_winner='X' then streak else 0 end),best_o=greatest(best_o,case when v_winner='O' then streak else 0 end),
    turn=v_winner,deadline_at=now()+interval '15 seconds',version=version+1 where id=m.id;
  update private.rooms set version=version+1 where id=m.room_id;
end $$;


create function private.reject_finished_update() returns trigger language plpgsql set search_path='' as $$
begin
  if old.phase='finished' and to_jsonb(new)<>to_jsonb(old) then raise exception 'WRONG_PHASE'; end if;
  return new;
end $$;
create trigger immutable_finished_match before update on private.matches for each row execute function private.reject_finished_update();

create function public.game_leaderboard(p_mode text default 'clash') returns jsonb language sql stable security definer set search_path='' as $$
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
      where p.public_leaderboard and p_mode in ('classic','clash') and s.classic_wins+s.classic_losses+s.classic_draws+s.clash_wins+s.clash_losses+s.clash_draws>0
    ) stats order by wins desc,case when wins+losses+draws>0 then wins::numeric/(wins+losses+draws) else 0 end desc,name limit 50
  ) standings
$$;
revoke all on function public.game_leaderboard(text) from public;
grant execute on function public.game_leaderboard(text) to anon,authenticated;

alter function private.room_command(uuid,text,text,jsonb) rename to clash_command;
create function private.room_command(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
begin
  if action='leaderboard' then return public.game_leaderboard('clash'); end if;
  if action='history' then
    return jsonb_build_object('matches',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'mode',h.mode,'winner',h.outcome,'finishedAt',h.finished_at,'board',h.board) order by h.finished_at desc)
      from (select * from private.matches where (x_id=actor or o_id=actor) and phase='finished' and outcome<>'abandoned' order by finished_at desc limit 50) h),'[]'));
  end if;
  if action='profile' and (jsonb_typeof(p->'name') is distinct from 'string' or coalesce(p->>'name','') !~ '^[[:alnum:] _.-]{2,18}$') then raise exception 'INVALID_INPUT'; end if;
  return private.clash_command(actor,action,resource,p);
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.request(text,text,jsonb),private.can_receive(text) to authenticated;

create or replace function private.match_dto(m private.matches) returns jsonb language plpgsql stable set search_path='' as $$
declare round_data jsonb;
begin
  if m.id is null then return null; end if;
  if m.current_round_id is not null then
    select jsonb_build_object('id',r.id,'index',r.round_index,'type',r.type,'seed',r.seed,'config',r.config,
      'startAt',r.start_at,'endAt',r.end_at,'submitBy',r.submit_by,'status',r.status,'suddenDeath',r.sudden_death,
      'submitted',jsonb_build_object('X',exists(select 1 from private.clash_submissions where round_id=r.id and user_id=m.x_id),
      'O',exists(select 1 from private.clash_submissions where round_id=r.id and user_id=m.o_id)),
      'scores',case when r.status='resolved' then jsonb_build_object('X',(select score from private.clash_submissions where round_id=r.id and user_id=m.x_id),
      'O',(select score from private.clash_submissions where round_id=r.id and user_id=m.o_id)) else null end)
      into round_data from private.clash_rounds r where r.id=m.current_round_id;
  end if;
  return jsonb_build_object('id',m.id,'version',m.version,'phase',m.phase,'board',m.board,'turn',m.turn,'winner',m.outcome,
    'winningLine',m.winning_line,'moveCount',m.move_count,'streaks',jsonb_build_object('X',m.streak_x,'O',m.streak_o),
    'bestStreaks',jsonb_build_object('X',m.best_x,'O',m.best_o),'pendingClaims',m.pending_claims,'claimant',m.claimant,'round',round_data,'startAt',m.start_at,'deadlineAt',m.deadline_at,
    'reconnectDeadline',m.reconnect_deadline,'reason',m.reason,'rematchVotes',coalesce((select jsonb_agg(jsonb_build_object('userId',v.user_id,'accepted',v.accepted)) from private.rematch_votes v where v.match_id=m.id),'[]'));
end $$;

create or replace function private.snapshot(room_id uuid,actor uuid) returns jsonb language plpgsql set search_path='' as $$
declare r private.rooms; m private.matches; members jsonb;
begin
  select * into r from private.rooms where id=room_id;
  if not private.is_member(room_id) then raise exception 'NOT_MEMBER'; end if;
  select * into m from private.matches where id=r.current_match_id;
  select coalesce(jsonb_agg(jsonb_build_object('userId',rm.user_id,'slot',rm.slot,'ready',rm.ready,
    'lastSeenAt',rm.last_seen_at,'status',rm.status,'profile',jsonb_build_object('name',p.name,'avatarId',p.avatar_id)) order by rm.slot),'[]')
    into members from private.room_members rm join private.profiles p on p.user_id=rm.user_id where rm.room_id=r.id and (rm.status='active' or (m.id is not null and rm.user_id in (m.x_id,m.o_id)));
  return jsonb_build_object('room',jsonb_build_object('id',r.id,'code',r.code,'mode',r.mode,'status',r.status,'version',r.version,
    'scores',jsonb_build_object('X',(select count(*) from private.matches where matches.room_id=r.id and outcome='X'),
    'O',(select count(*) from private.matches where matches.room_id=r.id and outcome='O'),'draws',(select count(*) from private.matches where matches.room_id=r.id and outcome='draw')),
    'members',members,'myMark',(select slot from private.room_members rm where rm.room_id=r.id and rm.user_id=actor),
    'match',private.match_dto(m),'serverNow',clock_timestamp(),'expiresAt',r.expires_at));
end $$;

create or replace function private.finish_match(p_id uuid,p_outcome text,p_reason text) returns void language plpgsql set search_path='' as $$
declare m private.matches; u uuid; slot text; win integer; loss integer; draw integer;
begin
  update private.matches set outcome=p_outcome,reason=p_reason,phase='finished',pending_claims=0,claimant=null,
    finished_at=now(),result_applied=true,version=version+1,deadline_at=null,reconnect_deadline=null
    where id=p_id and not result_applied returning * into m;
  if not found then return; end if;
  update private.rooms set status='finished',version=version+1 where id=m.room_id;
  if p_outcome='abandoned' then return; end if;
  perform 1 from private.player_stats where user_id in (m.x_id,m.o_id) order by user_id for update;
  foreach u in array array[m.x_id,m.o_id] loop
    slot:=case when u=m.x_id then 'X' else 'O' end;
    win:=(p_outcome=slot)::integer;loss:=(p_outcome not in (slot,'draw'))::integer;draw:=(p_outcome='draw')::integer;
    update private.player_stats set classic_wins=classic_wins+case when m.mode='classic' then win else 0 end,
      classic_losses=classic_losses+case when m.mode='classic' then loss else 0 end,
      classic_draws=classic_draws+case when m.mode='classic' then draw else 0 end,
      clash_wins=clash_wins+case when m.mode='clash' then win else 0 end,
      clash_losses=clash_losses+case when m.mode='clash' then loss else 0 end,
      clash_draws=clash_draws+case when m.mode='clash' then draw else 0 end,
      rounds_played=rounds_played+case when m.mode='clash' then (select count(*)::integer from private.clash_rounds where match_id=m.id and status='resolved') else 0 end,
      rounds_won=rounds_won+case when m.mode='clash' then (select count(*)::integer from private.clash_rounds where match_id=m.id and status='resolved' and winner=slot) else 0 end,
      longest_streak=greatest(longest_streak,case when slot='X' then m.best_x else m.best_o end),updated_at=now() where user_id=u;
  end loop;
end $$;


revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.request(text,text,jsonb),private.can_receive(text) to authenticated;

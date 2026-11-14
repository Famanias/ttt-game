-- One final review fix pass; previous migrations remain reproducible.
alter table private.matches add column resume_x integer not null default 0 check(resume_x between 0 and 3);
alter table private.matches add column resume_o integer not null default 0 check(resume_o between 0 and 3);
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
      if sqlerrm in ('INVALID_INPUT','INVALID_CODE','ROOM_FULL','ROOM_EXPIRED','PROFILE_REQUIRED','NOT_MEMBER','WRONG_PHASE','STALE_VERSION','NOT_READY','NOT_YOUR_TURN','CELL_OCCUPIED','ROUND_CLOSED','ALREADY_SUBMITTED','RECONNECT_REQUIRED','RETRY_REQUIRED','RESUME_LIMIT') then
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
    if m.id is not null and m.phase='countdown' then
      perform private.finish_match(m.id,'abandoned','countdown_cancelled');
      update private.room_members set ready=false where room_id=r.id;
      update private.rooms set current_match_id=null where id=r.id;
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
create or replace function private.derive_score(p_type text,c jsonb,trace jsonb,elapsed integer) returns jsonb language plpgsql immutable set search_path='' as $$
declare events jsonb; e jsonb; t integer; last_t integer:=-1000; finish integer; score integer:=0; tie integer:=0;
  diff numeric; total numeric:=0; total_diff numeric:=0; cells integer[]:='{}'; cell integer; hits integer:=0; misses integer:=0;
  target jsonb; target_id integer; used integer[]:='{}'; px numeric; py numeric;
begin
  if jsonb_typeof(trace) is distinct from 'object' or trace->>'version' is distinct from '1' or jsonb_typeof(trace->'events') is distinct from 'array' then raise exception 'INVALID_INPUT'; end if;
  events:=trace->'events';
  if jsonb_array_length(events)>80 then raise exception 'INVALID_INPUT'; end if;
  if p_type='perfect-timing' and jsonb_array_length(events)<>(c->>'presses')::integer then raise exception 'INVALID_INPUT'; end if;
  for e in select * from jsonb_array_elements(events) loop
    if jsonb_typeof(e) is distinct from 'object' or coalesce(e->>'t','') !~ '^[0-9]{1,5}$' then raise exception 'INVALID_INPUT'; end if;
    t:=(e->>'t')::integer;
    if t<0 or t>(c->>'durationMs')::integer or t>elapsed+150 or t-last_t<(case when p_type='perfect-timing' then 120 when p_type='target-rush' then 40 else 35 end) then raise exception 'INVALID_INPUT'; end if;
    last_t:=t;
    if p_type='perfect-timing' then
      diff:=abs(mod(((c->>'speed')::numeric*t/1000)-(c->>'targetCenter')::numeric+540,360)-180);
      total_diff:=total_diff+diff;
      total:=total+case when diff<=22 then round(700+(1-diff/22)*300) else greatest(40,round(620*(1-least(1,(diff-22)/95)))) end;
    elsif p_type='flash-memory' then
      if coalesce(e->>'cell','') !~ '^[0-8]$' or t<(c->>'revealMs')::integer then raise exception 'INVALID_INPUT'; end if;
      cell:=(e->>'cell')::integer;
      if cell=any(cells) then cells:=array_remove(cells,cell); else cells:=array_append(cells,cell); end if;
    elsif p_type='target-rush' then
      if coalesce(e->>'targetId','') !~ '^(-1|[0-9]{1,2})$' or jsonb_typeof(e->'x') is distinct from 'number' or jsonb_typeof(e->'y') is distinct from 'number' then raise exception 'INVALID_INPUT'; end if;
      target_id:=(e->>'targetId')::integer;px:=(e->>'x')::numeric;py:=(e->>'y')::numeric;
      if px<0 or px>100 or py<0 or py>100 then raise exception 'INVALID_INPUT'; end if;
      if target_id=-1 then misses:=misses+1;continue; end if;
      select value into target from jsonb_array_elements(c->'targets') where (value->>'id')::integer=target_id;
      if target is null or target_id=any(used) or t<(target->>'spawn')::integer or t>=(target->>'end')::integer
        or power(px-(target->>'x')::numeric,2)+power(py-(target->>'y')::numeric,2)>144 then raise exception 'INVALID_INPUT'; end if;
      used:=array_append(used,target_id);score:=score+(target->>'points')::integer;
    else raise exception 'INVALID_INPUT';
    end if;
  end loop;
  if p_type='perfect-timing' then score:=round(total/(c->>'presses')::integer);tie:=round(total_diff*1000);
  elsif p_type='flash-memory' then
    if coalesce(trace->>'finishedAt','') !~ '^[0-9]{1,5}$' then raise exception 'INVALID_INPUT'; end if;
    finish:=(trace->>'finishedAt')::integer;
    if finish<greatest((c->>'revealMs')::integer,last_t) or finish>(c->>'durationMs')::integer or finish>elapsed+150 then raise exception 'INVALID_INPUT'; end if;
    foreach cell in array cells loop
      if (c->'pattern')@>jsonb_build_array(cell) then hits:=hits+1; else misses:=misses+1; end if;
    end loop;
    score:=greatest(0,round((hits-misses*0.5)/jsonb_array_length(c->'pattern')*800));
    if hits=jsonb_array_length(c->'pattern') and misses=0 then score:=score+greatest(0,least(200,round(200-(finish-(c->>'revealMs')::integer)/35.0))); end if;
    tie:=finish-(c->>'revealMs')::integer;
  else tie:=misses;
  end if;
  return jsonb_build_object('score',score,'tieBreak',tie);
end $$;

create or replace function private.clash_command(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare r private.rooms; m private.matches; round private.clash_rounds; mark text; score jsonb; elapsed integer;
begin
  if action not in ('submit','move') then return private.classic_command(actor,action,resource,p); end if;
  select * into r from private.rooms where code=resource for update;
  if r.id is null then raise exception 'INVALID_CODE'; end if;
  if not private.is_member(r.id) then raise exception 'NOT_MEMBER'; end if;
  if r.mode='classic' then return private.classic_command(actor,action,resource,p); end if;
  perform private.advance_match(r.current_match_id);
  select * into m from private.matches where id=r.current_match_id for update;
  if coalesce(p->>'expectedVersion','') !~ '^[0-9]{1,9}$' then raise exception 'INVALID_INPUT'; end if;
  if action='move' and (m.version is distinct from (p->>'expectedVersion')::integer) then raise exception 'STALE_VERSION'; end if;
  if action='move' then
    if m.phase is distinct from 'claim' then raise exception 'WRONG_PHASE'; end if;
    if actor<>(case when m.claimant='X' then m.x_id else m.o_id end) then raise exception 'NOT_YOUR_TURN'; end if;
    if coalesce(p->>'cellIndex','') !~ '^[0-8]$' then raise exception 'INVALID_INPUT'; end if;
    perform private.place_claim(m.id,(p->>'cellIndex')::integer);
  else
    if m.phase is distinct from 'round' or m.current_round_id::text is distinct from lower(p->>'roundId') then raise exception 'ROUND_CLOSED'; end if;
    select * into round from private.clash_rounds where id=m.current_round_id;
    if round.status<>'playing' or now()<round.start_at or now()>round.submit_by then raise exception 'ROUND_CLOSED'; end if;
    if exists(select 1 from private.clash_submissions where round_id=round.id and user_id=actor) then raise exception 'ALREADY_SUBMITTED'; end if;
    if round.type='target-rush' and now()<round.end_at then raise exception 'ROUND_CLOSED'; end if;
    elapsed:=floor(extract(epoch from now()-round.start_at)*1000)::integer;
    score:=private.derive_score(round.type,round.config,p->'trace',elapsed);
    insert into private.clash_submissions(round_id,user_id,trace,score,tie_break) values(round.id,actor,p->'trace',(score->>'score')::integer,(score->>'tieBreak')::integer);
    update private.matches set version=version+1 where id=m.id;
    update private.rooms set version=version+1 where id=r.id;
    perform private.resolve_round(m.id);
  end if;
  return private.snapshot(r.id,actor);
end $$;


alter function private.room_command(uuid,text,text,jsonb) rename to pre_resume_command;
create function private.room_command(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare r private.rooms; m private.matches; attempts integer;
begin
  if action<>'resume' then return private.pre_resume_command(actor,action,resource,p); end if;
  select * into r from private.rooms where code=resource for update;
  if r.id is null then raise exception 'INVALID_CODE'; end if;
  if not private.is_member(r.id) then raise exception 'NOT_MEMBER'; end if;
  perform private.advance_match(r.current_match_id);
  select * into m from private.matches where id=r.current_match_id for update;
  if m.phase is distinct from 'round' or m.current_round_id::text is distinct from lower(p->>'roundId') then raise exception 'ROUND_CLOSED'; end if;
  if exists(select 1 from private.clash_submissions where round_id=m.current_round_id and user_id=actor) then return private.snapshot(r.id,actor); end if;
  attempts:=case when actor=m.x_id then m.resume_x else m.resume_o end;
  if attempts>=3 then raise exception 'RESUME_LIMIT'; end if;
  update private.clash_rounds set status='cancelled' where id=m.current_round_id;
  update private.matches set resume_x=resume_x+case when actor=m.x_id then 1 else 0 end,
    resume_o=resume_o+case when actor=m.o_id then 1 else 0 end,version=version+1 where id=m.id;
  -- A fast reload may not expire the heartbeat lease. Restart the identical
  -- challenge explicitly, under the same lock, rather than losing partial input.
  perform private.start_round(m.id,false,m.current_round_id);
  return private.snapshot(r.id,actor);
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.request(text,text,jsonb),private.can_receive(text) to authenticated;

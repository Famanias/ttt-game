create or replace function private.try_start_ready_room(p_room private.rooms) returns void language plpgsql set search_path='' as $$
begin
  if p_room.status='waiting' and (select count(*) from private.room_members where room_id=p_room.id and ready and status='active' and last_seen_at>now()-interval '10 seconds')=2 then
    perform private.start_match(p_room);
  end if;
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
    select * into r from private.rooms where id=r.id;
    perform private.try_start_ready_room(r);
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
    perform private.try_start_ready_room(r);
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

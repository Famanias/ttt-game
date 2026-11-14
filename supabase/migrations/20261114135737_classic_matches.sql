alter table private.matches drop constraint matches_board_check;
alter table private.matches add constraint valid_board check(array_length(board,1)=9 and array_remove(board,null) <@ array['X','O']::text[]);
drop policy room_broadcast_read on realtime.messages;
create policy room_broadcast_read on realtime.messages for select to authenticated
  using (topic=realtime.topic() and extension in ('broadcast','presence') and private.can_receive(realtime.topic()));
drop policy room_presence_write on realtime.messages;
create policy room_presence_write on realtime.messages for insert to authenticated
  with check (topic=realtime.topic() and extension='presence' and private.can_receive(realtime.topic()));

create function private.board_result(b text[]) returns jsonb language plpgsql immutable set search_path='' as $$
declare line integer[];
begin
  foreach line slice 1 in array array[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]] loop
    if b[line[1]+1] is not null and b[line[1]+1]=b[line[2]+1] and b[line[1]+1]=b[line[3]+1] then
      return jsonb_build_object('winner',b[line[1]+1],'line',line);
    end if;
  end loop;
  return jsonb_build_object('winner',case when array_position(b,null) is null then 'draw' else null end,'line',null);
end $$;

create function private.match_dto(m private.matches) returns jsonb language plpgsql stable set search_path='' as $$
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
    'pendingClaims',m.pending_claims,'claimant',m.claimant,'round',round_data,'startAt',m.start_at,'deadlineAt',m.deadline_at,
    'reconnectDeadline',m.reconnect_deadline,'reason',m.reason,'rematchVotes',coalesce((select jsonb_agg(jsonb_build_object('userId',v.user_id,'accepted',v.accepted)) from private.rematch_votes v where v.match_id=m.id),'[]'));
end $$;

create or replace function private.snapshot(room_id uuid,actor uuid) returns jsonb language plpgsql set search_path='' as $$
declare r private.rooms; m private.matches; members jsonb;
begin
  select * into r from private.rooms where id=room_id;
  if not private.is_member(room_id) then raise exception 'NOT_MEMBER'; end if;
  select * into m from private.matches where id=r.current_match_id;
  select coalesce(jsonb_agg(jsonb_build_object('userId',rm.user_id,'slot',rm.slot,'ready',rm.ready,
    'lastSeenAt',rm.last_seen_at,'profile',jsonb_build_object('name',p.name,'avatarId',p.avatar_id)) order by rm.slot),'[]')
    into members from private.room_members rm join private.profiles p on p.user_id=rm.user_id where rm.room_id=r.id and rm.status='active';
  return jsonb_build_object('room',jsonb_build_object('id',r.id,'code',r.code,'mode',r.mode,'status',r.status,'version',r.version,
    'members',members,'myMark',(select slot from private.room_members rm where rm.room_id=r.id and rm.user_id=actor),
    'match',private.match_dto(m),'serverNow',clock_timestamp(),'expiresAt',r.expires_at));
end $$;

create function private.start_match(r private.rooms) returns uuid language plpgsql set search_path='' as $$
declare new_id uuid; x uuid; o uuid;
begin
  select user_id into x from private.room_members where room_id=r.id and slot='X' and status='active' and ready;
  select user_id into o from private.room_members where room_id=r.id and slot='O' and status='active' and ready;
  if x is null or o is null then raise exception 'NOT_READY'; end if;
  insert into private.matches(room_id,x_id,o_id,mode) values(r.id,x,o,r.mode) returning id into new_id;
  update private.rooms set current_match_id=new_id,status='active',version=version+1 where id=r.id;
  return new_id;
end $$;

create function private.finish_match(p_id uuid,p_outcome text,p_reason text) returns void language plpgsql set search_path='' as $$
declare m private.matches; u uuid; slot text; win integer; loss integer; draw integer;
begin
  update private.matches set outcome=p_outcome,reason=p_reason,phase='finished',pending_claims=0,claimant=null,
    finished_at=now(),result_applied=true,version=version+1,deadline_at=null,reconnect_deadline=null
    where id=p_id and not result_applied returning * into m;
  if not found then return; end if;
  update private.rooms set status='finished',version=version+1 where id=m.room_id;
  if p_outcome='abandoned' then return; end if;
  foreach u in array array[m.x_id,m.o_id] loop
    slot:=case when u=m.x_id then 'X' else 'O' end;
    win:=(p_outcome=slot)::integer;loss:=(p_outcome not in (slot,'draw'))::integer;draw:=(p_outcome='draw')::integer;
    update private.player_stats set classic_wins=classic_wins+case when m.mode='classic' then win else 0 end,
      classic_losses=classic_losses+case when m.mode='classic' then loss else 0 end,
      classic_draws=classic_draws+case when m.mode='classic' then draw else 0 end,
      clash_wins=clash_wins+case when m.mode='clash' then win else 0 end,
      clash_losses=clash_losses+case when m.mode='clash' then loss else 0 end,
      clash_draws=clash_draws+case when m.mode='clash' then draw else 0 end,
      longest_streak=greatest(longest_streak,case when slot='X' then m.best_x else m.best_o end),updated_at=now() where user_id=u;
  end loop;
end $$;

create function private.advance_match(p_id uuid) returns void language plpgsql set search_path='' as $$
declare m private.matches; x_seen timestamptz; o_seen timestamptz; inactive_x boolean; inactive_o boolean; resume boolean;
begin
  select * into m from private.matches where id=p_id for update;
  if not found or m.phase='finished' then return; end if;
  select last_seen_at into x_seen from private.room_members where room_id=m.room_id and user_id=m.x_id and status='active';
  select last_seen_at into o_seen from private.room_members where room_id=m.room_id and user_id=m.o_id and status='active';
  inactive_x:=x_seen is null or x_seen<now()-interval '10 seconds';
  inactive_o:=o_seen is null or o_seen<now()-interval '10 seconds';
  if m.phase='paused' then
    if now()>=m.reconnect_deadline then
      perform private.finish_match(m.id,case when inactive_x and inactive_o then 'abandoned' when inactive_x then 'O' else 'X' end,'reconnect_timeout');return;
    end if;
    if inactive_x or inactive_o then return; end if;
    update private.matches set phase=paused_phase,deadline_at=deadline_at+(now()-paused_at),version=version+1,paused_at=null,reconnect_deadline=null where id=m.id returning * into m;
    update private.rooms set version=version+1 where id=m.room_id;
  elsif inactive_x or inactive_o then
    if m.phase='countdown' then
      perform private.finish_match(m.id,'abandoned','countdown_cancelled');
      update private.room_members set ready=false where room_id=m.room_id;
      update private.rooms set current_match_id=null,status='waiting',version=version+1 where id=m.room_id;return;
    end if;
    update private.matches set paused_phase=phase,phase='paused',paused_at=now(),reconnect_deadline=least(coalesce(x_seen,now()),coalesce(o_seen,now()))+interval '40 seconds',version=version+1 where id=m.id returning * into m;
    update private.rooms set version=version+1 where id=m.room_id;
    if now()>=m.reconnect_deadline then perform private.advance_match(m.id); end if;
    return;
  end if;
  if m.phase='countdown' and now()>=m.start_at then
    update private.matches set phase=case when mode='classic' then 'classic_turn' else 'round' end,version=version+1 where id=m.id;
    update private.rooms set version=version+1 where id=m.room_id;
  end if;
end $$;

alter function private.room_command(uuid,text,text,jsonb) rename to room_base;
create function private.room_command(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
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
  if coalesce(m.version,r.version)<>(p->>'expectedVersion')::integer then raise exception 'STALE_VERSION'; end if;
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
    if m.id is not null and m.phase<>'finished' then perform private.finish_match(m.id,case when mark='X' then 'O' else 'X' end,'deliberate_leave'); end if;
    update private.room_members set status='left',ready=false where room_id=r.id and user_id=actor;
    update private.rooms set status=case when r.host_id=actor or r.status<>'waiting' then 'closed' else 'waiting' end,version=version+1 where id=r.id;
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
    if jsonb_typeof(p->'accepted') is distinct from 'boolean' then raise exception 'INVALID_INPUT'; end if;
    insert into private.rematch_votes(match_id,user_id,accepted) values(m.id,actor,(p->>'accepted')::boolean)
      on conflict(match_id,user_id) do update set accepted=excluded.accepted,created_at=now();
    update private.matches set version=version+1 where id=m.id;
    update private.rooms set version=version+1 where id=r.id;
    if (select count(*) from private.rematch_votes where match_id=m.id and accepted)=2 then
      update private.room_members set ready=true where room_id=r.id and status='active';
      perform private.start_match(r);
    end if;
  else raise exception 'WRONG_PHASE';
  end if;
  return private.snapshot(r.id,actor);
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.request(text,text,jsonb),private.can_receive(text) to authenticated;

alter table private.matches add column rotation_index integer not null default 0;
alter table private.matches add column claim_is_bonus boolean not null default false;

create function private.challenge(p_seed integer,p_index integer,p_type text,p_sudden boolean) returns jsonb language plpgsql immutable set search_path='' as $$
declare s bigint:=p_seed; pool integer[]:=array[0,1,2,3,4,5,6,7,8]; i integer; j integer; temp integer; count integer;
  targets jsonb:='[]'; x integer; y integer; bonus boolean;
begin
  if p_type='perfect-timing' then return jsonb_build_object('durationMs',case when p_sudden then 4000 else 10000 end,
    'presses',case when p_sudden then 1 else 3 end,'targetCenter',(p_index*73+45+p_seed%90)%360,'speed',230+least(p_index*14,110)); end if;
  if p_type='flash-memory' then
    for i in reverse 9..2 loop
      s:=(s*48271)%2147483647;j:=(s%i)::integer+1;temp:=pool[i];pool[i]:=pool[j];pool[j]:=temp;
    end loop;
    count:=case when p_index<=2 then 3 when p_index<=5 then 4 else 5 end;
    return jsonb_build_object('durationMs',8550,'revealMs',1550,'pattern',pool[1:count]);
  end if;
  for i in 0..39 loop
    s:=(s*48271)%2147483647;x:=15+(s%71)::integer;
    s:=(s*48271)%2147483647;y:=18+(s%65)::integer;
    s:=(s*48271)%2147483647;bonus:=s%4=0;
    targets:=targets||jsonb_build_array(jsonb_build_object('id',i,'x',x,'y',y,'spawn',(i/4)*550,'end',(i/4+1)*550,'points',case when bonus then 140 else 90 end));
  end loop;
  return jsonb_build_object('durationMs',5500,'targets',targets);
end $$;

create function private.start_round(p_id uuid,p_sudden boolean default false,p_reuse uuid default null) returns void language plpgsql set search_path='' as $$
declare m private.matches; old private.clash_rounds; new_id uuid; seed integer; config jsonb; kind text; v_start timestamptz:=now()+interval '3 seconds';
begin
  select * into m from private.matches where id=p_id;
  if p_reuse is not null then
    select * into old from private.clash_rounds where id=p_reuse;
    seed:=old.seed;config:=old.config;kind:=old.type;p_sudden:=old.sudden_death;
  else
    seed:=(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,7))::bit(28)::integer)+1;
    kind:=case when p_sudden then 'perfect-timing' else (array['perfect-timing','flash-memory','target-rush'])[m.rotation_index%3+1] end;
    config:=private.challenge(seed,m.round_index+1,kind,p_sudden);
  end if;
  insert into private.clash_rounds(match_id,round_index,type,seed,config,start_at,end_at,submit_by,sudden_death,parent_id)
    values(m.id,m.round_index+1,kind,seed,config,v_start,v_start+((config->>'durationMs')::integer*interval '1 millisecond'),
    v_start+((config->>'durationMs')::integer*interval '1 millisecond')+interval '2 seconds',p_sudden,coalesce(p_reuse,case when p_sudden then m.current_round_id else null end)) returning id into new_id;
  update private.matches set current_round_id=new_id,round_index=round_index+1,rotation_index=rotation_index+case when p_sudden or p_reuse is not null then 0 else 1 end,
    phase='round',deadline_at=v_start+((config->>'durationMs')::integer*interval '1 millisecond')+interval '2 seconds',version=version+1 where id=m.id;
  update private.rooms set version=version+1 where id=m.room_id;
end $$;

create function private.derive_score(p_type text,c jsonb,trace jsonb,elapsed integer) returns jsonb language plpgsql immutable set search_path='' as $$
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
        or power(px-(target->>'x')::numeric,2)+power(py-(target->>'y')::numeric,2)>81 then raise exception 'INVALID_INPUT'; end if;
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

create function private.resolve_round(p_id uuid) returns void language plpgsql set search_path='' as $$
declare m private.matches; r private.clash_rounds; x private.clash_submissions; o private.clash_submissions;
  v_winner text; streak integer; bonus boolean; remaining integer;
begin
  select * into m from private.matches where id=p_id;
  select * into r from private.clash_rounds where id=m.current_round_id;
  if r.status<>'playing' or m.phase<>'round' then return; end if;
  select * into x from private.clash_submissions where round_id=r.id and user_id=m.x_id;
  select * into o from private.clash_submissions where round_id=r.id and user_id=m.o_id;
  if x.user_id is null or o.user_id is null then
    if now()>=r.submit_by then
      update private.clash_rounds set status='cancelled' where id=r.id;
      perform private.finish_match(m.id,case when x.user_id is null and o.user_id is null then 'abandoned' when x.user_id is null then 'O' else 'X' end,'submission_timeout');
    end if;
    return;
  end if;
  v_winner:=case when x.score>o.score or (x.score=o.score and x.tie_break<o.tie_break) then 'X' when o.score>x.score or (x.score=o.score and o.tie_break<x.tie_break) then 'O' else null end;
  update private.clash_rounds set status='resolved',winner=v_winner where id=r.id;
  update private.player_stats set rounds_played=rounds_played+1,rounds_won=rounds_won+case when (user_id=m.x_id and v_winner='X') or (user_id=m.o_id and v_winner='O') then 1 else 0 end where user_id in (m.x_id,m.o_id);
  if v_winner is null then perform private.start_round(m.id,true);return; end if;
  streak:=case when v_winner='X' then m.streak_x else m.streak_o end+1;bonus:=streak>=2;
  select count(*)::integer into remaining from unnest(m.board) b where b is null;
  update private.matches set phase='claim',claimant=v_winner,pending_claims=least(remaining,case when bonus then 2 else 1 end),claim_is_bonus=false,
    streak_x=case when v_winner='X' and not bonus then streak else 0 end,streak_o=case when v_winner='O' and not bonus then streak else 0 end,
    best_x=greatest(best_x,case when v_winner='X' then streak else 0 end),best_o=greatest(best_o,case when v_winner='O' then streak else 0 end),
    turn=v_winner,deadline_at=now()+interval '15 seconds',version=version+1 where id=m.id;
  update private.rooms set version=version+1 where id=m.room_id;
end $$;

create function private.place_claim(p_id uuid,idx integer,auto boolean default false) returns void language plpgsql set search_path='' as $$
declare m private.matches; result jsonb;
begin
  select * into m from private.matches where id=p_id;
  if m.phase<>'claim' or m.pending_claims<=0 then raise exception 'WRONG_PHASE'; end if;
  if idx<0 or idx>8 or idx is null then raise exception 'INVALID_INPUT'; end if;
  if m.board[idx+1] is not null then raise exception 'CELL_OCCUPIED'; end if;
  m.board[idx+1]:=m.claimant;result:=private.board_result(m.board);
  insert into private.moves(match_id,sequence,player_id,cell,kind) values(m.id,m.move_count+1,case when m.claimant='X' then m.x_id else m.o_id end,idx,case when auto then 'auto' when m.claim_is_bonus then 'bonus' else 'normal' end);
  update private.matches set board=m.board,move_count=move_count+1,pending_claims=pending_claims-1,claim_is_bonus=true,version=version+1,
    deadline_at=now()+interval '15 seconds',winning_line=case when result->>'winner' not in ('draw') then array(select jsonb_array_elements_text(result->'line')::integer) else null end where id=m.id;
  update private.rooms set version=version+1 where id=m.room_id;
  if result->>'winner' is not null then perform private.finish_match(m.id,result->>'winner','board_result');
  elsif m.pending_claims=1 then
    update private.matches set claimant=null where id=m.id;
    perform private.start_round(m.id);
  end if;
end $$;

alter function private.advance_match(uuid) rename to advance_base;
create function private.advance_match(p_id uuid) returns void language plpgsql set search_path='' as $$
declare m private.matches; previous private.matches;
begin
  select * into previous from private.matches where id=p_id for update;
  perform private.advance_base(p_id);
  select * into m from private.matches where id=p_id;
  if m.phase='round' then
    if m.current_round_id is null then perform private.start_round(m.id);
    elsif previous.phase='paused' then
      update private.clash_rounds set status='cancelled' where id=m.current_round_id;
      perform private.start_round(m.id,false,m.current_round_id);
    else perform private.resolve_round(m.id);
    end if;
  elsif m.phase='claim' and now()>=m.deadline_at then
    perform private.place_claim(m.id,array_position(m.board,null)-1,true);
  end if;
end $$;

alter function private.room_command(uuid,text,text,jsonb) rename to classic_command;
create function private.room_command(actor uuid,action text,resource text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
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
  if m.version is distinct from (p->>'expectedVersion')::integer then raise exception 'STALE_VERSION'; end if;
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

create function private.sweep_deadlines() returns void language plpgsql security definer set search_path='' as $$
declare r private.rooms;
begin
  for r in select rooms.* from private.rooms rooms join private.matches m on m.id=rooms.current_match_id
    where rooms.status='active' and m.phase<>'finished' order by rooms.id for update of rooms skip locked loop
    perform private.advance_match(r.current_match_id);
  end loop;
  delete from private.command_receipts where created_at<now()-interval '7 days';
  delete from private.rate_limits where window_at<now()-interval '1 day';
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.request(text,text,jsonb),private.can_receive(text) to authenticated;

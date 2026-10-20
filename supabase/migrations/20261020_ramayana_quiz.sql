-- Independent Ramayana quiz. Does not alter any existing challenge/quiz objects.
begin;
create table public.ramayana_sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[0-9]{6}$'),
  title text not null,
  status text not null default 'lobby' check (status in ('lobby','live','closed')),
  started_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.ramayana_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ramayana_sessions on delete cascade,
  position integer not null check (position >= 0),
  prompt text not null,
  options jsonb not null check (jsonb_array_length(options) between 2 and 4),
  correct_index integer not null check (correct_index between 0 and 3),
  unique(session_id, position)
);
create table public.ramayana_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ramayana_sessions on delete cascade,
  name text not null,
  phone text not null,
  token_hash text not null unique,
  position integer not null default 0,
  question_opens_at timestamptz,
  finished_at timestamptz,
  score integer not null default 0,
  elapsed_ms bigint not null default 0,
  joined_at timestamptz not null default now(),
  unique(session_id, phone)
);
create table public.ramayana_answers (
  player_id uuid not null references public.ramayana_players on delete cascade,
  question_id uuid not null references public.ramayana_questions on delete cascade,
  answer_index integer,
  correct boolean not null,
  elapsed_ms integer not null,
  answered_at timestamptz not null default now(),
  primary key(player_id, question_id)
);
create index ramayana_players_session_idx on public.ramayana_players(session_id);
alter table public.ramayana_sessions enable row level security;
alter table public.ramayana_questions enable row level security;
alter table public.ramayana_players enable row level security;
alter table public.ramayana_answers enable row level security;

-- Room and questions are saved atomically, so an incomplete room is never visible.
create function public.ramayana_create(p_code text, p_title text, p_questions jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare room_id uuid;
begin
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 100 then
    raise exception 'Add between 1 and 100 questions';
  end if;
  insert into public.ramayana_sessions(code,title) values(p_code,p_title) returning id into room_id;
  insert into public.ramayana_questions(session_id,position,prompt,options,correct_index)
    select room_id,(ordinality-1)::integer,value->>'prompt',value->'options',(value->>'correctIndex')::integer
    from jsonb_array_elements(p_questions) with ordinality;
  return room_id;
end;
$$;

-- Lock the session during joining, so starting and joining cannot race.
create function public.ramayana_join(p_code text, p_name text, p_phone text, p_hash text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.ramayana_sessions;
begin
  select * into s from public.ramayana_sessions where code = p_code for update;
  if not found then raise exception 'Quiz code not found'; end if;
  if s.status <> 'lobby' then raise exception 'This quiz has already started. Registration is closed'; end if;
  insert into public.ramayana_players(session_id,name,phone,token_hash) values(s.id,p_name,p_phone,p_hash);
end;
$$;

-- One transaction owns a player's timer, answer, score and next position.
-- Stale/repeated submissions return current state without answering the next question.
create function public.ramayana_progress(p_hash text, p_position integer default null, p_answer integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.ramayana_players;
  s public.ramayana_sessions;
  q public.ramayana_questions;
  total integer;
  t timestamptz;
  expired boolean;
  is_correct boolean;
  used_ms integer;
  phase text;
begin
  select * into p from public.ramayana_players where token_hash = p_hash for update;
  if not found then raise exception 'Participant access expired. Please join again'; end if;
  t := clock_timestamp();
  select * into s from public.ramayana_sessions where id = p.session_id;
  select count(*) into total from public.ramayana_questions where session_id = s.id;
  if s.status = 'live' and p.finished_at is null then
    if p.question_opens_at is null then
      p.question_opens_at := t + interval '3 seconds';
      update public.ramayana_players set question_opens_at = p.question_opens_at where id = p.id;
    end if;
    select * into q from public.ramayana_questions where session_id = s.id and position = p.position;
    expired := t >= p.question_opens_at + interval '30 seconds';
    if p_position = p.position and t < p.question_opens_at then raise exception 'Wait for the countdown'; end if;
    if not expired and p_position = p.position and (p_answer is null or p_answer < 0 or p_answer >= jsonb_array_length(q.options)) then
      raise exception 'Select an answer before submitting';
    end if;
    if expired or (p_position = p.position and p_answer is not null) then
      used_ms := case when expired then 30000 else greatest(0,least(30000,floor(extract(epoch from (t-p.question_opens_at))*1000)::integer)) end;
      is_correct := not expired and p_answer = q.correct_index;
      insert into public.ramayana_answers(player_id,question_id,answer_index,correct,elapsed_ms)
        values(p.id,q.id,case when expired then null else p_answer end,is_correct,used_ms);
      p.position := p.position + 1;
      p.score := p.score + case when is_correct then 1 else 0 end;
      p.elapsed_ms := p.elapsed_ms + used_ms;
      p.finished_at := case when p.position >= total then t else null end;
      p.question_opens_at := case when p.finished_at is null then t + interval '3 seconds' else null end;
      update public.ramayana_players set position=p.position,score=p.score,elapsed_ms=p.elapsed_ms,
        finished_at=p.finished_at,question_opens_at=p.question_opens_at where id=p.id;
    end if;
  end if;
  phase := case when s.status='closed' then 'closed' when p.finished_at is not null then 'finished'
    when s.status='lobby' then 'waiting' when t < p.question_opens_at then 'countdown' else 'question' end;
  select * into q from public.ramayana_questions where session_id=s.id and position=p.position;
  return jsonb_build_object('title',s.title,'code',s.code,'name',p.name,'phase',phase,'position',p.position,
    'total',total,'score',p.score,'serverNow',t,'opensAt',p.question_opens_at,
    'deadline',p.question_opens_at + interval '30 seconds',
    'question',case when phase='question' then jsonb_build_object('prompt',q.prompt,'options',q.options) else null end);
end;
$$;
-- Only the server's service-role connection may call these functions or read tables.
revoke all on public.ramayana_sessions,public.ramayana_questions,public.ramayana_players,public.ramayana_answers from anon,authenticated;
revoke all on function public.ramayana_join(text,text,text,text) from public,anon,authenticated;
revoke all on function public.ramayana_progress(text,integer,integer) from public,anon,authenticated;
revoke all on function public.ramayana_create(text,text,jsonb) from public,anon,authenticated;
grant all on public.ramayana_sessions,public.ramayana_questions,public.ramayana_players,public.ramayana_answers to service_role;
grant execute on function public.ramayana_join(text,text,text,text) to service_role;
grant execute on function public.ramayana_progress(text,integer,integer) to service_role;
grant execute on function public.ramayana_create(text,text,jsonb) to service_role;
commit;

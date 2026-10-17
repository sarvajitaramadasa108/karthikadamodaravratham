create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  host_token_hash text not null,
  status text not null default 'lobby' check (status in ('lobby','live','finished')),
  current_question integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  position integer not null,
  prompt text not null,
  options jsonb not null,
  correct_index integer not null check (correct_index >= 0 and correct_index <= 5),
  seconds integer not null default 20 check (seconds between 5 and 240),
  unique (session_id, position)
);

create table if not exists public.quiz_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  display_name text not null,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (session_id, display_name)
);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  player_id uuid not null references public.quiz_players(id) on delete cascade,
  answer_index integer not null check (answer_index >= 0 and answer_index <= 5),
  correct boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (question_id, player_id)
);

create index if not exists quiz_questions_session_position_idx on public.quiz_questions(session_id, position);
create index if not exists quiz_players_session_idx on public.quiz_players(session_id);
create index if not exists quiz_answers_question_idx on public.quiz_answers(question_id);

alter table public.quiz_sessions enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_players enable row level security;
alter table public.quiz_answers enable row level security;

create or replace function public.increment_quiz_player_score(player_id_input uuid, points_input integer)
returns void language sql security definer set search_path = public as $$
  update public.quiz_players set score = score + points_input where id = player_id_input;
$$;

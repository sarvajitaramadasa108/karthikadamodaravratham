alter table public.quiz_sessions add column if not exists question_started_at timestamptz;
alter table public.quiz_answers add column if not exists points integer not null default 0;

-- Existing questions can keep their saved timer; newly created questions use 30 seconds in the app.

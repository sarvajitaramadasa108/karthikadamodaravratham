-- Run once in your Supabase project's SQL editor before opening registrations.
create table public.participants (
  id uuid primary key,
  reference text not null unique,
  access_hash text not null unique,
  child_name text not null check (char_length(child_name) between 2 and 80),
  age integer not null check (age between 6 and 15),
  parent_name text not null,
  phone text not null,
  email text,
  locality text not null,
  school text,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (child_name, phone)
);
create table public.uploads (
  id uuid primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  kind text not null check (kind in ('daily', 'special')),
  path text not null unique,
  mime_type text not null,
  byte_size bigint not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.daily_offerings (
  id uuid primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  offering_date date not null check (offering_date between date '2026-10-26' and date '2026-11-25'),
  offered_at time not null check (offered_at < time '19:30:00'),
  upload_id uuid not null unique references public.uploads(id),
  submitted_before_deadline boolean not null,
  lamp_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (participant_id, offering_date)
);
create table public.attendance (
  participant_id uuid not null references public.participants(id) on delete cascade,
  attendance_date date not null check (attendance_date between date '2026-10-26' and date '2026-11-25'),
  gita boolean not null default false,
  japa boolean not null default false,
  arati boolean not null default false,
  primary key (participant_id, attendance_date)
);
create table public.special_offerings (
  id uuid primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  category text not null check (category in ('Painting or drawing', 'Pastime narration', 'Damodara Ashtakam', 'Other creative offering')),
  title text not null,
  description text not null,
  upload_id uuid not null unique references public.uploads(id),
  shortlisted boolean not null default false,
  created_at timestamptz not null default now()
);
create index uploads_participant_created on public.uploads (participant_id, created_at);
create index daily_date on public.daily_offerings (offering_date);
create index special_participant on public.special_offerings (participant_id);
alter table public.participants enable row level security;
alter table public.uploads enable row level security;
alter table public.daily_offerings enable row level security;
alter table public.attendance enable row level security;
alter table public.special_offerings enable row level security;
-- No anonymous/browser policies: only server-side service-role access is permitted.
revoke all on public.participants, public.uploads, public.daily_offerings, public.attendance, public.special_offerings from anon, authenticated;
grant all on public.participants, public.uploads, public.daily_offerings, public.attendance, public.special_offerings to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offerings', 'offerings', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']);

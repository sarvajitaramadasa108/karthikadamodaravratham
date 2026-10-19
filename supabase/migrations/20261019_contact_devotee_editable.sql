alter table public.participants add column if not exists contact_devotee_editable boolean not null default false;
update public.participants
set contact_devotee_editable = true
where created_at < timestamptz '2026-10-19 12:00:00+05:30';

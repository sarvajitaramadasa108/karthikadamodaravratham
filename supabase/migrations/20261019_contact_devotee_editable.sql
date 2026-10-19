alter table public.participants add column if not exists contact_devotee_editable boolean not null default false;
update public.participants set contact_devotee_editable = true where contact_devotee_editable = false;

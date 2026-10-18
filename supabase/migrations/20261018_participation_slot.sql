alter table public.participants add column if not exists participation_slot text;
alter table public.participants drop constraint if exists participants_participation_slot_check;
alter table public.participants add constraint participants_participation_slot_check check (participation_slot is null or participation_slot in ('morning', 'evening', 'both'));

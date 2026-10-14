-- Registration is open to everyone; age and parent details are optional legacy fields.
alter table public.participants alter column age drop not null;
alter table public.participants alter column parent_name drop not null;
alter table public.participants drop constraint if exists participants_age_check;
alter table public.participants add constraint participants_age_check check (age is null or age between 6 and 15);

-- Registration is open to everyone; age and parent details are optional legacy fields.
create sequence if not exists registration_number_seq start 1;
alter table public.participants alter column reference set default ('KDC-' || lpad(nextval('registration_number_seq')::text, 4, '0'));
do $$
declare max_number integer;
begin
  select max(regexp_replace(reference, '^KDC-', '')::integer) into max_number
  from public.participants where reference ~ '^KDC-[0-9]{4}$';
  if max_number is null then perform setval('registration_number_seq', 1, false);
  else perform setval('registration_number_seq', max_number, true);
  end if;
end $$;
alter table public.participants alter column age drop not null;
alter table public.participants alter column parent_name drop not null;
alter table public.participants drop constraint if exists participants_age_check;
alter table public.participants add constraint participants_age_check check (age is null or age between 6 and 15);
alter table public.daily_offerings drop constraint if exists daily_offerings_offering_date_check;
alter table public.daily_offerings add constraint daily_offerings_offering_date_check check (offering_date between date '2026-10-26' and date '2026-11-24');
alter table public.attendance drop constraint if exists attendance_attendance_date_check;
alter table public.attendance add constraint attendance_attendance_date_check check (attendance_date between date '2026-10-26' and date '2026-11-24');

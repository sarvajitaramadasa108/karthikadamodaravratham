alter table public.participants add column if not exists contact_devotee text;
update public.participants set contact_devotee = 'No one above' where contact_devotee is null;
alter table public.participants alter column contact_devotee set not null;
alter table public.participants drop constraint if exists participants_contact_devotee_check;
alter table public.participants add constraint participants_contact_devotee_check check (contact_devotee in (
  'Yaduraja Dasa','Vaikunteswara Dasa','Ambarisha Dasa','Sruthi Sagar Dasa','Shyama Madhava Dasa','Keshav Kripa Dasa',
  'Gopeshwara Dasa','Ranaveera Rama Dasa','Adhokshaja Dasa','Gadadhara Dasa','Ishana Krishna Dasa','Navaneeta Krishna Dasa',
  'Shadgoswami Dasa','Natha Hari Dasa','Ramaapati Dasa','Sarvajita Rama Dasa','Bhaktidayaka Chaitanya Dasa',
  'Gopijana Vallabha Dasa','Mukunda Gauranga Dasa','Meghanada Vishnu Dasa','Dayasagara Krishna Dasa','No one above'
));

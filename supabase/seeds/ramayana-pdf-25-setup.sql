-- Run in the EXISTING Karthika Supabase project's SQL Editor.
-- Adds only Ramayana tables/functions if absent, then imports the supplied PDF.
-- Never modifies existing Karthika tables or quizzes. Safe to re-run this import.
begin;
do $ramayana_setup$
begin
  if to_regclass('public.ramayana_sessions') is null then
    execute $ramayana_schema$
-- Independent Ramayana quiz. Does not alter any existing challenge/quiz objects.
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

    $ramayana_schema$;
  end if;
end;
$ramayana_setup$;
do $ramayana_import$
declare
  quiz_id uuid;
  quiz_code text;
  question_set jsonb := $ramayana_questions$[{"prompt":"Who was the father of Lord Rama?\nశ్రీరాముని తండ్రి ఎవరు?","options":["Janaka / జనకుడు","Dasharatha / దశరథుడు","Dilipa / దిలీపుడు","Bharata / భరతుడు"],"correctIndex":1},{"prompt":"Which sage took Rama and Lakshmana to protect his sacrifice?\nతన యజ్ఞాన్ని రక్షించడానికి రామలక్ష్మణులను తీసుకువెళ్లిన మహర్షి ఎవరు?","options":["Vasishta / వసిష్ఠుడు","Agastya / అగస్త్యుడు","Vishwamitra / విశ్వామిత్రుడు","Valmiki / వాల్మీకి"],"correctIndex":2},{"prompt":"Which rakshasi did Rama slay at Vishwamitra’s instruction?\nవిశ్వామిత్రుని ఆదేశంతో శ్రీరాముడు ఏ రాక్షసిని సంహరించాడు?","options":["Tataka / తాటక","Surpanakha / శూర్పణఖ","Simhika / సింహిక","Lankini / లంకిణి"],"correctIndex":0},{"prompt":"Whose bow did Rama break at Mithila?\nమిథిలలో శ్రీరాముడు ఎవరి ధనుస్సును విరిచాడు?","options":["Vishnu / విష్ణువు","Indra / ఇంద్రుడు","Varuna / వరుణుడు","Shiva / శివుడు"],"correctIndex":3},{"prompt":"For how many years was Rama exiled?\nశ్రీరామునికి ఎన్ని సంవత్సరాల వనవాసం విధించబడింది?","options":["12 years / 12 సంవత్సరాలు","13 years / 13 సంవత్సరాలు","14 years / 14 సంవత్సరాలు","15 years / 15 సంవత్సరాలు"],"correctIndex":2},{"prompt":"Who accompanied Rama into exile?\nశ్రీరామునితో పాటు వనవాసానికి ఎవరు వెళ్లారు?","options":["Sita and Bharata / సీత, భరతుడు","Sita and Lakshmana / సీత, లక్ష్మణుడు","Urmila and Lakshmana / ఊర్మిళ, లక్ష్మణుడు","Bharata and Shatrughna / భరతుడు, శత్రుఘ్నుడు"],"correctIndex":1},{"prompt":"What did Bharata install as the symbol of Rama’s kingship?\nశ్రీరాముని రాజ్యాధికారానికి ప్రతీకగా భరతుడు ఏమి ప్రతిష్ఠించాడు?","options":["Rama’s sandals / శ్రీరాముని పాదుకలు","Rama’s bow / శ్రీరాముని ధనుస్సు","Rama’s crown / శ్రీరాముని కిరీటం","Rama’s ring / శ్రీరాముని ఉంగరం"],"correctIndex":0},{"prompt":"Who assumed the form of a golden deer?\nబంగారు లేడి రూపాన్ని ధరించినవాడు ఎవరు?","options":["Subahu / సుబాహుడు","Khara / ఖరుడు","Kabandha / కబంధుడు","Maricha / మారీచుడు"],"correctIndex":3},{"prompt":"Which bird fought Ravana during Sita’s abduction?\nసీతాపహరణ సమయంలో రావణునితో పోరాడిన పక్షి ఎవరు?","options":["Sampati / సంపాతి","Jatayu / జటాయువు","Garuda / గరుత్మంతుడు","Jambavan / జాంబవంతుడు"],"correctIndex":1},{"prompt":"Which devotee welcomed Rama at her hermitage near Lake Pampa?\nపంపా సరస్సు సమీపంలోని ఆశ్రమంలో శ్రీరాముని ఆహ్వానించిన భక్తురాలు ఎవరు?","options":["Anasuya / అనసూయ","Tara / తార","Shabari / శబరి","Trijata / త్రిజట"],"correctIndex":2},{"prompt":"Who was Sugriva’s elder brother?\nసుగ్రీవుని అన్న ఎవరు?","options":["Vali / వాలి","Angada / అంగదుడు","Nala / నలుడు","Jambavan / జాంబవంతుడు"],"correctIndex":0},{"prompt":"On which mountain did Sugriva take refuge?\nసుగ్రీవుడు ఏ పర్వతంపై ఆశ్రయం పొందాడు?","options":["Kailasa / కైలాసం","Mainaka / మైనాకం","Mahendra / మహేంద్రం","Rishyamuka / ఋష్యమూకం"],"correctIndex":3},{"prompt":"Who reminded Hanuman of his strength before his leap to Lanka?\nలంకకు దూకే ముందు హనుమంతునికి అతని శక్తిని గుర్తు చేసినవారు ఎవరు?","options":["Angada / అంగదుడు","Jambavan / జాంబవంతుడు","Sugriva / సుగ్రీవుడు","Nila / నీలుడు"],"correctIndex":1},{"prompt":"Where did Hanuman find Sita in Lanka?\nలంకలో హనుమంతుడు సీతాదేవిని ఎక్కడ కనుగొన్నాడు?","options":["Ashoka grove / అశోకవనం","Royal hall / రాజసభ","Battlefield / యుద్ధభూమి","Seashore / సముద్రతీరం"],"correctIndex":0},{"prompt":"What token from Rama did Hanuman show Sita?\nహనుమంతుడు సీతాదేవికి శ్రీరాముని ఏ గుర్తును చూపించాడు?","options":["Bow / ధనుస్సు","Sandals / పాదుకలు","Ring / ఉంగరం","Crown / కిరీటం"],"correctIndex":2},{"prompt":"Who advised Ravana that a messenger should not be killed?\nదూతను చంపకూడదని రావణునికి సలహా ఇచ్చినవాడు ఎవరు?","options":["Kumbhakarna / కుంభకర్ణుడు","Indrajit / ఇంద్రజిత్తు","Prahasta / ప్రహస్తుడు","Vibhishana / విభీషణుడు"],"correctIndex":3},{"prompt":"Which brother of Ravana sought refuge with Rama?\nరావణుని సోదరులలో శ్రీరాముని శరణు కోరినవాడు ఎవరు?","options":["Kumbhakarna / కుంభకర్ణుడు","Vibhishana / విభీషణుడు","Khara / ఖరుడు","Indrajit / ఇంద్రజిత్తు"],"correctIndex":1},{"prompt":"Who directed the construction of the bridge to Lanka?\nలంకకు వంతెన నిర్మాణాన్ని ఎవరు నిర్వహించారు?","options":["Nala / నలుడు","Angada / అంగదుడు","Jambavan / జాంబవంతుడు","Sugriva / సుగ్రీవుడు"],"correctIndex":0},{"prompt":"Who killed Indrajit in battle?\nయుద్ధంలో ఇంద్రజిత్తును సంహరించినవాడు ఎవరు?","options":["Rama / రాముడు","Hanuman / హనుమంతుడు","Lakshmana / లక్ష్మణుడు","Sugriva / సుగ్రీవుడు"],"correctIndex":2},{"prompt":"Which flying vehicle carried Rama and Sita back toward Ayodhya?\nశ్రీరాముడు, సీతాదేవి అయోధ్యకు తిరిగి రావడానికి ఉపయోగించిన విమానం ఏది?","options":["Garuda vehicle / గరుడ వాహనం","Airavata / ఐరావతం","Nandi vehicle / నంది వాహనం","Pushpaka Vimana / పుష్పక విమానం"],"correctIndex":3},{"prompt":"Which mountain was associated with the life-restoring medicinal herbs sought for Lakshmana?\nలక్ష్మణుని చికిత్సకు అవసరమైన ఔషధ మూలికల కోసం చెప్పబడిన పర్వతం ఏది?","options":["Gandhamadana / గంధమాదనం","Trikuta / త్రికూటం","Chitrakuta / చిత్రకూటం","Rishyamuka / ఋష్యమూకం"],"correctIndex":0},{"prompt":"Who became king of Lanka after Ravana’s death?\nరావణుని మరణం తరువాత లంకకు రాజైనవాడు ఎవరు?","options":["Indrajit / ఇంద్రజిత్తు","Vibhishana / విభీషణుడు","Sugriva / సుగ్రీవుడు","Angada / అంగదుడు"],"correctIndex":1},{"prompt":"Who was Ravana’s giant brother who fought in the war?\nయుద్ధంలో పోరాడిన రావణుని మహాకాయుడైన సోదరుడు ఎవరు?","options":["Prahasta / ప్రహస్తుడు","Atikaya / అతికాయుడు","Kumbhakarna / కుంభకర్ణుడు","Akampana / అకంపనుడు"],"correctIndex":2},{"prompt":"Who were the twin sons of Rama and Sita?\nశ్రీరాముడు, సీతాదేవి దంపతుల కవల కుమారులు ఎవరు?","options":["Lava and Kusha / లవకుశులు","Nala and Nila / నలనీలులు","Bharata and Shatrughna / భరతశత్రుఘ్నులు","Angada and Chandraketu / అంగదచంద్రకేతులు"],"correctIndex":0},{"prompt":"Who taught the Ramayana to Lava and Kusha?\nలవకుశులకు రామాయణాన్ని బోధించిన మహర్షి ఎవరు?","options":["Vasishta / వసిష్ఠుడు","Vishwamitra / విశ్వామిత్రుడు","Agastya / అగస్త్యుడు","Valmiki / వాల్మీకి"],"correctIndex":3}]$ramayana_questions$::jsonb;
begin
  -- Reuse an identical imported set; do not reset any participant attempts.
  select s.id into quiz_id from public.ramayana_sessions s
  where s.title = 'Sri Ramayana Quiz — 25 Questions (Telugu & English)'
    and (select jsonb_agg(jsonb_build_object('prompt',q.prompt,'options',q.options,'correctIndex',q.correct_index) order by q.position)
      from public.ramayana_questions q where q.session_id=s.id) = question_set
  order by s.created_at desc limit 1;
  if quiz_id is null then
    for attempt in 1..10 loop
      quiz_code := floor(100000 + random() * 900000)::integer::text;
      begin
        quiz_id := public.ramayana_create(quiz_code, 'Sri Ramayana Quiz — 25 Questions (Telugu & English)', question_set);
        exit;
      exception when unique_violation then
        if attempt = 10 then raise; end if;
      end;
    end loop;
  end if;
end;
$ramayana_import$;
commit;
-- The result below is the actual saved room code, not a sample code.
select s.code as room_code, s.title, s.status, count(q.id) as questions
from public.ramayana_sessions s join public.ramayana_questions q on q.session_id=s.id
where s.title='Sri Ramayana Quiz — 25 Questions (Telugu & English)'
group by s.id order by s.created_at desc;

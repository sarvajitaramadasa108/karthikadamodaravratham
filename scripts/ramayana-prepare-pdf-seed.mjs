// Generates a setup/import script for the existing Supabase project.
// No remote connection and no room is created by running this generator.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const base = new URL('../', import.meta.url);
const bank = JSON.parse(await readFile(new URL('lib/ramayana/question-bank.json', base), 'utf8'));
if (bank.questions.length !== 25) throw new Error('Expected exactly 25 PDF questions');
let schema = await readFile(new URL('supabase/migrations/20261020_ramayana_quiz.sql', base), 'utf8');
schema = schema.replace(/^begin;\r?\n/m, '').replace(/^commit;\s*$/m, '');
const payload = JSON.stringify(bank.questions);
const title = bank.title.replaceAll("'", "''");
const sql = `-- Run in the EXISTING Karthika Supabase project's SQL Editor.
-- Adds only Ramayana tables/functions if absent, then imports the supplied PDF.
-- Never modifies existing Karthika tables or quizzes. Safe to re-run this import.
begin;
do $ramayana_setup$
begin
  if to_regclass('public.ramayana_sessions') is null then
    execute $ramayana_schema$
${schema}
    $ramayana_schema$;
  end if;
end;
$ramayana_setup$;
do $ramayana_import$
declare
  quiz_id uuid;
  quiz_code text;
  question_set jsonb := $ramayana_questions$${payload}$ramayana_questions$::jsonb;
begin
  -- Reuse an identical imported set; do not reset any participant attempts.
  select s.id into quiz_id from public.ramayana_sessions s
  where s.title = '${title}'
    and (select jsonb_agg(jsonb_build_object('prompt',q.prompt,'options',q.options,'correctIndex',q.correct_index) order by q.position)
      from public.ramayana_questions q where q.session_id=s.id) = question_set
  order by s.created_at desc limit 1;
  if quiz_id is null then
    for attempt in 1..10 loop
      quiz_code := floor(100000 + random() * 900000)::integer::text;
      begin
        quiz_id := public.ramayana_create(quiz_code, '${title}', question_set);
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
where s.title='${title}'
group by s.id order by s.created_at desc;
`;
await mkdir(new URL('supabase/seeds/', base), { recursive: true });
await writeFile(new URL('supabase/seeds/ramayana-pdf-25-setup.sql', base), sql, 'utf8');
console.log('Prepared 25-question import: supabase/seeds/ramayana-pdf-25-setup.sql. No database was changed.');

import { AppError, db, fail, hash, sameOrigin, text } from '@/lib/server';
import { randomInt, randomBytes } from 'node:crypto';

export const dynamic = 'force-dynamic';

type IncomingQuestion = { prompt?: unknown; options?: unknown; correctIndex?: unknown; seconds?: unknown };

function code() {
  return String(randomInt(100000, 1000000));
}

function questions(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new AppError('Add between 1 and 50 questions.');
  return value.map((raw, position) => {
    const item = (raw || {}) as IncomingQuestion;
    const prompt = text(item.prompt, `question ${position + 1}`, 3, 500);
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 6) throw new AppError(`Question ${position + 1} needs 2 to 6 options.`);
    const options = item.options.map((option) => text(option, 'answer option', 1, 180));
    const correctIndex = Number(item.correctIndex);
    const seconds = Number(item.seconds || 20);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) throw new AppError(`Choose a correct answer for question ${position + 1}.`);
    if (!Number.isInteger(seconds) || seconds < 5 || seconds > 240) throw new AppError('Question timers must be between 5 and 240 seconds.');
    return { position, prompt, options, correct_index: correctIndex, seconds };
  });
}

async function session(client: ReturnType<typeof db>, value: unknown) {
  const identifier = text(value, 'game code', 6, 6);
  const { data, error } = await client.from('quiz_sessions').select('id,code,title,status,current_question,created_at').eq('code', identifier).maybeSingle();
  if (error || !data) throw new AppError('Game code not found.', 404);
  return data;
}

async function hostSession(client: ReturnType<typeof db>, value: unknown, token: unknown) {
  const current = await session(client, value);
  if (typeof token !== 'string' || token.length < 24) throw new AppError('Host access is invalid.', 401);
  const { data } = await client.from('quiz_sessions').select('id').eq('id', current.id).eq('host_token_hash', hash(token)).maybeSingle();
  if (!data) throw new AppError('Host access is invalid.', 401);
  return current;
}

async function view(client: ReturnType<typeof db>, current: { id: string; code: string; title: string; status: string; current_question: number; created_at: string }) {
  const [{ data: questionRows, error: questionError }, { data: players, error: playerError }] = await Promise.all([
    client.from('quiz_questions').select('id,position,prompt,options,seconds').eq('session_id', current.id).order('position'),
    client.from('quiz_players').select('id,display_name,score,joined_at').eq('session_id', current.id).order('score', { ascending: false }).order('joined_at')
  ]);
  if (questionError || playerError) throw new AppError('The live quiz could not be loaded.', 503);
  const question = questionRows?.find((item) => item.position === current.current_question) || null;
  return { session: current, questions: questionRows || [], question, players: players || [] };
}

export async function GET(request: Request) {
  try {
    const client = db();
    const current = await session(client, new URL(request.url).searchParams.get('code'));
    return Response.json(await view(client, current), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json() as Record<string, unknown>;
    const client = db();
    if (body.action === 'create') {
      const title = text(body.title, 'quiz title', 3, 120);
      const prepared = questions(body.questions);
      const hostToken = randomBytes(24).toString('base64url');
      let created: { id: string; code: string } | null = null;
      for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
        const result = await client.from('quiz_sessions').insert({ code: code(), title, host_token_hash: hash(hostToken) }).select('id,code').single();
        if (!result.error) created = result.data;
      }
      if (!created) throw new AppError('Could not create a unique game code. Please try again.', 503);
      const inserted = await client.from('quiz_questions').insert(prepared.map((item) => ({ ...item, session_id: created!.id })));
      if (inserted.error) { await client.from('quiz_sessions').delete().eq('id', created.id); throw new AppError('Could not save the quiz questions.', 503); }
      return Response.json({ ...(await view(client, { ...created, title, status: 'lobby', current_question: 0, created_at: new Date().toISOString() })), hostToken });
    }
    if (body.action === 'join') {
      const current = await session(client, body.code);
      if (current.status !== 'lobby') throw new AppError('This game has already started.', 409);
      const displayName = text(body.displayName, 'display name', 1, 40);
      const result = await client.from('quiz_players').insert({ session_id: current.id, display_name: displayName }).select('id,display_name,score,joined_at').single();
      if (result.error) throw new AppError(result.error.code === '23505' ? 'That display name is already in use.' : 'Could not join this game.', result.error.code === '23505' ? 409 : 503);
      return Response.json({ player: result.data, ...(await view(client, current)) });
    }
    if (body.action === 'start' || body.action === 'next') {
      const current = await hostSession(client, body.code, body.hostToken);
      const { count } = await client.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('session_id', current.id);
      const total = count || 0;
      const nextPosition = body.action === 'start' ? 0 : current.current_question + 1;
      const status = nextPosition >= total ? 'finished' : 'live';
      const result = await client.from('quiz_sessions').update({ status, current_question: Math.min(nextPosition, Math.max(0, total - 1)) }).eq('id', current.id);
      if (result.error) throw new AppError('Could not update the game.', 503);
      const updated = await session(client, current.code);
      return Response.json(await view(client, updated));
    }
    if (body.action === 'answer') {
      const current = await session(client, body.code);
      if (current.status !== 'live') throw new AppError('This question is not accepting answers.', 409);
      const playerId = text(body.playerId, 'player ID', 36, 36);
      const answerIndex = Number(body.answerIndex);
      const { data: question, error: questionError } = await client.from('quiz_questions').select('id,correct_index').eq('session_id', current.id).eq('position', current.current_question).single();
      if (questionError || !question || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 5) throw new AppError('That answer is not valid.');
      const correct = answerIndex === question.correct_index;
      const result = await client.from('quiz_answers').insert({ session_id: current.id, question_id: question.id, player_id: playerId, answer_index: answerIndex, correct });
      if (result.error) throw new AppError(result.error.code === '23505' ? 'You already answered this question.' : 'Could not record your answer.', result.error.code === '23505' ? 409 : 503);
      if (correct) await client.rpc('increment_quiz_player_score', { player_id_input: playerId, points_input: 100 });
      return Response.json({ correct });
    }
    throw new AppError('Unknown quiz action.');
  } catch (error) { return fail(error); }
}

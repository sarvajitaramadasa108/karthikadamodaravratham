import { randomInt } from 'node:crypto';
import { cookies } from 'next/headers';
import { checkPassword, cookieOptions, database, digest, fail, json, progress, RamayanaError, requireAdmin, sameOrigin, signIn, token } from '@/lib/ramayana/server';
import { cleanPhone, cleanQuestions } from '@/lib/ramayana/validation';
import questionBank from '@/lib/ramayana/question-bank.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if (params.get('featured') === '1') {
      // This event's QR/game code is public; never return participant details.
      const result = await database().from('ramayana_sessions').select('code,title,status')
        .eq('title', questionBank.title).eq('status', 'lobby').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (result.error) throw new RamayanaError('Could not find the imported Ramayana quiz.', 503);
      if (!result.data) throw new RamayanaError('No imported Ramayana quiz is accepting participants yet.', 404);
      return json(result.data);
    }
    if (params.has('lobby')) {
      const code = params.get('lobby');
      if (!code || !/^\d{6}$/.test(code)) throw new RamayanaError('Enter a valid quiz code.');
      const client = database();
      const room = await client.from('ramayana_sessions').select('id,code,title,status').eq('code', code).maybeSingle();
      if (room.error) throw new RamayanaError('Could not load this Ramayana lobby.', 503);
      if (!room.data) throw new RamayanaError('Quiz not found.', 404);
      const count = await client.from('ramayana_players').select('id', { count: 'exact', head: true }).eq('session_id', room.data.id);
      if (count.error) throw new RamayanaError('Could not load participation count.', 503);
      return json({ code: room.data.code, title: room.data.title, status: room.data.status, count: count.count || 0 });
    }
    if (params.get('admin') === '1') {
      await requireAdmin();
      const client = database();
      const sessions = await client.from('ramayana_sessions').select('id,code,title,status,created_at').order('created_at', { ascending: false }).limit(100);
      if (sessions.error) throw new RamayanaError('Run the Ramayana quiz SQL migration before hosting.', 503);
      const code = params.get('code');
      let players: unknown[] = [];
      if (code) {
        const room = sessions.data.find((s) => s.code === code);
        if (!room) throw new RamayanaError('Quiz not found.', 404);
        const result = await client.from('ramayana_players').select('id,name,phone,position,score,elapsed_ms,finished_at').eq('session_id', room.id).order('score', { ascending: false }).order('elapsed_ms').order('joined_at');
        if (result.error) throw new RamayanaError('Could not load participants.', 503);
        players = result.data;
      }
      return json({ sessions: sessions.data, players });
    }
    const credential = request.headers.get('authorization')?.replace(/^Bearer /, '');
    return json(await progress(database(), credential));
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get('content-length') || 0) > 200000) throw new RamayanaError('This submission is too large.', 413);
    const raw = await request.text();
    if (raw.length > 200000) throw new RamayanaError('This submission is too large.', 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error(); }
    catch { throw new RamayanaError('Invalid quiz submission.'); }
    if (body.action === 'login') {
      if (!checkPassword(body.password)) throw new RamayanaError('Incorrect Ramayana admin password.', 401);
      await signIn(); return json({ ok: true });
    }
    if (body.action === 'logout') {
      (await cookies()).set('ramayana-admin', '', { ...cookieOptions, maxAge: 0 }); return json({ ok: true });
    }
    const client = database();
    if (body.action === 'join') {
      if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new RamayanaError('Enter the six-digit quiz code.');
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) throw new RamayanaError('Enter your name (2–80 characters).');
      let phone: string;
      try { phone = cleanPhone(body.phone); } catch (error) { throw new RamayanaError((error as Error).message); }
      const credential = token();
      const result = await client.rpc('ramayana_join', { p_code: body.code, p_name: body.name.trim(), p_phone: phone, p_hash: digest(credential) });
      if (result.error) {
        if (result.error.code === '23505') throw new RamayanaError('This number is already registered. Continue on the original browser or ask the admin for help.', 409);
        if (result.error.code === 'P0001') throw new RamayanaError(result.error.message, 409);
        throw new RamayanaError('Could not register. Check the Ramayana quiz database setup.', 503);
      }
      return json({ token: credential, state: await progress(client, credential) });
    }
    if (body.action === 'answer') {
      if (!Number.isInteger(body.position) || Number(body.position) < 0 || !Number.isInteger(body.answer) || Number(body.answer) < 0 || Number(body.answer) > 3) throw new RamayanaError('Select a valid answer.');
      const credential = request.headers.get('authorization')?.replace(/^Bearer /, '');
      return json(await progress(client, credential, body.position, body.answer));
    }
    await requireAdmin();
    if (body.action === 'loadPdfQuestions') return json(questionBank);
    if (body.action === 'create') {
      if (typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.trim().length > 120) throw new RamayanaError('Enter a quiz title (3–120 characters).');
      let prepared;
      try { prepared = cleanQuestions(body.questions); } catch (error) { throw new RamayanaError((error as Error).message); }
      let createdCode: string | null = null;
      for (let i = 0; i < 5 && !createdCode; i++) {
        const code = String(randomInt(100000, 1000000));
        const result = await client.rpc('ramayana_create', { p_code: code, p_title: body.title.trim(), p_questions: prepared });
        if (result.error && result.error.code !== '23505') throw new RamayanaError('Could not create the quiz. Check the Ramayana migration.', 503);
        if (!result.error) createdCode = code;
      }
      if (!createdCode) throw new RamayanaError('Could not generate a room code. Try again.', 503);
      return json({ code: createdCode });
    }
    if (body.action === 'start' || body.action === 'close') {
      if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new RamayanaError('Choose a quiz room.');
      const result = await client.from('ramayana_sessions').update(body.action === 'start' ? { status: 'live', started_at: new Date().toISOString() } : { status: 'closed' }).eq('code', body.code).eq('status', body.action === 'start' ? 'lobby' : 'live').select('code').maybeSingle();
      if (result.error) throw new RamayanaError('Could not update the quiz.', 503);
      if (!result.data) throw new RamayanaError('This room has already changed. Refresh the dashboard.', 409);
      return json({ ok: true });
    }
    throw new RamayanaError('Unknown Ramayana quiz action.');
  } catch (error) { return fail(error); }
}

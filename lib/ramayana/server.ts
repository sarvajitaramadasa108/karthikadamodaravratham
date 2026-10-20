import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export class RamayanaError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export function database() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new RamayanaError('Ramayana quiz storage is not configured yet.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function secret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new RamayanaError('Ramayana quiz storage is not configured yet.', 503);
  return createHmac('sha256', value).update('ramayana-admin-session-v1').digest('hex');
}
export function equal(a: string, b: string) { return timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b))); }
export function checkPassword(password: unknown) { return typeof password === 'string' && equal(password, 'admin123'); }
export const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: '/api/ramayana' };
export async function signIn() {
  const expires = String(Date.now() + 8 * 3600000);
  (await cookies()).set('ramayana-admin', `${expires}.${createHmac('sha256', secret()).update(expires).digest('hex')}`, { ...cookieOptions, maxAge: 8 * 3600 });
}
export async function requireAdmin() {
  const [expires, signature] = ((await cookies()).get('ramayana-admin')?.value || '').split('.');
  if (!expires || !/^\d+$/.test(expires) || Number(expires) <= Date.now() || !signature || !equal(signature, createHmac('sha256', secret()).update(expires).digest('hex'))) throw new RamayanaError('Sign in to the Ramayana admin dashboard.', 401);
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new RamayanaError('Please submit from this website.', 403);
}
export function json(value: unknown) { return Response.json(value, { headers: { 'Cache-Control': 'no-store' } }); }
export function fail(error: unknown) {
  const known = error instanceof RamayanaError;
  if (!known) console.error('Ramayana quiz:', error instanceof Error ? error.message : 'Request failed');
  return Response.json({ error: known ? error.message : 'The request could not be completed. Please try again.' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
export async function progress(client: ReturnType<typeof database>, credential: unknown, position: unknown = null, answer: unknown = null) {
  if (typeof credential !== 'string' || credential.length < 32 || credential.length > 100) throw new RamayanaError('Please join this quiz to continue.', 401);
  const { data, error } = await client.rpc('ramayana_progress', { p_hash: digest(credential), p_position: position, p_answer: answer });
  if (error) {
    if (error.code === 'P0001') throw new RamayanaError(error.message, /access expired/.test(error.message) ? 401 : 409);
    throw new RamayanaError('Could not load the quiz. Check the Ramayana database migration and try again.', 503);
  }
  return data;
}

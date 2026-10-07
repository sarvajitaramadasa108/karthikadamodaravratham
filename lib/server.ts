import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AppError('Registrations and submissions are not open yet. Please check back after the organizers complete setup.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function constantEqual(a: string, b: string) {
  const left = Buffer.from(hash(a)); const right = Buffer.from(hash(b));
  return timingSafeEqual(left, right);
}
export function text(value: unknown, name: string, min = 1, max = 120): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new AppError(`Please enter a valid ${name}.`);
  return value.trim();
}
export async function participant(code: unknown) {
  const credential = text(code, 'participant code', 20, 100);
  const client = db();
  const { data, error } = await client.from('participants').select('id,child_name').eq('access_hash', hash(credential)).maybeSingle();
  if (error) throw new AppError('We could not check your registration. Please try again.', 503);
  if (!data) throw new AppError('Participant code not found. Use the private code you received after registration.', 401);
  return { client, person: data };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new AppError('Please submit this form from the challenge website.', 403);
}
export function fail(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
  console.error('Challenge request failed:', error instanceof Error ? error.message : 'unknown error');
  return Response.json({ error: 'Something went wrong. Your form has not been confirmed. Please try again.' }, { status: 500 });
}
function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new AppError('Organizer access has not been configured.', 503);
  return secret;
}
export function makeSession() {
  const payload = String(Date.now() + 8 * 60 * 60 * 1000);
  return `${payload}.${createHmac('sha256', sessionSecret()).update(payload).digest('hex')}`;
}
export async function requireOrganizer() {
  const value = (await cookies()).get('vratham-organizer')?.value ?? '';
  const [expires, signature] = value.split('.');
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) <= Date.now()) throw new AppError('Please sign in as an organizer.', 401);
  const expected = createHmac('sha256', sessionSecret()).update(expires).digest('hex');
  if (!constantEqual(expected, signature)) throw new AppError('Please sign in as an organizer.', 401);
}

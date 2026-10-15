import { randomBytes, randomUUID } from 'node:crypto';
import { AppError, db, fail, hash, sameOrigin, text } from '@/lib/server';
import { END_DATE, istDate } from '@/lib/challenge';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (istDate() > END_DATE) throw new AppError('Registration for this vratham has ended.');
    const data = await request.json();
    const name = text(data.name, 'name', 2, 80);
    const phone = text(data.phone, '10-digit Indian WhatsApp number').replace(/[\s()-]/g, '').replace(/^\+91/, '');
    if (!/^[6-9]\d{9}$/.test(phone)) throw new AppError('Enter a valid 10-digit Indian WhatsApp number.');
    const email = data.email ? text(data.email, 'email address', 5, 160).toLowerCase() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid email address.');
    const locality = text(data.locality, 'area in or around Vizag', 2, 100);
    if (data.consent !== true) throw new AppError('Please confirm your registration consent.');
    if (data.website) throw new AppError('We could not submit this registration.');
    const id = randomUUID();
    const code = `KDV-${randomBytes(18).toString('base64url')}`;
    const reference = `KDV-${id.slice(0, 8).toUpperCase()}`;
    const { error } = await db().from('participants').insert({ id, reference, access_hash: hash(code), child_name: name, age: null, parent_name: null, phone, email, locality, school: null });
    if (error?.code === '23505') throw new AppError('This name and WhatsApp number are already registered. Please contact the organizers if you need help.', 409);
    if (error?.code === '42P01') throw new AppError('The Supabase participants table is missing. Run the supplied schema.sql in Supabase SQL Editor.', 503);
    if (error?.code === '23502' || error?.code === '42703' || error?.code === '23514') throw new AppError('The Supabase participants table uses the older schema. Run the supplied registration migration in Supabase SQL Editor.', 503);
    if (error) { console.error('Registration insert failed:', error.message); throw new AppError('Your registration could not be saved. Please try again.', 503); }
    return Response.json({ code, reference, name }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}

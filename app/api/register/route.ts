import { randomBytes, randomUUID } from 'node:crypto';
import { AppError, db, fail, hash, sameOrigin, text } from '@/lib/server';
import { validAge, END_DATE, istDate } from '@/lib/challenge';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (istDate() > END_DATE) throw new AppError('Registration for this vratham has ended.');
    const data = await request.json();
    const childName = text(data.childName, 'child’s name', 2, 80);
    const parentName = text(data.parentName, 'parent or guardian name', 2, 80);
    if (!validAge(data.age)) throw new AppError('This challenge is for children ages 6–15.');
    const phone = text(data.phone, '10-digit Indian WhatsApp number').replace(/[\s()-]/g, '').replace(/^\+91/, '');
    if (!/^[6-9]\d{9}$/.test(phone)) throw new AppError('Enter a valid 10-digit Indian WhatsApp number.');
    const email = data.email ? text(data.email, 'email address', 5, 160).toLowerCase() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid email address.');
    const locality = text(data.locality, 'area in or around Vizag', 2, 100);
    const school = data.school ? text(data.school, 'school', 2, 120) : null;
    if (data.consent !== true) throw new AppError('A parent or guardian must consent before registration.');
    if (data.website) throw new AppError('We could not submit this registration.');
    const id = randomUUID();
    const code = `KDV-${randomBytes(18).toString('base64url')}`;
    const reference = `KDV-${id.slice(0, 8).toUpperCase()}`;
    const { error } = await db().from('participants').insert({ id, reference, access_hash: hash(code), child_name: childName, age: data.age, parent_name: parentName, phone, email, locality, school });
    if (error?.code === '23505') throw new AppError('This child is already registered with this WhatsApp number. Use the original participant code, or contact the organizers to recover access.', 409);
    if (error) throw new AppError('Your registration could not be saved. Please try again.', 503);
    return Response.json({ code, reference, childName }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}

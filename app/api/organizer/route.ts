import { AppError, db, fail, requireOrganizer, sameOrigin, text } from '@/lib/server';
import { inChallenge } from '@/lib/challenge';
import { randomBytes } from 'node:crypto';
import { hash } from '@/lib/server';
import { CONTACT_DEVOTEES } from '@/lib/devotees';
export const dynamic = 'force-dynamic';
async function allRows(table: string, columns: string) {
  const client = db(); const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += 1000) {
    const orderColumn = table === 'attendance' ? 'attendance_date' : table === 'participants' ? 'created_at' : 'id';
    let query = client.from(table).select(columns).order(orderColumn, { ascending: table !== 'participants' });
    if (table === 'attendance') query = query.order('participant_id');
    const { data, error } = await query.range(from, from + 999);
    if (error) throw new AppError('The organizer records could not be loaded.', 503);
    rows.push(...(data as any[])); if (!data || data.length < 1000) break;
  }
  return rows;
}
export async function GET() {
  try {
    await requireOrganizer();
    const [participants, daily, attendance, special] = await Promise.all([
      allRows('participants', 'id,reference,child_name,age,gender,participation_slot,contact_devotee,contact_devotee_editable,chanting,chanting_rounds,parent_name,phone,email,locality,school,created_at'),
      allRows('daily_offerings', '*'), allRows('attendance', '*'), allRows('special_offerings', '*')
    ]);
    return Response.json({ participants, daily, attendance, special }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request); await requireOrganizer();
    const data = await request.json(); const client = db();
    let result;
    if (data.action === 'attendance') {
      if (!inChallenge(data.date)) throw new AppError('Select a date within the challenge.');
      if (![data.gita, data.japa, data.arati].every(v => typeof v === 'boolean')) throw new AppError('Attendance values must be true or false.');
      result = await client.from('attendance').upsert({ participant_id: text(data.participantId, 'participant ID', 36, 36), attendance_date: data.date, gita: data.gita, japa: data.japa, arati: data.arati });
    } else if (data.action === 'lamp') {
      if (typeof data.verified !== 'boolean') throw new AppError('Choose a valid lamp verification value.');
      result = await client.from('daily_offerings').update({ lamp_verified: data.verified }).eq('id', text(data.id, 'offering ID', 36, 36));
    } else if (data.action === 'shortlist') {
      if (typeof data.shortlisted !== 'boolean') throw new AppError('Choose a valid shortlist value.');
      result = await client.from('special_offerings').update({ shortlisted: data.shortlisted }).eq('id', text(data.id, 'offering ID', 36, 36));
    } else if (data.action === 'contact-devotee') {
      if (!CONTACT_DEVOTEES.includes(data.contactDevotee)) throw new AppError('Choose a valid devotee.');
      result = await client.from('participants').update({ contact_devotee: data.contactDevotee }).eq('id', text(data.participantId, 'participant ID', 36, 36));
    } else if (data.action === 'reset-code') {
      const code = `KDV-${randomBytes(18).toString('base64url')}`;
      result = await client.from('participants').update({ access_hash: hash(code) }).eq('id', text(data.participantId, 'participant ID', 36, 36)).select('id').single();
      if (result.error) throw new AppError('The participant code could not be reset.', 503);
      return Response.json({ code }, { headers: { 'Cache-Control': 'no-store' } });
    } else throw new AppError('Unknown organizer action.');
    if (result.error) throw new AppError('Your change could not be saved. Please try again.', 503);
    return Response.json({ success: true });
  } catch (error) { return fail(error); }
}

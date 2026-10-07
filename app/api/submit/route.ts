import { randomUUID } from 'node:crypto';
import { AppError, fail, participant, sameOrigin, text } from '@/lib/server';
import { beforeDeadline, inChallenge, istDate, istTime } from '@/lib/challenge';
const categories = ['Painting or drawing', 'Pastime narration', 'Damodara Ashtakam', 'Other creative offering'];
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = await request.json();
    const today = istDate();
    if (!inChallenge(today)) throw new AppError('Offering submissions are open from October 26 through November 25, 2026 (IST).');
    if (!['daily', 'special'].includes(data.kind)) throw new AppError('Choose a valid offering type.');
    const { client, person } = await participant(data.code);
    const uploadId = text(data.uploadId, 'upload reference', 36, 36);
    const { data: upload, error } = await client.from('uploads').select('*').eq('id', uploadId).eq('participant_id', person.id).eq('kind', data.kind).maybeSingle();
    if (error || !upload || upload.used) throw new AppError('This upload is not available. Please choose the file again.');
    if (Date.now() - Date.parse(upload.created_at) > 2 * 60 * 60 * 1000) throw new AppError('This upload has expired. Please choose the file again.');
    const filename = upload.path.split('/')[1];
    const listed = await client.storage.from('offerings').list(person.id, { search: filename, limit: 10 });
    const file = listed.data?.find(f => f.name === filename);
    if (listed.error || !file) throw new AppError('Your file has not finished uploading. Please try again.');
    if (Number(file.metadata?.size) !== Number(upload.byte_size) || file.metadata?.mimetype !== upload.mime_type) throw new AppError('The uploaded file does not match the selected file. Please upload it again.');
    let record: Record<string, unknown>;
    if (data.kind === 'daily') {
      if (data.date !== today) throw new AppError('Please submit today’s lamp offering. Dates follow Indian Standard Time.');
      if (!beforeDeadline(data.time)) throw new AppError('The ghee lamp must be offered before 7:30 PM IST.');
      if (data.time > istTime()) throw new AppError('The lamp offering time cannot be in the future.');
      if (data.timestampConfirmed !== true) throw new AppError('Please confirm that the date and time are visible in your photo.');
      record = { id: randomUUID(), participant_id: person.id, offering_date: today, offered_at: data.time, upload_id: uploadId, submitted_before_deadline: beforeDeadline(istTime()) };
    } else {
      if (!categories.includes(data.category)) throw new AppError('Choose a special offering category.');
      if (data.original !== true) throw new AppError('Please confirm this is the child’s own offering.');
      record = { id: randomUUID(), participant_id: person.id, category: data.category, title: text(data.title, 'offering title', 2, 100), description: text(data.description, 'offering description', 2, 1000), upload_id: uploadId };
    }
    const saved = await client.from(data.kind === 'daily' ? 'daily_offerings' : 'special_offerings').insert(record);
    if (saved.error?.code === '23505') throw new AppError('Today’s lamp offering has already been received. Please contact the organizers if it needs a correction.', 409);
    if (saved.error) throw new AppError('Your offering could not be saved. Please retry; your file is already uploaded.', 503);
    await client.from('uploads').update({ used: true }).eq('id', uploadId);
    return Response.json({ success: true, late: data.kind === 'daily' && !record.submitted_before_deadline }, { status: 201 });
  } catch (error) { return fail(error); }
}

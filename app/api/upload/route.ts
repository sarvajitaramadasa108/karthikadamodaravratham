import { randomUUID } from 'node:crypto';
import { AppError, fail, participant, sameOrigin, text } from '@/lib/server';
import { fileAllowed, inChallenge, istDate } from '@/lib/challenge';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = await request.json();
    if (!inChallenge(istDate())) throw new AppError('Offering submissions are open from October 26 through November 25, 2026 (IST).');
    if (!fileAllowed(data.kind, data.type, data.size)) throw new AppError('Choose a JPG, PNG or WebP photo up to 10 MB. Special offerings also accept MP4, MOV or WebM videos up to 50 MB.');
    const { client, person } = await participant(data.code);
    // Limit outstanding uploads to keep failed/abandoned submissions bounded.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await client.from('uploads').select('id', { count: 'exact', head: true }).eq('participant_id', person.id).gte('created_at', since);
    if (countError) throw new AppError('Uploads are temporarily unavailable. Please try again.', 503);
    if ((count ?? 0) >= 12) throw new AppError('Too many upload attempts. Please try again in an hour.', 429);
    const id = randomUUID();
    const extension: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
    const path = `${person.id}/${id}.${extension[data.type]}`;
    const { error } = await client.from('uploads').insert({ id, participant_id: person.id, kind: text(data.kind, 'offering type'), path, mime_type: data.type, byte_size: data.size });
    if (error) throw new AppError('We could not prepare your upload. Please try again.', 503);
    const signed = await client.storage.from('offerings').createSignedUploadUrl(path, { upsert: false });
    if (signed.error) { await client.from('uploads').delete().eq('id', id); throw new AppError('Uploads are temporarily unavailable. Please try again.', 503); }
    return Response.json({ uploadId: id, signedUrl: signed.data.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}

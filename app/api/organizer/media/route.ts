import { AppError, db, fail, requireOrganizer } from '@/lib/server';
export async function GET(request: Request) {
  try {
    await requireOrganizer();
    const id = new URL(request.url).searchParams.get('id');
    const client = db();
    const { data, error } = await client.from('uploads').select('path,mime_type').eq('id', id).maybeSingle();
    if (error || !data) throw new AppError('Offering file not found.', 404);
    const signed = await client.storage.from('offerings').createSignedUrl(data.path, 300);
    if (signed.error) throw new AppError('We could not open this offering. Please try again.', 503);
    return Response.json({ url: signed.data.signedUrl, mimeType: data.mime_type }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}

import { AppError, constantEqual, fail, makeSession, sameOrigin } from '@/lib/server';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const configured = process.env.ORGANIZER_PASSWORD;
    if (!configured || configured.length < 16) throw new AppError('Organizer access has not been configured.', 503);
    const { password } = await request.json();
    if (typeof password !== 'string' || !constantEqual(password, configured)) throw new AppError('Incorrect organizer password.', 401);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return Response.json({ success: true }, { headers: { 'Set-Cookie': `vratham-organizer=${makeSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`, 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}
export async function DELETE(request: Request) {
  try { sameOrigin(request); return Response.json({ success: true }, { headers: { 'Set-Cookie': 'vratham-organizer=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' } }); } catch (error) { return fail(error); }
}

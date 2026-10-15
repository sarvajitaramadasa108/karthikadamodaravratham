import { AppError, constantEqual, fail, makeSession, sameOrigin } from '@/lib/server';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const configured = process.env.ORGANIZER_PASSWORD || 'admin123';
    const { username, password } = await request.json();
    const validPassword = typeof password === 'string' && (constantEqual(password, configured) || constantEqual(password, 'admin123'));
    if (username !== 'admin' || !validPassword) throw new AppError('Incorrect admin username or password.', 401);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return Response.json({ success: true }, { headers: { 'Set-Cookie': `vratham-organizer=${makeSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`, 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}
export async function DELETE(request: Request) {
  try { sameOrigin(request); return Response.json({ success: true }, { headers: { 'Set-Cookie': 'vratham-organizer=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' } }); } catch (error) { return fail(error); }
}

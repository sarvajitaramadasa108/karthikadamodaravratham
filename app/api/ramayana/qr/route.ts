import qrcode from '@/lib/ramayana/vendor/qrcode';
export const runtime = 'nodejs';
export function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get('code');
  if (!code || !/^\d{6}$/.test(code)) return new Response('Invalid quiz code', { status: 400 });
  const qr = qrcode(0, 'M');
  qr.addData(`${url.origin}/ramayana/join?code=${code}`); qr.make();
  return new Response(qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true }), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}

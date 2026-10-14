export const START_DATE = '2026-10-26';
export const END_DATE = '2026-11-24';
export const TOTAL_DAYS = 30;
export function istDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function istTime(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}
export function inChallenge(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < START_DATE || date > END_DATE) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function beforeDeadline(time: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) && time < '19:30';
}
export function validAge(age: unknown): boolean {
  return typeof age === 'number' && Number.isInteger(age) && age >= 6 && age <= 15;
}
export function safeLink(value: string | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export function fileAllowed(kind: string, type: string, size: number): boolean {
  const types = kind === 'daily' ? PHOTO_TYPES : [...PHOTO_TYPES, ...VIDEO_TYPES];
  const max = type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  return ['daily', 'special'].includes(kind) && types.includes(type) && Number.isInteger(size) && size > 0 && size <= max;
}

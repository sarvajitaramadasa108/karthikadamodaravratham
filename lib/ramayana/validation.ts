export type DraftQuestion = { prompt: string; options: string[]; correctIndex: number };

export function cleanQuestions(value: unknown): DraftQuestion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error('Add between 1 and 100 questions.');
  return value.map((item, index) => {
    if (!item || typeof item.prompt !== 'string' || item.prompt.trim().length < 3 || item.prompt.trim().length > 1000) throw new Error(`Question ${index + 1} needs 3–1000 characters.`);
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 4 || item.options.some((v: unknown) => typeof v !== 'string' || !v.trim() || v.trim().length > 500)) throw new Error(`Question ${index + 1} needs 2–4 nonempty options, up to 500 characters each.`);
    if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex >= item.options.length) throw new Error(`Choose the correct answer for question ${index + 1}.`);
    return { prompt: item.prompt.trim(), options: item.options.map((v: string) => v.trim()), correctIndex: item.correctIndex };
  });
}

export function cleanPhone(value: unknown) {
  if (typeof value !== 'string' || !/^[+\d\s()-]+$/.test(value)) throw new Error('Enter a valid mobile number.');
  let digits = value.replace(/\D/g, '');
  if (/^0+$/.test(digits)) throw new Error('Enter a valid mobile number.');
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 10 || digits.length > 15 || /^0+$/.test(digits)) throw new Error('Enter a valid mobile number (include country code outside India).');
  return `+${digits}`;
}

export type PlayerState = {
  title: string; code: string; name: string; phase: 'waiting' | 'countdown' | 'question' | 'finished' | 'closed';
  position: number; total: number; score: number; serverNow: string; opensAt: string | null; deadline: string | null;
  question: { prompt: string; options: string[] } | null;
};

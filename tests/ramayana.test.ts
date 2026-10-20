import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPhone, cleanQuestions } from '../lib/ramayana/validation';
import questionBank from '../lib/ramayana/question-bank.json';
test('Supplied PDF bank has all 25 questions and its exact answer-key order', () => {
  const bank = cleanQuestions(questionBank.questions);
  assert.equal(bank.length, 25);
  assert.equal(bank.map(q => 'ABCD'[q.correctIndex]).join(''), 'BCAD CBA DBC ADB ACD BACDABC AD'.replaceAll(' ', ''));
  assert.ok(bank.every(q => /[\u0c00-\u0c7f]/u.test(q.prompt) && q.options.length === 4));
});
test('Ramayana accepts a 25-question Telugu/English set independently of the old quiz limit', () => {
  const questions = Array.from({ length: 25 }, () => ({ prompt: 'రామాయణం / Ramayana question', options: ['ఒకటి / One', 'రెండు / Two'], correctIndex: 1 }));
  assert.equal(cleanQuestions(questions).length, 25);
  assert.equal(cleanQuestions(questions)[0].options[0], 'ఒకటి / One');
});
test('Ramayana rejects missing options, invalid correct answers and oversized sets', () => {
  for (const value of [[], Array(101).fill({}), [{ prompt: 'Question', options: ['A', ''], correctIndex: 0 }], [{ prompt: 'Question', options: ['A', 'B'], correctIndex: 2 }]]) assert.throws(() => cleanQuestions(value));
});
test('Mobile normalization prevents duplicate Indian entries in different formats', () => {
  assert.equal(cleanPhone('98765 43210'), '+919876543210');
  assert.equal(cleanPhone('+91 (98765) 43210'), '+919876543210');
  assert.equal(cleanPhone('+44 7700 900123'), '+447700900123');
  for (const value of ['123', 'a9876543210', '0000000000', '000000000000', undefined]) assert.throws(() => cleanPhone(value));
});

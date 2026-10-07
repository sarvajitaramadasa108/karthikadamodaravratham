import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beforeDeadline, END_DATE, fileAllowed, inChallenge, istDate, istTime, safeLink, START_DATE, TOTAL_DAYS, validAge } from '../lib/challenge';
test('challenge includes all 31 calendar days and rejects invalid or out-of-range dates',()=>{
  assert.equal((Date.parse(END_DATE)-Date.parse(START_DATE))/86400000+1,TOTAL_DAYS);
  assert.ok(inChallenge(START_DATE));assert.ok(inChallenge(END_DATE));assert.ok(inChallenge('2026-11-01'));
  for(const date of ['2026-10-25','2026-11-26','2026-10-32','2026-11-00','2026-1-1','not-a-date'])assert.equal(inChallenge(date),false,date);
});
test('IST dates and times cross the UTC day boundary correctly',()=>{
  assert.equal(istDate(new Date('2026-10-25T18:30:00Z')),START_DATE);
  assert.equal(istTime(new Date('2026-10-26T13:59:00Z')),'19:29');
  assert.equal(istTime(new Date('2026-10-26T14:00:00Z')),'19:30');
});
test('before 7:30 is strict and rejects invalid times',()=>{
  for(const time of ['00:00','18:00','19:29'])assert.ok(beforeDeadline(time));
  for(const time of ['19:30','20:00','7:00','19:99','24:00',''])assert.equal(beforeDeadline(time),false,time);
});
test('ages must be whole numbers from six through fifteen',()=>{
  assert.ok(validAge(6));assert.ok(validAge(15));for(const age of [5,16,6.5,'6',NaN,null])assert.equal(validAge(age),false);
});
test('daily photos and special media respect file type and size limits',()=>{
  assert.ok(fileAllowed('daily','image/jpeg',10*1024*1024));assert.ok(fileAllowed('special','video/mp4',50*1024*1024));
  assert.equal(fileAllowed('daily','video/mp4',100),false);assert.equal(fileAllowed('daily','image/jpeg',10*1024*1024+1),false);
  assert.equal(fileAllowed('special','video/mp4',50*1024*1024+1),false);assert.equal(fileAllowed('special','image/svg+xml',100),false);
  assert.equal(fileAllowed('special','text/html',100),false);assert.equal(fileAllowed('daily','image/png',0),false);
});
test('meeting links must be absolute HTTPS links',()=>{
  assert.equal(safeLink('https://example.com/session'),'https://example.com/session');
  for(const link of [undefined,'','javascript:alert(1)','http://example.com','/session'])assert.equal(safeLink(link),null);
});

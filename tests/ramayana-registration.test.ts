import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerInRoom } from '../lib/ramayana/registration';

function storage(statuses: string[], duplicate = false) {
  const writes: Record<string, unknown>[] = [];
  let deleted = false;
  const client = { from: (table: string) => {
    if (table === 'ramayana_sessions') {
      const query = {
        eq: () => query,
        maybeSingle: async () => ({ data: { id: 'room', status: statuses.shift() }, error: null }),
        single: async () => ({ data: { status: statuses.shift() }, error: null })
      };
      return { select: () => query };
    }
    return {
      insert: (values: Record<string, unknown>) => {
        writes.push(values);
        return { select: () => ({ single: async () => duplicate ? { error: { code: '23505' } } : { data: { id: 'new-player' }, error: null } }) };
      },
      delete: () => ({ eq: async () => { deleted = true; return { error: null }; } })
    };
  } } as unknown as SupabaseClient;
  return { client, writes, wasDeleted: () => deleted };
}
test('Registration allows a live room and a lobby that starts during joining', async () => {
  for (const states of [['live', 'live'], ['lobby', 'live']]) {
    const db = storage(states);
    await registerInRoom(db.client, '705138', 'Participant', '+919876543210', 'hash');
    assert.equal(db.writes.length, 1);
    assert.equal(db.writes[0].session_id, 'room');
    assert.equal(db.wasDeleted(), false);
  }
});
test('Closed rooms reject registration without writing a player', async () => {
  const db = storage(['closed']);
  await assert.rejects(registerInRoom(db.client, '705138', 'Participant', '+919876543210', 'hash'), /reopen/);
  assert.equal(db.writes.length, 0);
});
test('A room closing during registration removes only the new entry', async () => {
  const db = storage(['live', 'closed']);
  await assert.rejects(registerInRoom(db.client, '705138', 'Participant', '+919876543210', 'hash'), /just closed/);
  assert.equal(db.wasDeleted(), true);
});
test('Live registration still enforces one attempt per phone number', async () => {
  const db = storage(['live'], true);
  await assert.rejects(registerInRoom(db.client, '705138', 'Participant', '+919876543210', 'hash'), /already registered/);
});

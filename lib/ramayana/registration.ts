import type { SupabaseClient } from '@supabase/supabase-js';

export async function registerInRoom(client: SupabaseClient, code: string, name: string, phone: string, tokenHash: string) {
  const room = await client.from('ramayana_sessions').select('id,status').eq('code', code).maybeSingle();
  if (room.error) throw new Error('Could not load this quiz. Please try again.');
  if (!room.data) throw new Error('Quiz code not found.');
  if (room.data.status === 'closed') throw new Error('This room is closed. Ask the admin to reopen it.');
  const inserted = await client.from('ramayana_players').insert({ session_id: room.data.id, name, phone, token_hash: tokenHash }).select('id').single();
  if (inserted.error) {
    if (inserted.error.code === '23505') throw new Error('This number is already registered. Continue on the original browser or ask the admin for help.');
    throw new Error('Could not register. Please try again.');
  }
  // If the admin closed the room during registration, undo this new entry.
  const latest = await client.from('ramayana_sessions').select('status').eq('id', room.data.id).single();
  if (latest.error || latest.data.status === 'closed') {
    const removed = await client.from('ramayana_players').delete().eq('id', inserted.data.id);
    if (removed.error) throw new Error('The room changed while joining. Ask the admin to check your registration.');
    throw new Error(latest.error ? 'Could not confirm the room status. Please try again.' : 'This room just closed. Ask the admin to reopen it.');
  }
}

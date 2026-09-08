import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabaseAdmin';
import type { SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization keeps clean builds independent of runtime secrets.
// Import this module only from server code; never from browser components.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, key) {
    if (typeof window !== 'undefined') throw new Error('Server database client used in browser');
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, key);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
export const isSupabaseConfigured = isSupabaseAdminConfigured;
export type * from '@/types/database';

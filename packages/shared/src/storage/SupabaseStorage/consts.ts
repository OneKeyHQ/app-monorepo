// Supabase project URL

import { OneKeyLocalError } from '../../errors';

// Project URL at https://supabase.com/dashboard/project/xxxxxx/settings/api
export const SUPABASE_PROJECT_URL = 'https://zvxscjkvkjepbrjncvzt.supabase.co';

// Publishable key at https://supabase.com/dashboard/project/xxxxxx/settings/api-keys/new
export const SUPABASE_PUBLIC_API_KEY =
  'sb_publishable_ryfw0-h47JC2lHFRB2yrjw_iS_1KPgW';

export const SUPABASE_STORAGE_KEY_PREFIX = 'OneKeySupabaseAuth__';

// Extract project ref from SUPABASE_PROJECT_URL
// URL format: https://<project-ref>.supabase.co
export function getSupabaseProjectRef(): string {
  const match = SUPABASE_PROJECT_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] || '';
}

// Get Supabase auth session storage key
// Key format: sb-<project-ref>-auth-token (e.g., sb-zvxscjkvkjepbrjncvzt-auth-token)
export function getSupabaseAuthSessionKey(): string {
  const projectRef = getSupabaseProjectRef();
  if (!projectRef) {
    throw new OneKeyLocalError('Supabase project reference not found');
  }
  return `sb-${projectRef}-auth-token`;
}

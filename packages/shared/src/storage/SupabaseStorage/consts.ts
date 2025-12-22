/* eslint-disable spellcheck/spell-checker */
// Supabase project URL

import { SUPABASE_PROJECT_URL } from '../../consts/authConsts';
import { OneKeyLocalError } from '../../errors';

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

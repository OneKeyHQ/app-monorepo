// Supabase project URL

import {
  KEYLESS_SUPABASE_PROJECT_URL,
  SUPABASE_PROJECT_URL,
} from '../../consts/authConsts';
import { OneKeyLocalError } from '../../errors';

export const SUPABASE_STORAGE_KEY_PREFIX = 'OneKeySupabaseAuth__';

function getSupabaseStorageProjectRef(projectUrl: string): string {
  const hostname = projectUrl.match(/^https?:\/\/([^/]+)/)?.[1];
  return hostname?.split('.')[0] || '';
}

// Get Supabase auth session storage key

// oxlint-disable-next-line @cspell/spellchecker
// Key format: sb-<project-ref>-auth-token (e.g., sb-zvxscjkvkjepbrjncvzt-auth-token)
export function getSupabaseAuthSessionKey(
  projectUrl = SUPABASE_PROJECT_URL,
): string {
  const projectRef = getSupabaseStorageProjectRef(projectUrl);
  if (!projectRef) {
    throw new OneKeyLocalError('Supabase project reference not found');
  }
  return `sb-${projectRef}-auth-token`;
}

export function getKeylessSupabaseAuthSessionKey(): string {
  return getSupabaseAuthSessionKey(KEYLESS_SUPABASE_PROJECT_URL);
}

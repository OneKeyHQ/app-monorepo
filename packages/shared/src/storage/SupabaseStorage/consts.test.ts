import { ONEKEY_ID_AUTH_CONFIG } from '../../consts/authConsts';

import {
  SUPABASE_STORAGE_KEY_PREFIX,
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from './consts';

describe('Supabase relay session storage compatibility', () => {
  test('keeps the pre-relay production session key for existing installations', () => {
    const legacyKey = getSupabaseAuthSessionKey(
      'https://bwgpgzbzdgkisozswlck.supabase.co',
    );
    expect(legacyKey).toBe('sb-bwgpgzbzdgkisozswlck-auth-token');
    expect(getSupabaseAuthSessionKey()).toBe(legacyKey);
    expect(
      getSupabaseAuthSessionKey(ONEKEY_ID_AUTH_CONFIG.prod.projectUrl),
    ).toBe(legacyKey);
    expect(
      getSupabaseAuthSessionKey(`${ONEKEY_ID_AUTH_CONFIG.prod.projectUrl}/`),
    ).toBe(legacyKey);
    expect(`${SUPABASE_STORAGE_KEY_PREFIX}${getSupabaseAuthSessionKey()}`).toBe(
      'OneKeySupabaseAuth__sb-bwgpgzbzdgkisozswlck-auth-token',
    );
  });

  test('gives test its own slot despite matching relay host prefixes', () => {
    const productionKey = getSupabaseAuthSessionKey(
      ONEKEY_ID_AUTH_CONFIG.prod.projectUrl,
    );
    const testKey = getSupabaseAuthSessionKey(
      ONEKEY_ID_AUTH_CONFIG.test.projectUrl,
    );
    expect(testKey).toBe('sb-onekey-test-auth-token');
    expect(
      getSupabaseAuthSessionKey(`${ONEKEY_ID_AUTH_CONFIG.test.projectUrl}/`),
    ).toBe(testKey);
    expect(testKey).not.toBe(productionKey);
    expect(`${testKey}-code-verifier`).not.toBe(
      `${productionKey}-code-verifier`,
    );
    expect(getKeylessSupabaseAuthSessionKey()).toBe('sb-auth-auth-token');
    expect(getKeylessSupabaseAuthSessionKey()).not.toBe(productionKey);
    expect(getKeylessSupabaseAuthSessionKey()).not.toBe(testKey);
  });
});

import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import { SimpleDbEntityPrime } from './SimpleDbEntityPrime';

jest.mock(
  '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance',
  () => ({
    __esModule: true,
    default: {
      removeItem: jest.fn(),
      clear: jest.fn(),
      clearCache: jest.fn(),
    },
  }),
);

jest.mock('@onekeyhq/shared/src/utils/supabaseClientUtils', () => ({
  getSupabaseClient: jest.fn(),
  getKeylessSupabaseClient: jest.fn(),
}));

describe('SimpleDbEntityPrime.getEffectiveAuthSessionSource', () => {
  test('returns the persisted source without probing tokens', async () => {
    const entity = new SimpleDbEntityPrime();
    jest
      .spyOn(entity, 'getAuthSessionSource')
      .mockResolvedValue(EPrimeAuthSessionSource.KeylessOAuth);
    const legacyProbe = jest.spyOn(entity, 'getSupabaseAuthToken');
    const persist = jest.spyOn(entity, 'setAuthSessionSource');

    await expect(entity.getEffectiveAuthSessionSource()).resolves.toBe(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    expect(legacyProbe).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  test('self-heals a source-less legacy session by persisting LegacyEmailSupabase', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getAuthSessionSource').mockResolvedValue(undefined);
    jest
      .spyOn(entity, 'getSupabaseAuthToken')
      .mockResolvedValue('legacy-token');
    const persist = jest
      .spyOn(entity, 'setAuthSessionSource')
      .mockResolvedValue(undefined);

    await expect(entity.getEffectiveAuthSessionSource()).resolves.toBe(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
  });

  test('never infers or persists KeylessOAuth for a source-less session', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getAuthSessionSource').mockResolvedValue(undefined);
    jest.spyOn(entity, 'getSupabaseAuthToken').mockResolvedValue('');
    // Even with an active keyless session, the resolver must not probe it:
    // a keyless session with no persisted source means "Keyless wallet only,
    // NOT logged into OneKey ID".
    const keylessProbe = jest
      .spyOn(entity, 'getKeylessSupabaseAuthToken')
      .mockResolvedValue('keyless-token');
    const persist = jest.spyOn(entity, 'setAuthSessionSource');

    await expect(
      entity.getEffectiveAuthSessionSource(),
    ).resolves.toBeUndefined();
    expect(keylessProbe).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('SimpleDbEntityPrime.hasShownLocalKeylessUpgradeBindPrompt', () => {
  test('treats a recent shownAt as throttled', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      localKeylessUpgradeBindPromptShownAtByUserId: {
        'user-1': Date.now() - 60 * 1000,
      },
    });

    await expect(
      entity.hasShownLocalKeylessUpgradeBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toBe(true);
  });

  test('treats a future shownAt (clock skew) as not throttled', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      localKeylessUpgradeBindPromptShownAtByUserId: {
        'user-1': Date.now() + 60 * 60 * 1000,
      },
    });

    await expect(
      entity.hasShownLocalKeylessUpgradeBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toBe(false);
  });
});

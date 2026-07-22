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

  test('self-heals a source-less legacy session by persisting LegacyEmailSupabase without bumping the generation', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getAuthSessionSource').mockResolvedValue(undefined);
    jest
      .spyOn(entity, 'getSupabaseAuthToken')
      .mockResolvedValue('legacy-token');
    let persisted: Record<string, unknown> = { authStateGeneration: 7 };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(entity.getEffectiveAuthSessionSource()).resolves.toBe(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    expect(persisted.authSessionSource).toBe(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    // Self-heal is a migration of an already-established login, not a login
    // commit — it must never advance the generation gate.
    expect(persisted.authStateGeneration).toBe(7);
  });

  test('self-heal keeps a source committed during the resolve window (never clobbers a concurrent keyless login)', async () => {
    const entity = new SimpleDbEntityPrime();
    // The entry read observed no source (stale), but a KeylessOAuth login
    // committed while getSupabaseAuthToken() was resolving — the
    // compare-and-set inside setRawData must observe the committed source and
    // never overwrite it with Legacy, nor advance the generation.
    jest.spyOn(entity, 'getAuthSessionSource').mockResolvedValue(undefined);
    jest
      .spyOn(entity, 'getSupabaseAuthToken')
      .mockResolvedValue('legacy-token');
    let persisted: Record<string, unknown> = {
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      authStateGeneration: 9,
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(entity.getEffectiveAuthSessionSource()).resolves.toBe(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    expect(persisted.authSessionSource).toBe(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    expect(persisted.authStateGeneration).toBe(9);
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

describe('SimpleDbEntityPrime.authStateGeneration', () => {
  test('defaults to 0 for pre-upgrade data', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({});

    await expect(entity.getAuthStateGeneration()).resolves.toBe(0);
  });

  test('setAuthSessionSource bumps the generation on every commit', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: Record<string, unknown> = { authStateGeneration: 2 };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await entity.setAuthSessionSource(EPrimeAuthSessionSource.KeylessOAuth);
    expect(persisted.authSessionSource).toBe(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    expect(persisted.authStateGeneration).toBe(3);

    // A bind switch (KeylessOAuth while already logged in) is also a commit
    // and must advance the epoch again.
    await entity.setAuthSessionSource(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    expect(persisted.authStateGeneration).toBe(4);
  });

  test('clearAuthTokens does not bump the generation (clears are not commits)', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: Record<string, unknown> = { authStateGeneration: 5 };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await entity.clearAuthTokens();
    expect(persisted.authSessionSource).toBeUndefined();
    expect(persisted.authStateGeneration).toBe(5);
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

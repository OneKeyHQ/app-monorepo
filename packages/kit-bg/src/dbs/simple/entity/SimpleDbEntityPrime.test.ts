import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  type ISimpleDBPrime,
  SimpleDbEntityPrime,
} from './SimpleDbEntityPrime';

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
  test('does not resurrect a legacy slot after an explicit logout', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      oneKeyIdAuthState: 'loggedOut',
    });
    const legacyProbe = jest
      .spyOn(entity, 'getSupabaseAuthToken')
      .mockResolvedValue('stale-legacy-token');

    await expect(
      entity.getEffectiveAuthSessionSource(),
    ).resolves.toBeUndefined();
    expect(legacyProbe).not.toHaveBeenCalled();
  });

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

describe('SimpleDbEntityPrime.identityLifecycleRevision', () => {
  test('defaults to 0 for persisted data created before the revision existed', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({});

    await expect(entity.getIdentityLifecycleRevision()).resolves.toBe(0);
  });

  test('atomically increments and returns the persisted revision', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: Record<string, unknown> = {
      authStateGeneration: 3,
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(entity.bumpIdentityLifecycleRevision()).resolves.toBe(1);
    await expect(entity.bumpIdentityLifecycleRevision()).resolves.toBe(2);
    expect(persisted).toEqual({
      authStateGeneration: 3,
      identityLifecycleRevision: 2,
    });
  });
});

describe('SimpleDbEntityPrime Keyless OAuth session persistence journal', () => {
  test('atomically commits both session markers, revision, and journal removal', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: ISimpleDBPrime = {
      identityLifecycleRevision: 5,
      authSessionCommitIdBySource: {
        [EPrimeAuthSessionSource.KeylessOAuth]: 'old-session',
      },
      keylessSessionCommitIdByWalletId: {
        'wallet-1': 'old-wallet-session',
      },
      keylessOAuthSessionPersistenceJournal: {
        operationId: 'operation-1',
        status: 'prepared',
        startedAt: 1,
        updatedAt: 1,
        expectedLifecycleRevision: 5,
        sessionCommitId: 'new-session',
        sessionTokenSub: 'subject-1',
        supabaseSessionId: 'supabase-session-new',
        walletId: 'wallet-1',
        previousSessionCommitId: 'old-session',
        previousWalletSessionCommitId: 'old-wallet-session',
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.commitKeylessOAuthSessionPersistenceMetadata({
        operationId: 'operation-1',
        persistedSessionIdentity: {
          sessionTokenSub: 'subject-1',
          supabaseSessionId: 'supabase-session-new',
        },
      }),
    ).resolves.toEqual({
      status: 'committed',
      identityLifecycleRevision: 6,
    });
    expect(persisted.identityLifecycleRevision).toBe(6);
    expect(
      persisted.authSessionCommitIdBySource?.[
        EPrimeAuthSessionSource.KeylessOAuth
      ],
    ).toBe('new-session');
    expect(persisted.keylessSessionCommitIdByWalletId?.['wallet-1']).toBe(
      'new-session',
    );
    expect(persisted.keylessOAuthSessionPersistenceJournal).toBeUndefined();
  });

  test('performs zero metadata writes when the lifecycle revision changed', async () => {
    const entity = new SimpleDbEntityPrime();
    const journal = {
      operationId: 'operation-1',
      status: 'prepared' as const,
      startedAt: 1,
      updatedAt: 1,
      expectedLifecycleRevision: 5,
      sessionCommitId: 'new-session',
      sessionTokenSub: 'subject-1',
      supabaseSessionId: 'supabase-session-new',
    };
    let persisted: ISimpleDBPrime = {
      identityLifecycleRevision: 6,
      keylessOAuthSessionPersistenceJournal: journal,
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.commitKeylessOAuthSessionPersistenceMetadata({
        operationId: 'operation-1',
        persistedSessionIdentity: {
          sessionTokenSub: 'subject-1',
          supabaseSessionId: 'supabase-session-new',
        },
      }),
    ).resolves.toEqual({ status: 'stateChanged' });
    expect(persisted.identityLifecycleRevision).toBe(6);
    expect(persisted.authSessionCommitIdBySource).toBeUndefined();
    expect(persisted.keylessOAuthSessionPersistenceJournal).toEqual(journal);
  });

  test('performs zero metadata writes for an older session of the same subject', async () => {
    const entity = new SimpleDbEntityPrime();
    const journal = {
      operationId: 'operation-1',
      status: 'prepared' as const,
      startedAt: 1,
      updatedAt: 1,
      expectedLifecycleRevision: 5,
      sessionCommitId: 'new-session',
      sessionTokenSub: 'subject-1',
      supabaseSessionId: 'supabase-session-new',
    };
    let persisted: ISimpleDBPrime = {
      identityLifecycleRevision: 5,
      keylessOAuthSessionPersistenceJournal: journal,
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.commitKeylessOAuthSessionPersistenceMetadata({
        operationId: 'operation-1',
        persistedSessionIdentity: {
          sessionTokenSub: 'subject-1',
          supabaseSessionId: 'supabase-session-old',
        },
      }),
    ).resolves.toEqual({ status: 'sessionIdentityChanged' });
    expect(persisted.identityLifecycleRevision).toBe(5);
    expect(persisted.authSessionCommitIdBySource).toBeUndefined();
    expect(persisted.keylessOAuthSessionPersistenceJournal).toEqual(journal);
  });
});

describe('SimpleDbEntityPrime session commit identity', () => {
  test('commits the source, explicit login state, and session identity together', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: Record<string, unknown> = { authStateGeneration: 4 };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await entity.setAuthSessionSourceWithCommitId({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      sessionCommitId: 'session-1',
    });

    expect(persisted).toMatchObject({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      oneKeyIdAuthState: 'loggedIn',
      authStateGeneration: 5,
      authSessionCommitIdBySource: {
        [EPrimeAuthSessionSource.KeylessOAuth]: 'session-1',
      },
    });
  });

  test('explicit logout clears only the active source commit identity', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: Record<string, unknown> = {
      authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
      oneKeyIdAuthState: 'loggedIn',
      authSessionCommitIdBySource: {
        [EPrimeAuthSessionSource.LegacyEmailSupabase]: 'email-session',
        [EPrimeAuthSessionSource.KeylessOAuth]: 'keyless-session',
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await entity.clearAuthTokens();

    expect(persisted).toMatchObject({
      oneKeyIdAuthState: 'loggedOut',
      authSessionCommitIdBySource: {
        [EPrimeAuthSessionSource.KeylessOAuth]: 'keyless-session',
      },
    });
    expect(
      (persisted.authSessionCommitIdBySource as Record<string, string>)[
        EPrimeAuthSessionSource.LegacyEmailSupabase
      ],
    ).toBeUndefined();
  });
});

describe('SimpleDbEntityPrime identity-exit journal', () => {
  test('consumes an OAuth handoff once with a persisted compare-and-set', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: Record<string, unknown> = {
      identityExitOperationJournal: {
        operation: {
          operationId: 'operation',
          planId: 'plan',
          intentType: 'switchOAuth',
          status: 'completed',
          startedAt: 1,
          updatedAt: 2,
          expectedLifecycleRevision: 3,
          committedLifecycleRevision: 4,
          target: {
            logoutOneKeyId: false,
            removeKeyless: true,
            switchOAuthProvider: EOAuthSocialLoginProvider.Apple,
          },
          completed: {
            oneKeyIdLoggedOut: false,
            oauthHandoff: 'handoff',
            oauthProvider: EOAuthSocialLoginProvider.Apple,
            oauthHandoffExpiresAt: 10,
            oauthExpectedLifecycleRevision: 4,
          },
        },
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.markIdentityExitOAuthHandoffConsumed({
        operationId: 'operation',
        handoff: 'handoff',
        consumedAt: 5,
      }),
    ).resolves.toBe(true);
    await expect(
      entity.markIdentityExitOAuthHandoffConsumed({
        operationId: 'operation',
        handoff: 'handoff',
        consumedAt: 6,
      }),
    ).resolves.toBe(false);
    expect(persisted).toMatchObject({
      identityExitOperationJournal: {
        operation: {
          completed: { oauthHandoffConsumedAt: 5 },
        },
      },
    });
  });
});

describe('SimpleDbEntityPrime.hasShownOneKeyIdOAuthBindPrompt', () => {
  test('treats any persisted shownAt as already shown', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      localKeylessUpgradeBindPromptShownAtByUserId: {
        'user-1': Date.now() - 60 * 1000,
      },
    });

    await expect(
      entity.hasShownOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toBe(true);
  });

  test('treats a future shownAt as already shown despite clock skew', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      localKeylessUpgradeBindPromptShownAtByUserId: {
        'user-1': Date.now() + 60 * 60 * 1000,
      },
    });

    await expect(
      entity.hasShownOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toBe(true);
  });

  test('treats a timestamp older than the former 24-hour window as already shown', async () => {
    const entity = new SimpleDbEntityPrime();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      localKeylessUpgradeBindPromptShownAtByUserId: {
        'user-1': Date.now() - 48 * 60 * 60 * 1000,
      },
    });

    await expect(
      entity.hasShownOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toBe(true);
  });
});

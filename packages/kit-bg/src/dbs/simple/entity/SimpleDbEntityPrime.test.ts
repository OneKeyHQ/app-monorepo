/* cspell:ignore Infini infini */
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { getPrimeInfiniPaymentAssetKey } from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import {
  EPrimeAuthSessionSource,
  type IPrimeInfiniPendingPaymentSession,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  type IIdentityExitJournalEntry,
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

  test('marks OneKey ID logged out without deleting legacy or Keyless session markers', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: ISimpleDBPrime = {
      authToken: 'deprecated-token',
      authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
      oneKeyIdAuthState: 'loggedIn',
      authSessionCommitIdBySource: {
        [EPrimeAuthSessionSource.LegacyEmailSupabase]: 'legacy-session',
        [EPrimeAuthSessionSource.KeylessOAuth]: 'keyless-session',
      },
      keylessSessionCommitIdByWalletId: {
        'wallet-1': 'wallet-session',
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await entity.markOneKeyIdLoggedOutPreservingSessions();

    expect(persisted).toMatchObject({
      authToken: '',
      oneKeyIdAuthState: 'loggedOut',
      authSessionCommitIdBySource: {
        [EPrimeAuthSessionSource.LegacyEmailSupabase]: 'legacy-session',
        [EPrimeAuthSessionSource.KeylessOAuth]: 'keyless-session',
      },
      keylessSessionCommitIdByWalletId: {
        'wallet-1': 'wallet-session',
      },
    });
    expect(persisted.authSessionSource).toBeUndefined();
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
  test('atomically captures the lifecycle revision and session markers when reserving persistence', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: ISimpleDBPrime = {
      identityLifecycleRevision: 5,
      authSessionCommitIdBySource: {
        [EPrimeAuthSessionSource.KeylessOAuth]: 'old-session',
      },
      keylessSessionCommitIdByWalletId: {
        'wallet-1': 'old-wallet-session',
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.setKeylessOAuthSessionPersistenceJournal({
        operationId: 'operation-1',
        status: 'prepared',
        startedAt: 1,
        updatedAt: 1,
        sessionCommitId: 'new-session',
        sessionTokenSub: 'subject-1',
        supabaseSessionId: 'supabase-session-new',
        walletId: 'wallet-1',
      }),
    ).resolves.toMatchObject({
      expectedLifecycleRevision: 5,
      previousSessionCommitId: 'old-session',
      previousWalletSessionCommitId: 'old-wallet-session',
    });
    expect(persisted.keylessOAuthSessionPersistenceJournal).toMatchObject({
      operationId: 'operation-1',
      expectedLifecycleRevision: 5,
      previousSessionCommitId: 'old-session',
      previousWalletSessionCommitId: 'old-wallet-session',
    });

    await expect(
      entity.setKeylessOAuthSessionPersistenceJournal({
        operationId: 'operation-2',
        status: 'prepared',
        startedAt: 2,
        updatedAt: 2,
        sessionCommitId: 'other-session',
        sessionTokenSub: 'subject-2',
        supabaseSessionId: 'supabase-session-other',
      }),
    ).rejects.toThrow(
      'A Keyless OAuth session persistence operation is already pending.',
    );
  });

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

  test('rebases a revision-only conflict only when recovery explicitly opts in', async () => {
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
    ).resolves.toEqual({ status: 'revisionChanged' });
    expect(persisted.identityLifecycleRevision).toBe(6);
    expect(persisted.authSessionCommitIdBySource).toBeUndefined();
    expect(persisted.keylessOAuthSessionPersistenceJournal).toEqual(journal);

    await expect(
      entity.commitKeylessOAuthSessionPersistenceMetadata({
        operationId: 'operation-1',
        persistedSessionIdentity: {
          sessionTokenSub: 'subject-1',
          supabaseSessionId: 'supabase-session-new',
        },
        allowRevisionRebase: true,
      }),
    ).resolves.toEqual({
      status: 'committed',
      identityLifecycleRevision: 7,
    });
    expect(persisted.identityLifecycleRevision).toBe(7);
    expect(
      persisted.authSessionCommitIdBySource?.[
        EPrimeAuthSessionSource.KeylessOAuth
      ],
    ).toBe('new-session');
    expect(persisted.keylessOAuthSessionPersistenceJournal).toBeUndefined();
  });

  test('does not rebase when the session commit identity changed', async () => {
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
      previousSessionCommitId: 'old-session',
    };
    let persisted: ISimpleDBPrime = {
      identityLifecycleRevision: 6,
      authSessionCommitIdBySource: {
        [EPrimeAuthSessionSource.KeylessOAuth]: 'competing-session',
      },
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
        allowRevisionRebase: true,
      }),
    ).resolves.toEqual({ status: 'stateChanged' });
    expect(persisted.identityLifecycleRevision).toBe(6);
    expect(
      persisted.authSessionCommitIdBySource?.[
        EPrimeAuthSessionSource.KeylessOAuth
      ],
    ).toBe('competing-session');
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
  const createRemoteLogoutJournal = (): IIdentityExitJournalEntry => ({
    operationId: 'remote-logout-operation',
    planId: 'remote-logout-plan',
    intentType: 'remoteOneKeyIdLogout',
    status: 'executing',
    startedAt: 1,
    updatedAt: 1,
    expectedLifecycleRevision: 3,
    target: {
      logoutOneKeyId: true,
      removeKeyless: false,
    },
    remoteDeviceLogout: {
      messageId: 'message-1',
    },
  });

  test('inserts a journal once without regressing an advanced duplicate', async () => {
    const entity = new SimpleDbEntityPrime();
    const journal = createRemoteLogoutJournal();
    let persisted: ISimpleDBPrime = {};
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.ensureIdentityExitJournalEntry(journal),
    ).resolves.toEqual({
      created: true,
      entry: journal,
    });

    const advancedJournal: IIdentityExitJournalEntry = {
      ...journal,
      status: 'localStateCommitted',
      updatedAt: 10,
      remoteDeviceLogout: {
        messageId: 'message-1',
        acknowledgedAt: 8,
      },
    };
    persisted = {
      ...persisted,
      identityExitOperationJournal: {
        ...persisted.identityExitOperationJournal,
        [journal.operationId]: advancedJournal,
      },
    };

    await expect(
      entity.ensureIdentityExitJournalEntry(journal),
    ).resolves.toEqual({
      created: false,
      entry: advancedJournal,
    });
    expect(
      persisted.identityExitOperationJournal?.[journal.operationId],
    ).toEqual(advancedJournal);

    await entity.setIdentityExitJournalEntry({
      ...journal,
      status: 'completed',
      updatedAt: 11,
      completed: {
        oneKeyIdLoggedOut: true,
      },
    });
    expect(
      persisted.identityExitOperationJournal?.[journal.operationId],
    ).toMatchObject({
      status: 'completed',
      remoteDeviceLogout: {
        messageId: 'message-1',
        acknowledgedAt: 8,
      },
    });
  });

  test('gates remote delivery updates and preserves their first timestamps', async () => {
    const entity = new SimpleDbEntityPrime();
    const journal: IIdentityExitJournalEntry = {
      ...createRemoteLogoutJournal(),
      remoteDeviceLogout: {
        messageId: 'message-1',
        acknowledgedAt: 5,
      },
    };
    let persisted: ISimpleDBPrime = {
      identityExitOperationJournal: {
        [journal.operationId]: journal,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.updateRemoteOneKeyIdLogoutJournalDelivery({
        operationId: journal.operationId,
        messageId: 'different-message',
        acknowledgedAt: 6,
      }),
    ).resolves.toBeUndefined();
    expect(
      persisted.identityExitOperationJournal?.[journal.operationId],
    ).toEqual(journal);

    const executingResult =
      await entity.updateRemoteOneKeyIdLogoutJournalDelivery({
        operationId: journal.operationId,
        messageId: 'message-1',
        acknowledgedAt: 6,
        presentationHandledAt: 7,
        tombstoneExpiresAt: 8,
      });
    expect(executingResult?.remoteDeviceLogout).toEqual({
      messageId: 'message-1',
      acknowledgedAt: 5,
    });
    expect(executingResult?.updatedAt).toBe(journal.updatedAt);

    const completedJournal: IIdentityExitJournalEntry = {
      ...(executingResult as IIdentityExitJournalEntry),
      status: 'completed',
      updatedAt: 9,
      completed: {
        oneKeyIdLoggedOut: true,
      },
    };
    persisted = {
      ...persisted,
      identityExitOperationJournal: {
        ...persisted.identityExitOperationJournal,
        [journal.operationId]: completedJournal,
      },
    };

    const completedResult =
      await entity.updateRemoteOneKeyIdLogoutJournalDelivery({
        operationId: journal.operationId,
        messageId: 'message-1',
        acknowledgedAt: 10,
        presentationHandledAt: 11,
        tombstoneExpiresAt: 12,
      });
    expect(completedResult?.remoteDeviceLogout).toEqual({
      messageId: 'message-1',
      acknowledgedAt: 5,
      presentationHandledAt: 11,
      tombstoneExpiresAt: 12,
    });
    const completedUpdatedAt = completedResult?.updatedAt;

    await expect(
      entity.updateRemoteOneKeyIdLogoutJournalDelivery({
        operationId: journal.operationId,
        messageId: 'message-1',
        acknowledgedAt: 13,
        presentationHandledAt: 14,
        tombstoneExpiresAt: 15,
      }),
    ).resolves.toEqual(completedResult);
    expect(
      persisted.identityExitOperationJournal?.[journal.operationId]?.updatedAt,
    ).toBe(completedUpdatedAt);
  });

  test('atomically leases and completes a remote logout presentation', async () => {
    const entity = new SimpleDbEntityPrime();
    const journal: IIdentityExitJournalEntry = {
      ...createRemoteLogoutJournal(),
      status: 'completed',
      completed: {
        oneKeyIdLoggedOut: true,
      },
      remoteDeviceLogout: {
        messageId: 'message-1',
        acknowledgedAt: 5,
      },
    };
    let persisted: ISimpleDBPrime = {
      identityExitOperationJournal: {
        [journal.operationId]: journal,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.tryClaimRemoteOneKeyIdLogoutPresentation({
        operationId: journal.operationId,
        messageId: 'message-1',
        claimId: 'claim-a',
        expiresAt: 200,
        now: 100,
      }),
    ).resolves.toEqual({
      status: 'claimed',
      claimId: 'claim-a',
      expiresAt: 200,
    });
    await expect(
      entity.tryClaimRemoteOneKeyIdLogoutPresentation({
        operationId: journal.operationId,
        messageId: 'message-1',
        claimId: 'claim-b',
        expiresAt: 250,
        now: 150,
      }),
    ).resolves.toEqual({
      status: 'claimedByOther',
      retryAfterMs: 50,
    });
    await expect(
      entity.completeRemoteOneKeyIdLogoutPresentation({
        operationId: journal.operationId,
        messageId: 'message-1',
        claimId: 'claim-b',
        presentationHandledAt: 175,
        tombstoneExpiresAt: 900,
      }),
    ).resolves.toBeUndefined();

    await expect(
      entity.tryClaimRemoteOneKeyIdLogoutPresentation({
        operationId: journal.operationId,
        messageId: 'message-1',
        claimId: 'claim-b',
        expiresAt: 300,
        now: 201,
      }),
    ).resolves.toEqual({
      status: 'claimed',
      claimId: 'claim-b',
      expiresAt: 300,
    });

    await expect(
      entity.completeRemoteOneKeyIdLogoutPresentation({
        operationId: journal.operationId,
        messageId: 'message-1',
        claimId: 'claim-b',
        presentationHandledAt: 200,
        tombstoneExpiresAt: 900,
      }),
    ).resolves.toMatchObject({
      remoteDeviceLogout: {
        messageId: 'message-1',
        acknowledgedAt: 5,
        presentationHandledAt: 200,
        tombstoneExpiresAt: 900,
      },
    });
    expect(
      persisted.identityExitOperationJournal?.[journal.operationId]
        ?.remoteDeviceLogout?.presentationClaim,
    ).toBeUndefined();
    await expect(
      entity.completeRemoteOneKeyIdLogoutPresentation({
        operationId: journal.operationId,
        messageId: 'message-1',
        claimId: 'claim-b',
        presentationHandledAt: 250,
        tombstoneExpiresAt: 950,
      }),
    ).resolves.toMatchObject({
      remoteDeviceLogout: {
        presentationHandledAt: 200,
        presentationHandledClaimId: 'claim-b',
        tombstoneExpiresAt: 900,
      },
    });
    await expect(
      entity.tryClaimRemoteOneKeyIdLogoutPresentation({
        operationId: journal.operationId,
        messageId: 'message-1',
        claimId: 'claim-c',
        expiresAt: 400,
        now: 210,
      }),
    ).resolves.toEqual({ status: 'handled' });
  });

  test('lets a new foreground replace an expired presentation lease', async () => {
    const entity = new SimpleDbEntityPrime();
    const journal: IIdentityExitJournalEntry = {
      ...createRemoteLogoutJournal(),
      status: 'completed',
      completed: {
        oneKeyIdLoggedOut: true,
      },
      remoteDeviceLogout: {
        messageId: 'message-1',
        presentationClaim: {
          claimId: 'expired-claim',
          expiresAt: 100,
        },
      },
    };
    let persisted: ISimpleDBPrime = {
      identityExitOperationJournal: {
        [journal.operationId]: journal,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.tryClaimRemoteOneKeyIdLogoutPresentation({
        operationId: journal.operationId,
        messageId: 'message-1',
        claimId: 'replacement-claim',
        expiresAt: 250,
        now: 150,
      }),
    ).resolves.toEqual({
      status: 'claimed',
      claimId: 'replacement-claim',
      expiresAt: 250,
    });
    expect(
      persisted.identityExitOperationJournal?.[journal.operationId]
        ?.remoteDeviceLogout?.presentationClaim,
    ).toEqual({
      claimId: 'replacement-claim',
      expiresAt: 250,
    });
  });

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
      entity.consumeIdentityExitOAuthHandoff({
        operationId: 'operation',
        handoff: 'handoff',
        consumedAt: 5,
      }),
    ).resolves.toBe(true);
    await expect(
      entity.consumeIdentityExitOAuthHandoff({
        operationId: 'operation',
        handoff: 'handoff',
        consumedAt: 6,
      }),
    ).resolves.toBe(false);
    expect(persisted).toMatchObject({
      identityExitOperationJournal: {},
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

  test('reuses a completed credential upgrade only at the same lifecycle revision', async () => {
    const entity = new SimpleDbEntityPrime();
    const getRawDataSpy = jest.spyOn(entity, 'getRawData');
    getRawDataSpy.mockResolvedValueOnce({
      identityLifecycleRevision: 7,
      localKeylessUpgradeBindPromptShownAtByUserId: {
        'user-1': 100,
      },
      localKeylessCredentialUpgradeCompletedRevisionByUserId: {
        'user-1': 7,
      },
    });

    await expect(
      entity.getOneKeyIdOAuthBindPromptUpgradeState({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({
      hasShown: true,
      credentialUpgradeCompleted: true,
      identityLifecycleRevision: 7,
    });

    getRawDataSpy.mockResolvedValueOnce({
      identityLifecycleRevision: 8,
      localKeylessUpgradeBindPromptShownAtByUserId: {
        'user-1': 100,
      },
      localKeylessCredentialUpgradeCompletedRevisionByUserId: {
        'user-1': 7,
      },
    });

    await expect(
      entity.getOneKeyIdOAuthBindPromptUpgradeState({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({
      hasShown: true,
      credentialUpgradeCompleted: false,
      identityLifecycleRevision: 8,
    });
  });

  test('marks credential upgrade completion at the current lifecycle revision', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: ISimpleDBPrime = {
      identityLifecycleRevision: 9,
      localKeylessCredentialUpgradeCompletedRevisionByUserId: {
        'user-2': 4,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation(async (updater) => {
      if (typeof updater === 'function') {
        persisted = await updater(persisted);
      } else {
        persisted = updater;
      }
      return persisted;
    });

    await expect(
      entity.markOneKeyIdKeylessCredentialUpgradeCompleted({
        onekeyUserId: 'user-1',
        expectedIdentityLifecycleRevision: 9,
      }),
    ).resolves.toBe(true);
    expect(
      persisted.localKeylessCredentialUpgradeCompletedRevisionByUserId,
    ).toEqual({
      'user-1': 9,
      'user-2': 4,
    });
  });

  test('does not mark credential completion after the lifecycle revision changes', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: ISimpleDBPrime = {
      identityLifecycleRevision: 10,
      localKeylessCredentialUpgradeCompletedRevisionByUserId: {
        'user-2': 4,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation(async (updater) => {
      if (typeof updater === 'function') {
        persisted = await updater(persisted);
      } else {
        persisted = updater;
      }
      return persisted;
    });

    await expect(
      entity.markOneKeyIdKeylessCredentialUpgradeCompleted({
        onekeyUserId: 'user-1',
        expectedIdentityLifecycleRevision: 9,
      }),
    ).resolves.toBe(false);
    expect(
      persisted.localKeylessCredentialUpgradeCompletedRevisionByUserId,
    ).toEqual({ 'user-2': 4 });
  });

  test('consumes only the claim that actually presents the reminder', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: ISimpleDBPrime = {};
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => persisted);
    jest.spyOn(entity, 'setRawData').mockImplementation(async (updater) => {
      if (typeof updater === 'function') {
        persisted = await updater(persisted);
      } else {
        persisted = updater;
      }
      return persisted;
    });

    await expect(
      entity.tryClaimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
        claimId: 'claim-1',
        now: 100,
        expiresAt: 200,
      }),
    ).resolves.toBe(true);
    await expect(
      entity.tryClaimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
        claimId: 'claim-2',
        now: 101,
        expiresAt: 201,
      }),
    ).resolves.toBe(false);
    await expect(
      entity.releaseOneKeyIdOAuthBindPromptClaim({
        onekeyUserId: 'user-1',
        claimId: 'wrong-claim',
      }),
    ).resolves.toBe(false);
    await expect(
      entity.releaseOneKeyIdOAuthBindPromptClaim({
        onekeyUserId: 'user-1',
        claimId: 'claim-1',
      }),
    ).resolves.toBe(true);
    await expect(
      entity.tryClaimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
        claimId: 'claim-2',
        now: 102,
        expiresAt: 202,
      }),
    ).resolves.toBe(true);
    await expect(
      entity.completeOneKeyIdOAuthBindPromptClaim({
        onekeyUserId: 'user-1',
        claimId: 'claim-2',
        shownAt: 103,
      }),
    ).resolves.toBe(true);

    await expect(
      entity.hasShownOneKeyIdOAuthBindPrompt({ onekeyUserId: 'user-1' }),
    ).resolves.toBe(true);
    await expect(
      entity.tryClaimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
        claimId: 'claim-3',
        now: 104,
        expiresAt: 204,
      }),
    ).resolves.toBe(false);
  });

  test('resets only the current OneKey ID prompt marker', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: ISimpleDBPrime = {
      localKeylessUpgradeBindPromptShownAtByUserId: {
        'user-1': 1,
        'user-2': 2,
      },
      localKeylessCredentialUpgradeCompletedRevisionByUserId: {
        'user-1': 3,
        'user-2': 4,
      },
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => persisted);
    jest.spyOn(entity, 'setRawData').mockImplementation(async (updater) => {
      if (typeof updater === 'function') {
        persisted = await updater(persisted);
      } else {
        persisted = updater;
      }
      return persisted;
    });

    await entity.resetOneKeyIdOAuthBindPromptShown({
      onekeyUserId: 'user-1',
    });

    expect(persisted.localKeylessUpgradeBindPromptShownAtByUserId).toEqual({
      'user-2': 2,
    });
    expect(
      persisted.localKeylessCredentialUpgradeCompletedRevisionByUserId,
    ).toEqual({ 'user-2': 4 });
  });
});

describe('SimpleDbEntityPrime Infini pending payment session', () => {
  const session = {
    asset: {
      key: getPrimeInfiniPaymentAssetKey({
        chain: 'ETHEREUM',
        token: 'USDC',
        networkId: 'evm--1',
        contractAddress: '0xa0b8',
      }),
      chain: 'ETHEREUM',
      token: 'USDC',
      networkId: 'evm--1',
      contractAddress: '0xa0b8',
    },
    baseline: {
      onekeyUserId: 'user-1',
      wasPrimeActive: false,
    },
    plan: 'monthly' as const,
    selectedSubscriptionPeriod: 'P1M' as const,
    payerAccountId: 'hd-1--0--sol',
    payerAddress: '0xpayer',
    paymentCacheKey: {
      bindingId: 'binding-1',
      paymentId: 'payment-1',
      networkId: 'evm--1',
      contractAddress: '0xa0b8',
      onekeyUserId: 'user-1',
      plan: 'monthly' as const,
      payerAccountId: 'hd-1--0--sol',
      payerAddress: '0xpayer',
    },
    payment: {
      paymentId: 'payment-1',
      address: '0x1234',
      chain: 'ETHEREUM',
      token: 'USDC',
      amountDue: '9.99',
      expiresAt: Date.now() + 60_000,
    },
    sendStarted: false,
  };
  const transferClaim = {
    networkId: session.asset.networkId,
    accountId: session.payerAccountId,
    accountAddress: session.payerAddress,
    fromAddress: session.payerAddress,
    toAddress: session.payment.address,
    contractAddress: session.asset.contractAddress,
    amount: session.payment.amountDue,
  };
  const purchaseStatusSnapshot = {
    onekeyUserId: 'user-1',
    primeSubscription: undefined,
    infiniSubscription: undefined,
  };

  test('persists a versioned session without clobbering Prime auth data', async () => {
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

    const result = await entity.setInfiniPendingPaymentSession({
      onekeyUserId: 'user-1',
      session,
    });

    expect(result.schemaVersion).toBe(2);
    expect(result.payerAccountId).toBe('hd-1--0--sol');
    expect(result.updatedAt).toEqual(expect.any(Number));
    expect(persisted.authStateGeneration).toBe(3);
    expect(
      (
        persisted.infiniPendingPaymentSessionByUserId as Record<
          string,
          typeof result
        >
      )['user-1'],
    ).toEqual(result);
  });

  test('rejects a session stored under a different OneKey ID', async () => {
    const entity = new SimpleDbEntityPrime();

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-2',
        session,
      }),
    ).rejects.toThrow('Invalid OneKey ID');
  });

  test('does not let a stale UI write clear the broadcast marker', async () => {
    const entity = new SimpleDbEntityPrime();
    const markedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
      sendStarted: true,
    };
    let persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': markedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    const result = await entity.setInfiniPendingPaymentSession({
      onekeyUserId: 'user-1',
      session: { ...session, sendStarted: false },
    });

    expect(result.sendStarted).toBe(true);
    expect(
      persisted.infiniPendingPaymentSessionByUserId['user-1'].sendStarted,
    ).toBe(true);
  });

  test('requires the current payment session to be cleared before replacement', async () => {
    const entity = new SimpleDbEntityPrime();
    const existingSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    const persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': existingSession,
      },
    };
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation((async (
        updater: (rawData: typeof persisted) => typeof persisted,
      ) => updater(persisted)) as never);

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session: {
          ...session,
          payment: { ...session.payment, paymentId: 'payment-2' },
          paymentCacheKey: {
            ...session.paymentCacheKey,
            paymentId: 'payment-2',
          },
        },
      }),
    ).rejects.toThrow('already active');
  });

  test('rejects changing the asset identity for the same payment ID', async () => {
    const entity = new SimpleDbEntityPrime();
    const existingSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    const persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': existingSession,
      },
    };
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation((async (
        updater: (rawData: typeof persisted) => typeof persisted,
      ) => updater(persisted)) as never);

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session: {
          ...session,
          asset: {
            ...session.asset,
            networkId: 'evm--8453',
            contractAddress: '0xnew-contract',
          },
          paymentCacheKey: {
            ...session.paymentCacheKey,
            networkId: 'evm--8453',
            contractAddress: '0xnew-contract',
          },
        },
      }),
    ).rejects.toThrow('Infini payment asset identity changed');
  });

  test('rejects changing frozen transfer terms for the same payment ID', async () => {
    const entity = new SimpleDbEntityPrime();
    const existingSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    const persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': existingSession,
      },
    };
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation((async (
        updater: (rawData: typeof persisted) => typeof persisted,
      ) => updater(persisted)) as never);

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session: {
          ...session,
          payment: {
            ...session.payment,
            amountDue: '10.99',
          },
        },
      }),
    ).rejects.toThrow('Infini payment transfer snapshot changed');
  });

  test('allows mutable payment progress to update under the same cache key', async () => {
    const entity = new SimpleDbEntityPrime();
    const existingSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': existingSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session: {
          ...session,
          payment: {
            ...session.payment,
            status: 'confirming',
            amountConfirming: '0.01',
          },
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        payment: expect.objectContaining({
          status: 'confirming',
          amountConfirming: '0.01',
        }),
      }),
    );
  });

  test('lets confirming progress settle without regressing the replacement lock', async () => {
    const entity = new SimpleDbEntityPrime();
    const existingSession = {
      ...session,
      schemaVersion: 2 as const,
      payment: {
        ...session.payment,
        status: 'confirming',
        amountConfirming: '0.01',
      },
      sendStarted: false,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': existingSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session: {
          ...session,
          payment: {
            ...session.payment,
            status: 'pending',
            amountConfirming: '0',
          },
          sendStarted: false,
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        payment: expect.objectContaining({
          amountConfirming: '0',
        }),
        sendStarted: true,
      }),
    );
  });

  test('never lets an explicit terminal payment status regress to pending', async () => {
    const entity = new SimpleDbEntityPrime();
    const existingSession = {
      ...session,
      schemaVersion: 2 as const,
      payment: {
        ...session.payment,
        status: 'failed',
      },
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': existingSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session: {
          ...session,
          payment: {
            ...session.payment,
            status: 'pending',
          },
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        payment: expect.objectContaining({
          status: 'failed',
        }),
      }),
    );
  });

  test('invalidates a legacy cache without the explicit payment binding', async () => {
    const entity = new SimpleDbEntityPrime();
    const legacySession = {
      ...session,
      schemaVersion: 1,
      updatedAt: Date.now(),
    } as unknown as IPrimeInfiniPendingPaymentSession;
    let persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': legacySession,
      },
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => persisted);
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.getInfiniPendingPaymentSession({ onekeyUserId: 'user-1' }),
    ).resolves.toBeUndefined();
    expect(
      persisted.infiniPendingPaymentSessionByUserId['user-1'],
    ).toBeUndefined();
  });

  test('ignores and removes an expired persisted session', async () => {
    const entity = new SimpleDbEntityPrime();
    const staleSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    };
    let persisted = {
      authStateGeneration: 4,
      infiniPendingPaymentSessionByUserId: {
        'user-1': staleSession,
      },
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => persisted);
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.getInfiniPendingPaymentSession({ onekeyUserId: 'user-1' }),
    ).resolves.toBeUndefined();
    expect(persisted.authStateGeneration).toBe(4);
    expect(
      persisted.infiniPendingPaymentSessionByUserId['user-1'],
    ).toBeUndefined();
  });

  test('removes an unsent session older than the one-day TTL while its tombstone survives', async () => {
    // Two days is inside the seven-day sent-session bound, so this pins the
    // tiered lockout: an unsent session must be purged on read, yet the
    // retired binding must stay tombstoned so a lingering window cannot
    // re-persist it.
    const entity = new SimpleDbEntityPrime();
    const staleSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': staleSession,
      },
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => persisted);
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.getInfiniPendingPaymentSession({ onekeyUserId: 'user-1' }),
    ).resolves.toBeUndefined();
    expect(
      persisted.infiniPendingPaymentSessionByUserId?.['user-1'],
    ).toBeUndefined();
    expect(persisted.infiniPaymentCacheTombstonesByUserId?.['user-1']).toEqual([
      expect.objectContaining({
        paymentId: staleSession.paymentCacheKey.paymentId,
        bindingId: staleSession.paymentCacheKey.bindingId,
        retiredAt: expect.any(Number),
      }),
    ]);
  });

  test('keeps a two-day-old sent session until the long bound', async () => {
    // A broadcast transfer can settle days later, so a sent session past the
    // short TTL must keep fencing the purchase entry instead of being purged.
    const entity = new SimpleDbEntityPrime();
    const sentSession = {
      ...session,
      schemaVersion: 2 as const,
      sendStarted: true,
      updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': sentSession,
      },
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => persisted);
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.getInfiniPendingPaymentSession({ onekeyUserId: 'user-1' }),
    ).resolves.toEqual(sentSession);
    expect(persisted.infiniPendingPaymentSessionByUserId?.['user-1']).toEqual(
      sentSession,
    );
  });

  test('self-heals a corrupted persisted session without a payment', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted = {
      authStateGeneration: 4,
      infiniPendingPaymentSessionByUserId: {
        'user-1': {
          schemaVersion: 2,
          updatedAt: Date.now(),
        },
      },
    } as unknown as ISimpleDBPrime;
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => persisted);
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.getInfiniPendingPaymentSession({ onekeyUserId: 'user-1' }),
    ).resolves.toBeUndefined();
    expect(
      persisted.infiniPendingPaymentSessionByUserId?.['user-1'],
    ).toBeUndefined();
  });

  test('does not clear a newer replacement session', async () => {
    const entity = new SimpleDbEntityPrime();
    const replacement = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
      payment: { ...session.payment, paymentId: 'payment-2' },
      paymentCacheKey: {
        ...session.paymentCacheKey,
        paymentId: 'payment-2',
      },
    };
    let persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': replacement,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await entity.clearInfiniPendingPaymentSession({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: session.paymentCacheKey,
    });

    expect(persisted.infiniPendingPaymentSessionByUserId['user-1']).toEqual(
      replacement,
    );
  });

  test('atomically discards the matching unsent payment session', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.discardUnsentInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
      }),
    ).resolves.toBe(true);
    expect(
      persisted.infiniPendingPaymentSessionByUserId?.['user-1'],
    ).toBeUndefined();
  });

  test('does not let a stale writer resurrect a discarded payment cache', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await entity.discardUnsentInfiniPendingPaymentSession({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: session.paymentCacheKey,
    });

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session,
      }),
    ).rejects.toThrow('Infini payment cache is retired');
  });

  test('allows the same unpaid invoice to bind to a different payer', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);
    const reboundSession = {
      ...session,
      payerAccountId: 'hd-1--1',
      payerAddress: '0xnewpayer',
      paymentCacheKey: {
        ...session.paymentCacheKey,
        payerAccountId: 'hd-1--1',
        payerAddress: '0xnewpayer',
      },
    };

    await entity.discardUnsentInfiniPendingPaymentSession({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: session.paymentCacheKey,
    });

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session: reboundSession,
      }),
    ).resolves.toMatchObject({
      payerAccountId: reboundSession.payerAccountId,
      payerAddress: reboundSession.payerAddress,
      paymentCacheKey: reboundSession.paymentCacheKey,
    });
  });

  test('atomically rebinds the same unpaid invoice to a different payer', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    const reboundSession = await entity.rebindUnsentInfiniPendingPaymentSession(
      {
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        latestPayment: session.payment,
        nextBindingId: 'binding-2',
        payerAccountId: 'hd-1--1',
        payerAddress: '0xnewpayer',
      },
    );

    expect(reboundSession).toMatchObject({
      payerAccountId: 'hd-1--1',
      payerAddress: '0xnewpayer',
      payment: {
        paymentId: session.payment.paymentId,
      },
      paymentCacheKey: {
        bindingId: 'binding-2',
        paymentId: session.payment.paymentId,
        payerAccountId: 'hd-1--1',
        payerAddress: '0xnewpayer',
      },
    });
    expect(persisted.infiniPendingPaymentSessionByUserId?.['user-1']).toEqual(
      reboundSession,
    );
    expect(persisted.infiniPaymentCacheTombstonesByUserId?.['user-1']).toEqual([
      expect.objectContaining({
        ...session.paymentCacheKey,
        retiredAt: expect.any(Number),
      }),
    ]);
  });

  test('does not rebind an invoice after sending has started', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
      sendStarted: true,
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.rebindUnsentInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        latestPayment: session.payment,
        nextBindingId: 'binding-2',
        payerAccountId: 'hd-1--1',
        payerAddress: '0xnewpayer',
      }),
    ).resolves.toBeUndefined();
    expect(persisted.infiniPendingPaymentSessionByUserId?.['user-1']).toEqual(
      persistedSession,
    );
  });

  test('atomically archives a partially paid invoice before forced replacement', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
      sendStarted: true,
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    const supersededSession = await entity.supersedeInfiniPendingPaymentSession(
      {
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        latestPayment: {
          ...session.payment,
          amountConfirmed: '5',
        },
      },
    );

    expect(supersededSession).toMatchObject({
      payment: {
        paymentId: session.payment.paymentId,
        amountConfirmed: '5',
      },
      sendStarted: true,
      supersededAt: expect.any(Number),
      supersededReason: 'user-forced-replacement',
    });
    expect(
      persisted.infiniPendingPaymentSessionByUserId?.['user-1'],
    ).toBeUndefined();
    expect(
      persisted.infiniSupersededPaymentSessionsByUserId?.['user-1'],
    ).toEqual([supersededSession]);
    expect(persisted.infiniPaymentCacheTombstonesByUserId?.['user-1']).toEqual([
      expect.objectContaining({
        ...session.paymentCacheKey,
        retiredAt: expect.any(Number),
      }),
    ]);
  });

  test('returns the archived invoice when forced replacement is retried', async () => {
    const entity = new SimpleDbEntityPrime();
    const now = Date.now();
    const supersededSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: now,
      sendStarted: true,
      supersededAt: now,
      supersededReason: 'user-forced-replacement' as const,
    };
    let persisted: ISimpleDBPrime = {
      infiniSupersededPaymentSessionsByUserId: {
        'user-1': [supersededSession],
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.supersedeInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        latestPayment: session.payment,
      }),
    ).resolves.toEqual(supersededSession);
    expect(
      persisted.infiniSupersededPaymentSessionsByUserId?.['user-1'],
    ).toEqual([supersededSession]);
  });

  test('does not archive an invoice when its transfer terms changed', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
      sendStarted: true,
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.supersedeInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        latestPayment: {
          ...session.payment,
          amountDue: '19.99',
        },
      }),
    ).resolves.toBeUndefined();
    expect(persisted.infiniPendingPaymentSessionByUserId?.['user-1']).toEqual(
      persistedSession,
    );
    expect(
      persisted.infiniSupersededPaymentSessionsByUserId?.['user-1'],
    ).toBeUndefined();
  });

  test('still rejects the old payer writer after the same invoice is rebound', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);
    const reboundSession = {
      ...session,
      payerAccountId: 'hd-1--1',
      payerAddress: '0xnewpayer',
      paymentCacheKey: {
        ...session.paymentCacheKey,
        payerAccountId: 'hd-1--1',
        payerAddress: '0xnewpayer',
      },
    };

    await entity.discardUnsentInfiniPendingPaymentSession({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: session.paymentCacheKey,
    });
    const persistedReboundSession = await entity.setInfiniPendingPaymentSession(
      {
        onekeyUserId: 'user-1',
        session: reboundSession,
      },
    );

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session,
      }),
    ).rejects.toThrow('Infini payment cache is retired');
    expect(persisted.infiniPendingPaymentSessionByUserId?.['user-1']).toEqual(
      persistedReboundSession,
    );
  });

  test('allows the same invoice and payer to create a new local binding', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);
    const reboundSession = {
      ...session,
      paymentCacheKey: {
        ...session.paymentCacheKey,
        bindingId: 'binding-2',
      },
    };

    await entity.discardUnsentInfiniPendingPaymentSession({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: session.paymentCacheKey,
    });

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session: reboundSession,
      }),
    ).resolves.toMatchObject({
      paymentCacheKey: reboundSession.paymentCacheKey,
    });
  });

  test('rejects a stale writer from an old binding after the same payer rebinds', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);
    const reboundSession = {
      ...session,
      paymentCacheKey: {
        ...session.paymentCacheKey,
        bindingId: 'binding-2',
      },
    };

    await entity.discardUnsentInfiniPendingPaymentSession({
      onekeyUserId: 'user-1',
      expectedPaymentCacheIdentity: session.paymentCacheKey,
    });
    const persistedReboundSession = await entity.setInfiniPendingPaymentSession(
      {
        onekeyUserId: 'user-1',
        session: reboundSession,
      },
    );

    await expect(
      entity.setInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        session,
      }),
    ).rejects.toThrow('Infini payment cache is retired');
    expect(persisted.infiniPendingPaymentSessionByUserId?.['user-1']).toEqual(
      persistedReboundSession,
    );
  });

  test('does not discard a payment session after sending has started', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
      sendStarted: true,
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.discardUnsentInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
      }),
    ).resolves.toBe(false);
    expect(persisted.infiniPendingPaymentSessionByUserId?.['user-1']).toEqual(
      persistedSession,
    );
  });

  test('does not discard a newer replacement payment session', async () => {
    const entity = new SimpleDbEntityPrime();
    const replacementSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
      payment: {
        ...session.payment,
        paymentId: 'payment-2',
      },
      paymentCacheKey: {
        ...session.paymentCacheKey,
        paymentId: 'payment-2',
      },
    };
    let persisted: ISimpleDBPrime = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': replacementSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.discardUnsentInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
      }),
    ).resolves.toBe(false);
    expect(persisted.infiniPendingPaymentSessionByUserId?.['user-1']).toEqual(
      replacementSession,
    );
  });

  const makeLatchEntity = () => {
    const entity = new SimpleDbEntityPrime();
    let persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': {
          ...session,
          schemaVersion: 2 as const,
          updatedAt: Date.now() - 1000,
        },
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);
    return {
      entity,
      getStoredSession: () =>
        persisted.infiniPendingPaymentSessionByUserId['user-1'],
    };
  };

  const makeTerminalDiscardEntity = () => {
    const entity = new SimpleDbEntityPrime();
    let persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': {
          ...session,
          schemaVersion: 2 as const,
          updatedAt: Date.now(),
          sendStarted: true,
        },
      } as Record<
        string,
        typeof session & { schemaVersion: 2; updatedAt: number }
      >,
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);
    return { entity, getRawData: () => persisted };
  };

  test('latches server-observed progress onto an unsent session', async () => {
    const { entity, getStoredSession } = makeLatchEntity();

    const result = await entity.latchInfiniPendingPaymentSessionProgress({
      onekeyUserId: 'user-1',
      paymentCacheKey: session.paymentCacheKey,
      latestPayment: {
        ...session.payment,
        amountConfirming: '0.5',
      },
    });

    expect(result?.sendStarted).toBe(true);
    expect(result?.payment.amountConfirming).toBe('0.5');
    expect(getStoredSession().sendStarted).toBe(true);
  });

  test('does not refresh the session when no new progress is observed', async () => {
    const { entity, getStoredSession } = makeLatchEntity();
    const updatedAtBefore = getStoredSession().updatedAt;

    const result = await entity.latchInfiniPendingPaymentSessionProgress({
      onekeyUserId: 'user-1',
      paymentCacheKey: session.paymentCacheKey,
      latestPayment: session.payment,
    });

    expect(result?.sendStarted).toBe(false);
    expect(getStoredSession().updatedAt).toBe(updatedAtBefore);
  });

  test('ignores a latch for a session the cache key no longer matches', async () => {
    const { entity, getStoredSession } = makeLatchEntity();

    const result = await entity.latchInfiniPendingPaymentSessionProgress({
      onekeyUserId: 'user-1',
      paymentCacheKey: {
        ...session.paymentCacheKey,
        paymentId: 'payment-2',
      },
      latestPayment: {
        ...session.payment,
        amountConfirming: '0.5',
      },
    });

    expect(result).toBeUndefined();
    expect(getStoredSession().sendStarted).toBe(false);
  });

  test('keeps a latched session undiscardable when a later snapshot reports zero progress', async () => {
    const { entity, getStoredSession } = makeLatchEntity();

    await entity.latchInfiniPendingPaymentSessionProgress({
      onekeyUserId: 'user-1',
      paymentCacheKey: session.paymentCacheKey,
      latestPayment: {
        ...session.payment,
        amountConfirming: '0.5',
      },
    });
    // Final consistency can report the confirming amount back as zero; the
    // merge would then see no progress, so only the persisted sendStarted
    // latch keeps the session from being replaced by a second invoice.
    await entity.latchInfiniPendingPaymentSessionProgress({
      onekeyUserId: 'user-1',
      paymentCacheKey: session.paymentCacheKey,
      latestPayment: {
        ...session.payment,
        amountConfirming: '0',
      },
    });

    expect(getStoredSession().sendStarted).toBe(true);
    await expect(
      entity.discardUnsentInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
      }),
    ).resolves.toBe(false);
    expect(getStoredSession().sendStarted).toBe(true);
  });

  test('releases a claimed session once the server closes the invoice unpaid', async () => {
    const { entity, getStoredSession } = makeLatchEntity();
    await entity.latchInfiniPendingPaymentSessionProgress({
      onekeyUserId: 'user-1',
      paymentCacheKey: session.paymentCacheKey,
      latestPayment: { ...session.payment, amountConfirming: '0.5' },
    });
    expect(getStoredSession().sendStarted).toBe(true);

    await expect(
      entity.discardTerminalInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        expectedUpdatedAt: getStoredSession().updatedAt,
        expectedSendStarted: true,
        latestPayment: { ...session.payment, status: 'expired' },
      }),
    ).resolves.toBe(false);

    const { entity: freshEntity, getRawData } = makeTerminalDiscardEntity();
    await expect(
      freshEntity.discardTerminalInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        expectedUpdatedAt:
          getRawData().infiniPendingPaymentSessionByUserId['user-1'].updatedAt,
        expectedSendStarted: true,
        latestPayment: { ...session.payment, status: 'expired' },
      }),
    ).resolves.toBe(true);
    expect(
      getRawData().infiniPendingPaymentSessionByUserId['user-1'],
    ).toBeUndefined();
    // Tombstone and session removal must always come as a pair.
    expect(
      (
        getRawData() as unknown as {
          infiniPaymentCacheTombstonesByUserId?: Record<string, unknown[]>;
        }
      ).infiniPaymentCacheTombstonesByUserId?.['user-1'],
    ).toEqual([
      expect.objectContaining({
        paymentId: session.paymentCacheKey.paymentId,
        bindingId: session.paymentCacheKey.bindingId,
        retiredAt: expect.any(Number),
      }),
    ]);
  });

  test('refuses to release a claimed session that only expired on the local clock', async () => {
    const { entity, getRawData } = makeTerminalDiscardEntity();

    await expect(
      entity.discardTerminalInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        expectedUpdatedAt:
          getRawData().infiniPendingPaymentSessionByUserId['user-1'].updatedAt,
        expectedSendStarted: true,
        latestPayment: { ...session.payment, expiresAt: 1 },
      }),
    ).resolves.toBe(false);
    expect(
      getRawData().infiniPendingPaymentSessionByUserId['user-1'],
    ).toBeDefined();
  });

  // Applies concurrentWrite between the caller pinning the revision and the
  // updater running, so the claim genuinely lands while the delete is in
  // flight rather than as static setup.
  const makeInFlightClaimEntity = (
    observedUpdatedAt: number,
    concurrentWrite: (current: typeof session & { updatedAt: number }) => void,
  ) => {
    const entity = new SimpleDbEntityPrime();
    let persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': {
          ...session,
          schemaVersion: 2 as const,
          updatedAt: observedUpdatedAt,
          sendStarted: false,
        },
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      concurrentWrite(persisted.infiniPendingPaymentSessionByUserId['user-1']);
      persisted = updater(persisted);
      return persisted;
    }) as never);
    return {
      entity,
      getStored: () => persisted.infiniPendingPaymentSessionByUserId['user-1'],
    };
  };

  test('refuses a terminal discard when the session is claimed while the delete is in flight', async () => {
    const observedUpdatedAt = Date.now() - 5000;
    const { entity, getStored } = makeInFlightClaimEntity(
      observedUpdatedAt,
      (current) => {
        current.sendStarted = true;
        current.updatedAt = Date.now();
      },
    );

    await expect(
      entity.discardTerminalInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        expectedUpdatedAt: observedUpdatedAt,
        expectedSendStarted: false,
        latestPayment: { ...session.payment, status: 'expired' },
      }),
    ).resolves.toBe(false);
    expect(getStored()).toBeDefined();
    expect(getStored().sendStarted).toBe(true);
  });

  // Isolates the updatedAt half of the CAS: sendStarted matches on both sides,
  // so only the revision bump can reject. Without this the two conditions are
  // ORed and removing the updatedAt check would still leave the suite green.
  test('refuses a terminal discard when only the session revision moved on', async () => {
    const observedUpdatedAt = Date.now() - 5000;
    const { entity, getStored } = makeInFlightClaimEntity(
      observedUpdatedAt,
      (current) => {
        current.updatedAt = observedUpdatedAt + 1;
      },
    );

    await expect(
      entity.discardTerminalInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        expectedUpdatedAt: observedUpdatedAt,
        expectedSendStarted: false,
        latestPayment: { ...session.payment, status: 'expired' },
      }),
    ).resolves.toBe(false);
    expect(getStored()).toBeDefined();
    expect(getStored().sendStarted).toBe(false);
  });

  // Matching payment ids alone would let a mutated response have the merge
  // adopt new transfer terms, and the delete would then release a session whose
  // original transfer can still settle.
  test.each([
    ['recipient address', { address: '0xattacker' }],
    ['amount due', { amountDue: '999' }],
    ['token', { token: 'USDT' }],
  ])(
    'refuses a terminal discard when the response changes the %s',
    async (_label, paymentOverride) => {
      const observedUpdatedAt = Date.now() - 5000;
      const { entity, getStored } = makeInFlightClaimEntity(
        observedUpdatedAt,
        () => undefined,
      );

      await expect(
        entity.discardTerminalInfiniPendingPaymentSession({
          onekeyUserId: 'user-1',
          expectedPaymentCacheIdentity: session.paymentCacheKey,
          expectedUpdatedAt: observedUpdatedAt,
          expectedSendStarted: false,
          latestPayment: {
            ...session.payment,
            ...paymentOverride,
            status: 'expired',
          },
        }),
      ).resolves.toBe(false);
      expect(getStored()).toBeDefined();
    },
  );

  test('treats a terminal discard as done when no session remains', async () => {
    const entity = new SimpleDbEntityPrime();
    let persisted: Record<string, unknown> = {};
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.discardTerminalInfiniPendingPaymentSession({
        onekeyUserId: 'user-1',
        expectedPaymentCacheIdentity: session.paymentCacheKey,
        expectedUpdatedAt: 0,
        expectedSendStarted: false,
        latestPayment: { ...session.payment, status: 'expired' },
      }),
    ).resolves.toBe(true);
    // The tombstone is the only side effect of this branch and the sole source
    // of the 'Infini payment cache is retired' rejection, so without it a
    // writer still holding the old cache key could resurrect the session right
    // after the caller was told it was released.
    expect(
      (
        persisted as {
          infiniPaymentCacheTombstonesByUserId?: Record<string, unknown[]>;
        }
      ).infiniPaymentCacheTombstonesByUserId?.['user-1'],
    ).toEqual([
      expect.objectContaining({
        paymentId: session.paymentCacheKey.paymentId,
        bindingId: session.paymentCacheKey.bindingId,
        retiredAt: expect.any(Number),
      }),
    ]);
  });

  test('atomically marks the matching session before transaction broadcast', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    const result = await entity.markInfiniPendingPaymentSessionSendStarted({
      onekeyUserId: 'user-1',
      paymentCacheKey: session.paymentCacheKey,
      transferClaim,
      latestPayment: session.payment,
      purchaseStatusSnapshot,
    });

    expect(result.sendStarted).toBe(true);
    expect(
      persisted.infiniPendingPaymentSessionByUserId['user-1'].sendStarted,
    ).toBe(true);
  });

  test.each([
    ['network', { networkId: 'evm--10' }],
    ['account', { accountId: 'hd-1--1' }],
    ['account address', { accountAddress: '0xattacker' }],
    ['sender', { fromAddress: '0xattacker' }],
    ['recipient', { toAddress: '0xattacker' }],
    ['token contract', { contractAddress: '0xattacker' }],
    ['amount', { amount: '10' }],
  ])(
    'refuses to claim a session when the decoded transaction %s mismatches',
    async (_label, transferOverride) => {
      const entity = new SimpleDbEntityPrime();
      const persistedSession = {
        ...session,
        schemaVersion: 2 as const,
        updatedAt: Date.now(),
      };
      let persisted = {
        infiniPendingPaymentSessionByUserId: {
          'user-1': persistedSession,
        },
      };
      jest.spyOn(entity, 'setRawData').mockImplementation((async (
        updater: (rawData: typeof persisted) => typeof persisted,
      ) => {
        persisted = updater(persisted);
        return persisted;
      }) as never);

      await expect(
        entity.markInfiniPendingPaymentSessionSendStarted({
          onekeyUserId: 'user-1',
          paymentCacheKey: session.paymentCacheKey,
          transferClaim: {
            ...transferClaim,
            ...transferOverride,
          },
          latestPayment: session.payment,
          purchaseStatusSnapshot,
        }),
      ).rejects.toThrow('session is unavailable');
      expect(
        persisted.infiniPendingPaymentSessionByUserId['user-1'].sendStarted,
      ).toBe(false);
    },
  );

  test('accepts equivalent EVM address casing and decimal amount formatting', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    let persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation((async (
      updater: (rawData: typeof persisted) => typeof persisted,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);

    await expect(
      entity.markInfiniPendingPaymentSessionSendStarted({
        onekeyUserId: 'user-1',
        paymentCacheKey: session.paymentCacheKey,
        transferClaim: {
          ...transferClaim,
          accountAddress: session.payerAddress.toUpperCase(),
          fromAddress: session.payerAddress.toUpperCase(),
          toAddress: session.payment.address.toUpperCase(),
          contractAddress: session.asset.contractAddress.toUpperCase(),
          amount: '9.990',
        },
        latestPayment: session.payment,
        purchaseStatusSnapshot,
      }),
    ).resolves.toMatchObject({ sendStarted: true });
  });

  test('refuses to mark a missing or replaced session', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
    };
    const persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation((async (
        updater: (rawData: typeof persisted) => typeof persisted,
      ) => updater(persisted)) as never);

    await expect(
      entity.markInfiniPendingPaymentSessionSendStarted({
        onekeyUserId: 'user-1',
        paymentCacheKey: {
          ...session.paymentCacheKey,
          paymentId: 'payment-2',
        },
        transferClaim,
        latestPayment: session.payment,
        purchaseStatusSnapshot,
      }),
    ).rejects.toThrow('session is unavailable');
  });

  test('refuses a second broadcast attempt for an already marked session', async () => {
    const entity = new SimpleDbEntityPrime();
    const persistedSession = {
      ...session,
      schemaVersion: 2 as const,
      updatedAt: Date.now(),
      sendStarted: true,
    };
    const persisted = {
      infiniPendingPaymentSessionByUserId: {
        'user-1': persistedSession,
      },
    };
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation((async (
        updater: (rawData: typeof persisted) => typeof persisted,
      ) => updater(persisted)) as never);

    await expect(
      entity.markInfiniPendingPaymentSessionSendStarted({
        onekeyUserId: 'user-1',
        paymentCacheKey: session.paymentCacheKey,
        transferClaim,
        latestPayment: session.payment,
        purchaseStatusSnapshot,
      }),
    ).rejects.toThrow('session is unavailable');
  });

  test.each([
    [
      'initial activation',
      session,
      {
        onekeyUserId: 'user-1',
        primeSubscription: {
          isActive: true,
          expiresAt: Date.now() + 86_400_000,
        },
        infiniSubscription: undefined,
      },
    ],
    [
      'Prime renewal',
      {
        ...session,
        baseline: {
          onekeyUserId: 'user-1',
          wasPrimeActive: true,
          primeExpiresAt: 1_800_000_000_000,
          infiniPeriodEnd: 1_800_000_000_000,
        },
      },
      {
        onekeyUserId: 'user-1',
        primeSubscription: {
          isActive: true,
          expiresAt: 1_800_000_000_001,
        },
        infiniSubscription: undefined,
      },
    ],
    [
      'Infini renewal',
      {
        ...session,
        baseline: {
          onekeyUserId: 'user-1',
          wasPrimeActive: true,
          primeExpiresAt: 1_800_000_000_000,
          infiniPeriodEnd: 1_800_000_000_000,
        },
      },
      {
        onekeyUserId: 'user-1',
        primeSubscription: {
          isActive: true,
          expiresAt: 1_800_000_000_000,
        },
        infiniSubscription: {
          subscriptionId: 'subscription-1',
          status: 'active',
          plan: 'monthly' as const,
          currentPeriodEnd: 1_800_000_000_001,
        },
      },
    ],
  ])(
    'refuses to claim a stale invoice after %s completed elsewhere',
    async (_label, completedSession, completedStatusSnapshot) => {
      const entity = new SimpleDbEntityPrime();
      const persistedSession = {
        ...completedSession,
        schemaVersion: 2 as const,
        updatedAt: Date.now(),
      };
      let persisted = {
        infiniPendingPaymentSessionByUserId: {
          'user-1': persistedSession,
        },
      };
      jest.spyOn(entity, 'setRawData').mockImplementation((async (
        updater: (rawData: typeof persisted) => typeof persisted,
      ) => {
        persisted = updater(persisted);
        return persisted;
      }) as never);

      await expect(
        entity.markInfiniPendingPaymentSessionSendStarted({
          onekeyUserId: 'user-1',
          paymentCacheKey: session.paymentCacheKey,
          transferClaim,
          latestPayment: completedSession.payment,
          purchaseStatusSnapshot: completedStatusSnapshot,
        }),
      ).rejects.toThrow('session is unavailable');
      expect(
        persisted.infiniPendingPaymentSessionByUserId['user-1'].sendStarted,
      ).toBe(false);
    },
  );

  test.each([
    ['confirming', { amountConfirming: '0.01' }],
    ['confirmed', { amountConfirmed: session.payment.amountDue }],
    ['changed', { address: '0xattacker' }],
    ['failed', { status: 'failed' }],
    ['successful terminal', { status: 'confirmed' }],
  ])(
    'refuses to claim when the post-signing payment is %s',
    async (_label, paymentOverride) => {
      const entity = new SimpleDbEntityPrime();
      const persistedSession = {
        ...session,
        schemaVersion: 2 as const,
        updatedAt: Date.now(),
      };
      let persisted = {
        infiniPendingPaymentSessionByUserId: {
          'user-1': persistedSession,
        },
      };
      jest.spyOn(entity, 'setRawData').mockImplementation((async (
        updater: (rawData: typeof persisted) => typeof persisted,
      ) => {
        persisted = updater(persisted);
        return persisted;
      }) as never);

      await expect(
        entity.markInfiniPendingPaymentSessionSendStarted({
          onekeyUserId: 'user-1',
          paymentCacheKey: session.paymentCacheKey,
          transferClaim,
          latestPayment: {
            ...session.payment,
            ...paymentOverride,
          },
          purchaseStatusSnapshot,
        }),
      ).rejects.toThrow('session is unavailable');
      expect(
        persisted.infiniPendingPaymentSessionByUserId['user-1'].sendStarted,
      ).toBe(false);
    },
  );
});

function createPrimeAnalyticsEntityWithStore(initial: ISimpleDBPrime = {}) {
  const entity = new SimpleDbEntityPrime();
  let persisted: ISimpleDBPrime = initial;
  jest
    .spyOn(entity, 'getRawData')
    .mockImplementation((async () => persisted) as never);
  const setRawDataSpy = jest
    .spyOn(entity, 'setRawData')
    .mockImplementation((async (
      updater: (rawData: ISimpleDBPrime) => ISimpleDBPrime,
    ) => {
      persisted = updater(persisted);
      return persisted;
    }) as never);
  return { entity, getPersisted: () => persisted, setRawDataSpy };
}

describe('SimpleDbEntityPrime.markIdentityLinkReported', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  test('reports and records the first link for a user', async () => {
    const { entity, getPersisted } = createPrimeAnalyticsEntityWithStore();
    const now = Date.now();

    await expect(
      entity.markIdentityLinkReported({ onekeyUserId: 'user-1', now }),
    ).resolves.toEqual({ shouldReport: true });
    expect(getPersisted().identityLinkReportedAtByUserId).toEqual({
      'user-1': now,
    });
  });

  test('suppresses re-reports within the TTL without touching storage', async () => {
    const now = Date.now();
    const { entity, getPersisted, setRawDataSpy } =
      createPrimeAnalyticsEntityWithStore({
        identityLinkReportedAtByUserId: { 'user-1': now - DAY_MS },
      });

    await expect(
      entity.markIdentityLinkReported({ onekeyUserId: 'user-1', now }),
    ).resolves.toEqual({ shouldReport: false });
    expect(getPersisted().identityLinkReportedAtByUserId).toEqual({
      'user-1': now - DAY_MS,
    });
    expect(setRawDataSpy).not.toHaveBeenCalled();
  });

  test('re-reports after the TTL elapses', async () => {
    const now = Date.now();
    const { entity, getPersisted } = createPrimeAnalyticsEntityWithStore({
      identityLinkReportedAtByUserId: { 'user-1': now - 8 * DAY_MS },
    });

    await expect(
      entity.markIdentityLinkReported({ onekeyUserId: 'user-1', now }),
    ).resolves.toEqual({ shouldReport: true });
    expect(getPersisted().identityLinkReportedAtByUserId).toEqual({
      'user-1': now,
    });
  });

  test('re-reports when the recorded timestamp is in the future (clock rollback)', async () => {
    const now = Date.now();
    const { entity } = createPrimeAnalyticsEntityWithStore({
      identityLinkReportedAtByUserId: { 'user-1': now + DAY_MS },
    });

    await expect(
      entity.markIdentityLinkReported({ onekeyUserId: 'user-1', now }),
    ).resolves.toEqual({ shouldReport: true });
  });

  test('prunes the record to the most recent users', async () => {
    const now = Date.now();
    const { entity, getPersisted } = createPrimeAnalyticsEntityWithStore({
      identityLinkReportedAtByUserId: {
        'user-1': now - 5,
        'user-2': now - 4,
        'user-3': now - 3,
        'user-4': now - 2,
        'user-5': now - 1,
      },
    });

    await expect(
      entity.markIdentityLinkReported({ onekeyUserId: 'user-6', now }),
    ).resolves.toEqual({ shouldReport: true });
    const persistedRecord = getPersisted().identityLinkReportedAtByUserId;
    expect(Object.keys(persistedRecord ?? {})).toHaveLength(5);
    expect(persistedRecord?.['user-6']).toBe(now);
    expect(persistedRecord?.['user-1']).toBeUndefined();
  });
});

describe('SimpleDbEntityPrime.markPrimeProfileReported', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  test('reports the first profile snapshot', async () => {
    const { entity, getPersisted } = createPrimeAnalyticsEntityWithStore();
    const now = Date.now();

    await expect(
      entity.markPrimeProfileReported({
        isOneKeyIdLoggedIn: false,
        isPrimeActive: false,
        now,
      }),
    ).resolves.toEqual({ shouldReport: true });
    expect(getPersisted().analyticsPrimeProfileReport).toEqual({
      isOneKeyIdLoggedIn: false,
      isPrimeActive: false,
      reportedAt: now,
    });
  });

  test('suppresses unchanged values within the TTL without touching storage', async () => {
    const now = Date.now();
    const { entity, getPersisted, setRawDataSpy } =
      createPrimeAnalyticsEntityWithStore({
        analyticsPrimeProfileReport: {
          isOneKeyIdLoggedIn: true,
          isPrimeActive: false,
          reportedAt: now - DAY_MS,
        },
      });

    await expect(
      entity.markPrimeProfileReported({
        isOneKeyIdLoggedIn: true,
        isPrimeActive: false,
        now,
      }),
    ).resolves.toEqual({ shouldReport: false });
    expect(getPersisted().analyticsPrimeProfileReport?.reportedAt).toBe(
      now - DAY_MS,
    );
    expect(setRawDataSpy).not.toHaveBeenCalled();
  });

  test('reports immediately when a value changes', async () => {
    const now = Date.now();
    const { entity, getPersisted } = createPrimeAnalyticsEntityWithStore({
      analyticsPrimeProfileReport: {
        isOneKeyIdLoggedIn: true,
        isPrimeActive: false,
        reportedAt: now - 1000,
      },
    });

    await expect(
      entity.markPrimeProfileReported({
        isOneKeyIdLoggedIn: true,
        isPrimeActive: true,
        now,
      }),
    ).resolves.toEqual({ shouldReport: true });
    expect(getPersisted().analyticsPrimeProfileReport).toEqual({
      isOneKeyIdLoggedIn: true,
      isPrimeActive: true,
      reportedAt: now,
    });
  });

  test('re-asserts unchanged values after the TTL', async () => {
    const now = Date.now();
    const { entity } = createPrimeAnalyticsEntityWithStore({
      analyticsPrimeProfileReport: {
        isOneKeyIdLoggedIn: true,
        isPrimeActive: true,
        reportedAt: now - 8 * DAY_MS,
      },
    });

    await expect(
      entity.markPrimeProfileReported({
        isOneKeyIdLoggedIn: true,
        isPrimeActive: true,
        now,
      }),
    ).resolves.toEqual({ shouldReport: true });
  });
});

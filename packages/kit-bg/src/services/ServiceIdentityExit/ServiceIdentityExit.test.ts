/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
  PasswordPromptDialogCancel,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IIdentityExitOAuthHandoff,
  IIdentityExitPlan,
  IIdentityExitPlanId,
} from '@onekeyhq/shared/types/prime/identityExitTypes';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  primePersistAtom,
  primePersistAtomInitialValue,
} from '../../states/jotai/atoms/prime';
import {
  readPersistedAccessTokenBySessionSourceStrict,
  revokeAuthSessionTokenOnServerBestEffort,
} from '../ServicePrime/primeAuthSessionAccess';

import {
  isIdentityRecoveryReady,
  markIdentityRecoveryPending,
  markIdentityRecoveryReady,
  resetIdentityRecoveryStateForTest,
  waitForIdentityMutationReady,
} from './identityLifecycleMutex';
import ServiceIdentityExit, {
  resetIdentityExitRegistriesForTest,
} from './ServiceIdentityExit';

import type { IDBWallet } from '../../dbs/local/types';
import type { IIdentityExitJournalEntry } from '../../dbs/simple/entity/SimpleDbEntityPrime';

jest.mock('../ServicePrime/primeAuthSessionAccess', () => ({
  readPersistedAccessTokenBySessionSourceStrict: jest.fn(),
  revokeAuthSessionTokenOnServerBestEffort: jest.fn(),
}));

const mockReadSession = jest.mocked(
  readPersistedAccessTokenBySessionSourceStrict,
);
const mockRevokeSupabaseSession = jest.mocked(
  revokeAuthSessionTokenOnServerBestEffort,
);

function buildToken(sub: string): string {
  return `header.${Buffer.from(JSON.stringify({ sub })).toString(
    'base64url',
  )}.signature`;
}

const emailToken = buildToken('email-sub');
const keylessToken = buildToken('keyless-sub');

const keylessWallet = {
  id: 'hd-keyless-1',
  name: 'Keyless',
  type: 'hd',
  backuped: true,
  accounts: [],
  nextIds: {},
  walletNo: 1,
  isKeyless: true,
  keylessDetailsInfo: {
    keylessOwnerId: 'owner-1',
    keylessProvider: EOAuthSocialLoginProvider.Google,
    socialUserIdHash: 'social-hash-1',
  },
} as IDBWallet;

function createFixture({
  source = EPrimeAuthSessionSource.LegacyEmailSupabase,
  wallet = keylessWallet,
  lifecycleRevisions = [10],
  journalEntries = {},
}: {
  source?: EPrimeAuthSessionSource;
  wallet?: IDBWallet | null;
  lifecycleRevisions?: number[];
  journalEntries?: Record<string, IIdentityExitJournalEntry>;
} = {}) {
  let revisionReadIndex = 0;
  const promptPasswordVerifyByWallet = jest.fn().mockResolvedValue({
    password: 'encoded-password',
  });
  const removeKeylessWalletWithCapability = jest
    .fn()
    .mockResolvedValue(undefined);
  const removeMalformedKeylessWalletWithCapability = jest
    .fn()
    .mockResolvedValue(undefined);
  const commitIdentityExitLocalState = jest
    .fn()
    .mockResolvedValue({ status: 'committed', revision: 11 });
  const logoutPrimeServerSessionBestEffort = jest
    .fn()
    .mockResolvedValue(undefined);
  const deleteOneKeyIdAccountOnServer = jest
    .fn()
    .mockResolvedValue({ ok: true });
  const clearAllIdentityAuthForExplicitOperation = jest
    .fn()
    .mockResolvedValue({ status: 'committed', revision: 11 });
  const finalizeRemovedKeylessWalletSideEffects = jest
    .fn()
    .mockResolvedValue(undefined);
  const cleanupChildBotWalletsForRemovedKeylessParent = jest
    .fn()
    .mockResolvedValue(undefined);
  const cleanupKeylessWalletCredentialStorage = jest
    .fn()
    .mockResolvedValue(undefined);
  const journalState: Record<string, IIdentityExitJournalEntry> = {
    ...journalEntries,
  };
  const setIdentityExitJournalEntry = jest.fn(
    async (entry: IIdentityExitJournalEntry) => {
      journalState[entry.operationId] = entry;
    },
  );
  const ensureIdentityExitJournalEntry = jest.fn(
    async (entry: IIdentityExitJournalEntry) => {
      const existing = journalState[entry.operationId];
      if (existing) {
        return { created: false, entry: existing };
      }
      journalState[entry.operationId] = entry;
      return { created: true, entry };
    },
  );
  const updateRemoteOneKeyIdLogoutJournalDelivery = jest.fn(
    async ({
      operationId,
      messageId,
      acknowledgedAt,
      presentationHandledAt,
      tombstoneExpiresAt,
    }: {
      operationId: string;
      messageId: string;
      acknowledgedAt?: number;
      presentationHandledAt?: number;
      tombstoneExpiresAt?: number;
    }) => {
      const entry = journalState[operationId];
      if (entry?.remoteDeviceLogout?.messageId !== messageId) {
        return undefined;
      }
      const remoteDeviceLogout = {
        ...entry.remoteDeviceLogout,
        acknowledgedAt:
          entry.remoteDeviceLogout.acknowledgedAt ?? acknowledgedAt,
        presentationHandledAt:
          entry.status === 'completed'
            ? (entry.remoteDeviceLogout.presentationHandledAt ??
              presentationHandledAt)
            : entry.remoteDeviceLogout.presentationHandledAt,
      };
      const nextRemoteDeviceLogout =
        remoteDeviceLogout.acknowledgedAt &&
        remoteDeviceLogout.presentationHandledAt
          ? {
              ...remoteDeviceLogout,
              tombstoneExpiresAt:
                entry.remoteDeviceLogout.tombstoneExpiresAt ??
                tombstoneExpiresAt,
            }
          : remoteDeviceLogout;
      const updatedEntry = {
        ...entry,
        updatedAt: Date.now(),
        remoteDeviceLogout: nextRemoteDeviceLogout,
      };
      journalState[operationId] = updatedEntry;
      return updatedEntry;
    },
  );
  const removeIdentityExitJournalEntry = jest.fn(
    async ({
      operationId,
      expectedUpdatedAt,
    }: {
      operationId: string;
      expectedUpdatedAt: number;
    }) => {
      const entry = journalState[operationId];
      if (!entry || entry.updatedAt !== expectedUpdatedAt) {
        return false;
      }
      delete journalState[operationId];
      return true;
    },
  );
  const consumeIdentityExitOAuthHandoff = jest.fn(
    async ({
      operationId,
      handoff,
      consumedAt,
    }: {
      operationId: string;
      handoff: string;
      consumedAt: number;
    }) => {
      const entry = journalState[operationId];
      if (
        entry?.status !== 'completed' ||
        entry.completed?.oauthHandoff !== handoff
      ) {
        return false;
      }
      delete journalState[operationId];
      if (
        entry.completed.oauthHandoffConsumedAt ||
        !entry.completed.oauthHandoffExpiresAt ||
        entry.completed.oauthHandoffExpiresAt <= consumedAt
      ) {
        return false;
      }
      return true;
    },
  );
  const backgroundApi = {
    simpleDb: {
      prime: {
        getIdentityLifecycleRevision: jest.fn(async () => {
          const value =
            lifecycleRevisions[
              Math.min(revisionReadIndex, lifecycleRevisions.length - 1)
            ];
          revisionReadIndex += 1;
          return value;
        }),
        getOneKeyIdAuthState: jest.fn().mockResolvedValue('loggedIn'),
        getAuthSessionSource: jest.fn().mockResolvedValue(source),
        getEffectiveAuthSessionSource: jest.fn().mockResolvedValue(source),
        getAuthSessionCommitId: jest.fn(
          async (
            sessionSource: EPrimeAuthSessionSource,
          ): Promise<string | undefined> =>
            sessionSource === EPrimeAuthSessionSource.LegacyEmailSupabase
              ? 'email-session'
              : 'keyless-session',
        ),
        getKeylessSessionCommitId: jest
          .fn()
          .mockResolvedValue('keyless-session'),
        backfillAuthSessionCommitIdForMigration: jest
          .fn()
          .mockResolvedValue(undefined),
        ensureIdentityExitJournalEntry,
        setIdentityExitJournalEntry,
        updateRemoteOneKeyIdLogoutJournalDelivery,
        removeIdentityExitJournalEntry,
        getIdentityExitOperationJournal: jest.fn(async () => ({
          ...journalState,
        })),
        consumeIdentityExitOAuthHandoff,
      },
    },
    serviceAccount: {
      getKeylessWallet: jest.fn().mockResolvedValue(wallet ?? undefined),
      getIdentityManagedKeylessWalletCandidate: jest
        .fn()
        .mockResolvedValue(wallet ?? undefined),
      removeKeylessWalletWithCapability,
      removeMalformedKeylessWalletWithCapability,
      cleanupChildBotWalletsForRemovedKeylessParent,
      finalizeRemovedKeylessWalletSideEffects,
    },
    serviceKeylessWallet: {
      validateTokenMatchesKeylessWallet: jest
        .fn()
        .mockResolvedValue({ isValid: true }),
      cleanupKeylessWalletCredentialStorage,
    },
    servicePassword: { promptPasswordVerifyByWallet },
    servicePrime: {
      commitIdentityExitLocalState,
      logoutPrimeServerSessionBestEffort,
      deleteOneKeyIdAccountOnServer,
      clearAllIdentityAuthForExplicitOperation,
      recoverInterruptedKeylessOAuthSessionPersistence: jest
        .fn()
        .mockResolvedValue({ recovered: false, abandoned: false }),
    },
  };
  const service = new ServiceIdentityExit({ backgroundApi });
  return {
    service,
    backgroundApi,
    promptPasswordVerifyByWallet,
    removeKeylessWalletWithCapability,
    removeMalformedKeylessWalletWithCapability,
    finalizeRemovedKeylessWalletSideEffects,
    cleanupChildBotWalletsForRemovedKeylessParent,
    cleanupKeylessWalletCredentialStorage,
    commitIdentityExitLocalState,
    logoutPrimeServerSessionBestEffort,
    deleteOneKeyIdAccountOnServer,
    clearAllIdentityAuthForExplicitOperation,
    setIdentityExitJournalEntry,
    ensureIdentityExitJournalEntry,
    updateRemoteOneKeyIdLogoutJournalDelivery,
    removeIdentityExitJournalEntry,
    journalState,
    consumeIdentityExitOAuthHandoff,
  };
}

function expectReadyPlan(
  plan: IIdentityExitPlan,
): asserts plan is Extract<IIdentityExitPlan, { status: 'ready' }> {
  expect(plan.status).toBe('ready');
  if (plan.status !== 'ready') {
    throw new OneKeyLocalError(plan.message);
  }
}

describe('ServiceIdentityExit', () => {
  beforeEach(() => {
    resetIdentityRecoveryStateForTest('ready');
    resetIdentityExitRegistriesForTest();
    jest.clearAllMocks();
    jest.spyOn(primePersistAtom, 'get').mockResolvedValue({
      ...primePersistAtomInitialValue,
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-1',
    });
    mockReadSession.mockImplementation(async (sessionSource) => ({
      status: 'ok',
      accessToken:
        sessionSource === EPrimeAuthSessionSource.LegacyEmailSupabase
          ? emailToken
          : keylessToken,
    }));
    mockRevokeSupabaseSession.mockResolvedValue(undefined);
  });

  test('a successful full recovery clears a failed bootstrap barrier', async () => {
    resetIdentityRecoveryStateForTest('failed');
    const fixture = createFixture();

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 0,
      abandonedOperationCount: 0,
    });
    await expect(waitForIdentityMutationReady()).resolves.toBeUndefined();
    expect(
      fixture.backgroundApi.servicePrime
        .recoverInterruptedKeylessOAuthSessionPersistence,
    ).toHaveBeenCalledTimes(1);
  });

  test('a failed Keyless persistence recovery keeps the bootstrap barrier failed', async () => {
    resetIdentityRecoveryStateForTest('failed');
    const fixture = createFixture();
    const recoveryError = new OneKeyLocalError(
      'Keyless persistence recovery failed',
    );
    fixture.backgroundApi.servicePrime.recoverInterruptedKeylessOAuthSessionPersistence.mockRejectedValue(
      recoveryError,
    );

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).rejects.toBe(recoveryError);
    await expect(waitForIdentityMutationReady()).rejects.toThrow(
      'Identity recovery did not complete',
    );
  });

  afterEach(() => {
    resetIdentityRecoveryStateForTest('ready');
    jest.restoreAllMocks();
  });

  test('durably reconciles an empty Email session without touching independent Keyless', async () => {
    const fixture = createFixture();
    mockReadSession.mockImplementation(async (sessionSource) =>
      sessionSource === EPrimeAuthSessionSource.LegacyEmailSupabase
        ? { status: 'empty' }
        : { status: 'ok', accessToken: keylessToken },
    );

    await expect(
      fixture.service.reconcileMissingOneKeyIdSession({
        callerName: 'test',
      }),
    ).resolves.toEqual({ cleared: true });

    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith({
      expectedIdentityLifecycleRevision: 10,
      oneKeyId: {
        onekeyUserId: 'onekey-user-1',
        source: EPrimeAuthSessionSource.LegacyEmailSupabase,
        sessionCommitId: 'email-session',
      },
      keylessSession: undefined,
      keylessWalletSession: undefined,
    });
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(
      fixture.cleanupKeylessWalletCredentialStorage,
    ).not.toHaveBeenCalled();
    expect(
      fixture.setIdentityExitJournalEntry.mock.calls.map(
        ([entry]) => entry.status,
      ),
    ).toEqual(['executing', 'localStateCommitted', 'completed']);
  });

  test('Email OneKey ID logout preserves independent Keyless and is idempotent', async () => {
    const fixture = createFixture();
    const plan = await fixture.service.prepareIdentityExit({
      type: 'logoutOneKeyId',
      scene: 'profile',
    });
    expectReadyPlan(plan);
    expect(plan.presentation).toEqual({ type: 'oneKeyIdOnly' });

    const first = await fixture.service.executeIdentityExit({
      planId: plan.planId,
    });
    const second = await fixture.service.executeIdentityExit({
      planId: plan.planId,
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    expect(fixture.promptPasswordVerifyByWallet).not.toHaveBeenCalled();
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledTimes(1);
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith(
      expect.objectContaining({
        oneKeyId: expect.objectContaining({
          source: EPrimeAuthSessionSource.LegacyEmailSupabase,
          sessionCommitId: 'email-session',
        }),
        keylessSession: undefined,
      }),
    );
  });

  test('settles the recovery barrier when completed-journal cleanup fails after the receipt is stored', async () => {
    const fixture = createFixture();
    const plan = await fixture.service.prepareIdentityExit({
      type: 'logoutOneKeyId',
      scene: 'profile',
    });
    expectReadyPlan(plan);
    fixture.removeIdentityExitJournalEntry.mockImplementationOnce(
      async ({ operationId }) => {
        delete fixture.journalState[operationId];
        throw new OneKeyLocalError('Completed journal cleanup failed');
      },
    );

    await expect(
      fixture.service.executeIdentityExit({ planId: plan.planId }),
    ).resolves.toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });

    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledTimes(1);
    expect(fixture.journalState).toEqual({});
    expect(isIdentityRecoveryReady()).toBe(true);
  });

  test('does not recover destructively from the current cache when the initial journal write rejects', async () => {
    const fixture = createFixture();
    const plan = await fixture.service.prepareIdentityExit({
      type: 'logoutOneKeyId',
      scene: 'profile',
    });
    expectReadyPlan(plan);
    const journalReadsBeforeExecution =
      fixture.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal.mock
        .calls.length;
    const storageError = new OneKeyLocalError(
      'Identity journal storage write failed',
    );
    fixture.setIdentityExitJournalEntry.mockImplementationOnce(
      async (entry) => {
        fixture.journalState[entry.operationId] = entry;
        throw storageError;
      },
    );

    await expect(
      fixture.service.executeIdentityExit({ planId: plan.planId }),
    ).rejects.toBe(storageError);

    expect(fixture.commitIdentityExitLocalState).not.toHaveBeenCalled();
    expect(
      fixture.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal.mock
        .calls.length,
    ).toBe(journalReadsBeforeExecution);
    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).rejects.toThrow('Identity journal storage outcome is unknown');
    expect(
      fixture.backgroundApi.simpleDb.prime.getIdentityExitOperationJournal.mock
        .calls.length,
    ).toBe(journalReadsBeforeExecution);
  });

  test('does not recover an explicit full-cleanup journal from optimistic cache after write rejection', async () => {
    const fixture = createFixture();
    const storageError = new OneKeyLocalError(
      'Explicit cleanup journal storage write failed',
    );
    fixture.setIdentityExitJournalEntry.mockImplementationOnce(
      async (entry) => {
        fixture.journalState[entry.operationId] = entry;
        throw storageError;
      },
    );

    await expect(fixture.service.prepareIdentityAuthForAppReset()).rejects.toBe(
      storageError,
    );
    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).rejects.toThrow('Identity journal storage outcome is unknown');
    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).not.toHaveBeenCalled();
  });

  test('independent Keyless removal verifies once and preserves Email OneKey ID', async () => {
    const fixture = createFixture();
    const plan = await fixture.service.prepareIdentityExit({
      type: 'removeKeyless',
      expectedWalletId: keylessWallet.id,
      scene: 'accountSelector',
    });
    expectReadyPlan(plan);

    const receipt = await fixture.service.executeIdentityExit({
      planId: plan.planId,
      acknowledgement: 'keylessWalletRemoval',
    });

    expect(receipt).toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: false,
      removedWalletId: keylessWallet.id,
    });
    expect(fixture.promptPasswordVerifyByWallet).toHaveBeenCalledTimes(1);
    expect(fixture.removeKeylessWalletWithCapability).toHaveBeenCalledTimes(1);
    expect(fixture.cleanupKeylessWalletCredentialStorage).toHaveBeenCalledWith({
      ownerId: 'owner-1',
    });
    expect(
      fixture.finalizeRemovedKeylessWalletSideEffects,
    ).toHaveBeenCalledWith({ walletId: keylessWallet.id });
    expect(
      fixture.setIdentityExitJournalEntry.mock.invocationCallOrder[1],
    ).toBeLessThan(
      fixture.cleanupKeylessWalletCredentialStorage.mock.invocationCallOrder[0],
    );
    expect(
      fixture.cleanupKeylessWalletCredentialStorage.mock.invocationCallOrder[0],
    ).toBeLessThan(
      fixture.commitIdentityExitLocalState.mock.invocationCallOrder[0],
    );
    expect(
      fixture.commitIdentityExitLocalState.mock.invocationCallOrder[0],
    ).toBeLessThan(
      fixture.finalizeRemovedKeylessWalletSideEffects.mock
        .invocationCallOrder[0],
    );
    expect(fixture.logoutPrimeServerSessionBestEffort).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith(
      expect.objectContaining({
        oneKeyId: undefined,
        keylessSession: {
          sessionCommitId: 'keyless-session',
          sessionTokenSub: 'keyless-sub',
        },
      }),
    );
  });

  test('KeylessOAuth OneKey ID logout preserves Keyless when linkage is unknown', async () => {
    const fixture = createFixture({
      source: EPrimeAuthSessionSource.KeylessOAuth,
    });
    fixture.backgroundApi.simpleDb.prime.getKeylessSessionCommitId.mockResolvedValue(
      'replacement-keyless-session',
    );
    const plan = await fixture.service.prepareIdentityExit({
      type: 'logoutOneKeyId',
      scene: 'profile',
    });
    expectReadyPlan(plan);
    expect(plan.presentation).toEqual({ type: 'oneKeyIdOnly' });

    await expect(
      fixture.service.executeIdentityExit({ planId: plan.planId }),
    ).resolves.toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: true,
      removedWalletId: undefined,
    });

    expect(fixture.promptPasswordVerifyByWallet).not.toHaveBeenCalled();
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith(
      expect.objectContaining({
        oneKeyId: expect.objectContaining({
          source: EPrimeAuthSessionSource.KeylessOAuth,
          sessionCommitId: 'keyless-session',
        }),
        keylessSession: undefined,
        keylessWalletSession: undefined,
      }),
    );
  });

  test('Keyless removal preserves OneKey ID and auth session when linkage is unknown', async () => {
    const fixture = createFixture({
      source: EPrimeAuthSessionSource.KeylessOAuth,
    });
    fixture.backgroundApi.simpleDb.prime.getKeylessSessionCommitId.mockResolvedValue(
      'replacement-keyless-session',
    );
    const plan = await fixture.service.prepareIdentityExit({
      type: 'removeKeyless',
      expectedWalletId: keylessWallet.id,
      scene: 'accountSelector',
    });
    expectReadyPlan(plan);
    expect(plan.presentation).toEqual({
      type: 'keylessOnly',
      currentProvider: EOAuthSocialLoginProvider.Google,
    });

    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: false,
      removedWalletId: keylessWallet.id,
    });

    expect(fixture.logoutPrimeServerSessionBestEffort).not.toHaveBeenCalled();
    expect(mockRevokeSupabaseSession).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith(
      expect.objectContaining({
        oneKeyId: undefined,
        keylessSession: undefined,
        keylessWalletSession: {
          walletId: keylessWallet.id,
          sessionCommitId: 'replacement-keyless-session',
        },
      }),
    );
  });

  test('provider switching reports the original Keyless identity error', async () => {
    const fixture = createFixture({
      source: EPrimeAuthSessionSource.KeylessOAuth,
    });
    fixture.backgroundApi.serviceKeylessWallet.validateTokenMatchesKeylessWallet.mockRejectedValue(
      new OneKeyLocalError('Keyless session owner lookup failed.'),
    );

    await expect(
      fixture.service.prepareIdentityExit({
        type: 'switchOAuth',
        expectedWalletId: keylessWallet.id,
        nextProvider: EOAuthSocialLoginProvider.Apple,
        scene: 'oneKeyIdLogin',
      }),
    ).resolves.toEqual({
      status: 'blocked',
      code: 'STATE_INCONSISTENT',
      message: 'Keyless session owner lookup failed.',
    });
  });

  test('state change after password returns blocked without a destructive write', async () => {
    const fixture = createFixture({ lifecycleRevisions: [10, 11] });
    const plan = await fixture.service.prepareIdentityExit({
      type: 'removeKeyless',
      expectedWalletId: keylessWallet.id,
      scene: 'accountSelector',
    });
    expectReadyPlan(plan);

    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toMatchObject({ status: 'blocked', code: 'STATE_CHANGED' });
    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toMatchObject({ status: 'blocked', code: 'STATE_CHANGED' });
    expect(fixture.promptPasswordVerifyByWallet).toHaveBeenCalledTimes(1);
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).not.toHaveBeenCalled();
    expect(fixture.setIdentityExitJournalEntry).not.toHaveBeenCalled();
  });

  test('password cancellation produces zero writes', async () => {
    const fixture = createFixture();
    fixture.promptPasswordVerifyByWallet.mockRejectedValue(
      new PasswordPromptDialogCancel(),
    );
    const plan = await fixture.service.prepareIdentityExit({
      type: 'removeKeyless',
      expectedWalletId: keylessWallet.id,
      scene: 'accountSelector',
    });
    expectReadyPlan(plan);

    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toEqual({ status: 'cancelled' });
    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toMatchObject({ status: 'blocked', code: 'STATE_CHANGED' });
    expect(fixture.promptPasswordVerifyByWallet).toHaveBeenCalledTimes(1);
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).not.toHaveBeenCalled();
    expect(fixture.setIdentityExitJournalEntry).not.toHaveBeenCalled();
  });

  test('evicts an unexecuted identity exit plan at its TTL', async () => {
    jest.useFakeTimers();
    try {
      const fixture = createFixture();
      const plan = await fixture.service.prepareIdentityExit({
        type: 'removeKeyless',
        expectedWalletId: keylessWallet.id,
        scene: 'accountSelector',
      });
      expectReadyPlan(plan);

      jest.advanceTimersByTime(5 * 60 * 1000);

      await expect(
        fixture.service.executeIdentityExit({
          planId: plan.planId,
          acknowledgement: 'keylessWalletRemoval',
        }),
      ).resolves.toMatchObject({ status: 'blocked', code: 'STATE_CHANGED' });
      expect(fixture.promptPasswordVerifyByWallet).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('evicts an executing identity exit plan from the registry at its TTL', async () => {
    jest.useFakeTimers();
    try {
      const fixture = createFixture();
      let resolvePassword: ((value: { password: string }) => void) | undefined;
      fixture.promptPasswordVerifyByWallet.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePassword = resolve;
          }),
      );
      const plan = await fixture.service.prepareIdentityExit({
        type: 'removeKeyless',
        expectedWalletId: keylessWallet.id,
        scene: 'accountSelector',
      });
      expectReadyPlan(plan);
      const firstExecution = fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      });
      await Promise.resolve();

      jest.advanceTimersByTime(5 * 60 * 1000);

      await expect(
        fixture.service.executeIdentityExit({
          planId: plan.planId,
          acknowledgement: 'keylessWalletRemoval',
        }),
      ).resolves.toMatchObject({ status: 'blocked', code: 'STATE_CHANGED' });
      resolvePassword?.({ password: 'encoded-password' });
      await expect(firstExecution).resolves.toMatchObject({
        status: 'completed',
        removedWalletId: keylessWallet.id,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test('malformed Keyless provider is blocked with the exact field error', async () => {
    const malformedWallet = {
      ...keylessWallet,
      keylessDetailsInfo: {
        ...keylessWallet.keylessDetailsInfo,
        keylessProvider: undefined,
      },
    } as unknown as IDBWallet;
    const fixture = createFixture({ wallet: malformedWallet });

    await expect(
      fixture.service.prepareIdentityExit({
        type: 'removeKeyless',
        expectedWalletId: keylessWallet.id,
        scene: 'oneKeyIdLogin',
      }),
    ).resolves.toEqual({
      status: 'blocked',
      code: 'KEYLESS_DATA_MALFORMED',
      message: 'Keyless wallet keylessDetailsInfo.keylessProvider is missing.',
    });
  });

  test('routes malformed account-selector removal through recovery and preserves independent Email OneKey ID', async () => {
    const malformedWallet = {
      ...keylessWallet,
      keylessDetailsInfo: {
        ...keylessWallet.keylessDetailsInfo,
        keylessProvider: undefined,
      },
    } as unknown as IDBWallet;
    const fixture = createFixture({ wallet: malformedWallet });

    const plan = await fixture.service.prepareIdentityExit({
      type: 'removeKeyless',
      expectedWalletId: malformedWallet.id,
      scene: 'accountSelector',
    });
    expectReadyPlan(plan);
    expect(plan.presentation).toEqual({
      type: 'recoverMalformedKeyless',
      oneKeyIdWillBeLoggedOut: false,
    });

    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: false,
      removedWalletId: malformedWallet.id,
      startIndependentOneKeyIdOAuth: undefined,
    });
    expect(fixture.promptPasswordVerifyByWallet).toHaveBeenCalledTimes(1);
    expect(
      fixture.removeMalformedKeylessWalletWithCapability,
    ).toHaveBeenCalledTimes(1);
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith({
      expectedIdentityLifecycleRevision: 10,
      oneKeyId: undefined,
      keylessSession: {
        sessionCommitId: 'keyless-session',
        sessionTokenSub: 'keyless-sub',
        allowUnknownIdentity: true,
      },
      keylessWalletSession: {
        walletId: malformedWallet.id,
        sessionCommitId: 'keyless-session',
      },
    });
  });

  test('routes a broad identity-managed wallet with an invalid isKeyless flag to recovery', async () => {
    const malformedWallet = {
      ...keylessWallet,
      isKeyless: false,
    } as IDBWallet;
    const fixture = createFixture({ wallet: malformedWallet });

    const plan = await fixture.service.prepareIdentityExit({
      type: 'removeKeyless',
      expectedWalletId: malformedWallet.id,
      scene: 'accountSelector',
    });

    expectReadyPlan(plan);
    expect(plan.presentation).toEqual({
      type: 'recoverMalformedKeyless',
      oneKeyIdWillBeLoggedOut: false,
    });
  });

  test('issues a OneKey ID OAuth handoff only after malformed Keyless removal completes', async () => {
    const malformedWallet = {
      ...keylessWallet,
      keylessDetailsInfo: {
        ...keylessWallet.keylessDetailsInfo,
        keylessOwnerId: undefined,
      },
    } as unknown as IDBWallet;
    const fixture = createFixture({ wallet: malformedWallet });
    jest.spyOn(primePersistAtom, 'get').mockResolvedValue({
      ...primePersistAtomInitialValue,
      isLoggedIn: false,
      isLoggedInOnServer: false,
    });
    fixture.backgroundApi.simpleDb.prime.getOneKeyIdAuthState.mockResolvedValue(
      'loggedOut',
    );
    fixture.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource.mockResolvedValue(
      undefined,
    );

    const plan = await fixture.service.prepareIdentityExit({
      type: 'recoverMalformedKeyless',
      expectedWalletId: malformedWallet.id,
      nextProvider: EOAuthSocialLoginProvider.Apple,
      scene: 'oneKeyIdLogin',
    });
    expectReadyPlan(plan);
    const receipt = await fixture.service.executeIdentityExit({
      planId: plan.planId,
      acknowledgement: 'keylessWalletRemoval',
    });

    expect(receipt).toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: false,
      removedWalletId: malformedWallet.id,
      startIndependentOneKeyIdOAuth: {
        provider: EOAuthSocialLoginProvider.Apple,
      },
    });
    expect(
      fixture.removeMalformedKeylessWalletWithCapability,
    ).toHaveBeenCalledTimes(1);
  });

  test('cancelling malformed Keyless password verification performs no deletion or OAuth handoff', async () => {
    const malformedWallet = {
      ...keylessWallet,
      keylessDetailsInfo: {
        ...keylessWallet.keylessDetailsInfo,
        keylessProvider: undefined,
      },
    } as unknown as IDBWallet;
    const fixture = createFixture({ wallet: malformedWallet });
    fixture.promptPasswordVerifyByWallet.mockRejectedValue(
      new PasswordPromptDialogCancel(),
    );

    const plan = await fixture.service.prepareIdentityExit({
      type: 'recoverMalformedKeyless',
      expectedWalletId: malformedWallet.id,
      nextProvider: EOAuthSocialLoginProvider.Apple,
      scene: 'keylessOnboarding',
    });
    expectReadyPlan(plan);
    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toEqual({ status: 'cancelled' });
    expect(
      fixture.removeMalformedKeylessWalletWithCapability,
    ).not.toHaveBeenCalled();
    expect(fixture.setIdentityExitJournalEntry).not.toHaveBeenCalled();
  });

  test('blocks malformed Keyless recovery when its fields change after password verification', async () => {
    const malformedWallet = {
      ...keylessWallet,
      keylessDetailsInfo: {
        ...keylessWallet.keylessDetailsInfo,
        keylessProvider: undefined,
      },
    } as unknown as IDBWallet;
    const changedMalformedWallet = {
      ...keylessWallet,
      keylessDetailsInfo: {
        ...keylessWallet.keylessDetailsInfo,
        keylessOwnerId: undefined,
      },
    } as unknown as IDBWallet;
    const fixture = createFixture({ wallet: malformedWallet });
    fixture.backgroundApi.serviceAccount.getIdentityManagedKeylessWalletCandidate
      .mockResolvedValueOnce(malformedWallet)
      .mockResolvedValueOnce(changedMalformedWallet);

    const plan = await fixture.service.prepareIdentityExit({
      type: 'recoverMalformedKeyless',
      expectedWalletId: malformedWallet.id,
      nextProvider: EOAuthSocialLoginProvider.Apple,
      scene: 'keylessOnboarding',
    });
    expectReadyPlan(plan);
    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toMatchObject({
      status: 'blocked',
      code: 'STATE_CHANGED',
    });
    expect(
      fixture.removeMalformedKeylessWalletWithCapability,
    ).not.toHaveBeenCalled();
  });

  test('fails closed when a historical session has no durable commit identity', async () => {
    const fixture = createFixture();
    fixture.backgroundApi.simpleDb.prime.getAuthSessionCommitId.mockResolvedValue(
      undefined,
    );

    await expect(
      fixture.service.prepareIdentityExit({
        type: 'logoutOneKeyId',
        scene: 'profile',
      }),
    ).resolves.toEqual({
      status: 'blocked',
      code: 'STATE_INCONSISTENT',
      message: 'OneKey ID session commit identity is unavailable.',
    });
  });

  test('deletes local identity only after the server confirms account deletion', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.deleteOneKeyIdAccount({
        uuid: 'delete-request-1',
        emailOTP: '123456',
      }),
    ).resolves.toEqual({
      ok: true,
      oneKeyIdLoggedOut: true,
      serverOutcome: 'confirmed',
      localStateCleared: true,
    });

    expect(fixture.deleteOneKeyIdAccountOnServer).toHaveBeenCalledWith({
      uuid: 'delete-request-1',
      emailOTP: '123456',
    });
    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).toHaveBeenCalledWith({
      callerName: 'accountDeletion',
      expectedIdentityLifecycleRevision: 10,
    });
    expect(
      fixture.setIdentityExitJournalEntry.mock.calls.map(
        ([entry]) => entry.status,
      ),
    ).toEqual([
      'serverDeletePrepared',
      'serverDeleteOutcomeUnknown',
      'serverDeleted',
      'localStateCommitted',
      'completed',
    ]);
  });

  test('clears local auth without claiming success when the server deletion outcome is unknown', async () => {
    const fixture = createFixture();
    const networkError = Object.assign(
      new Error('delete request disconnected'),
      { className: EOneKeyErrorClassNames.AxiosNetworkError },
    );
    fixture.deleteOneKeyIdAccountOnServer.mockRejectedValue(networkError);

    await expect(
      fixture.service.deleteOneKeyIdAccount({
        uuid: 'delete-request-1',
        emailOTP: '123456',
      }),
    ).resolves.toEqual({
      ok: false,
      oneKeyIdLoggedOut: true,
      serverOutcome: 'unknown',
      localStateCleared: true,
    });

    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).toHaveBeenCalledWith({
      callerName: 'accountDeletion',
      expectedIdentityLifecycleRevision: 10,
    });
    expect(fixture.journalState).toEqual({});
  });

  test('treats a timeout without a server response as an unknown deletion outcome', async () => {
    const fixture = createFixture();
    fixture.deleteOneKeyIdAccountOnServer.mockRejectedValue(
      Object.assign(new Error('request timed out'), {
        code: 'ECONNABORTED',
      }),
    );

    await expect(
      fixture.service.deleteOneKeyIdAccount({
        uuid: 'delete-request-1',
        emailOTP: '123456',
      }),
    ).resolves.toMatchObject({
      serverOutcome: 'unknown',
      localStateCleared: true,
    });
    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).toHaveBeenCalledTimes(1);
  });

  test('does not treat a timeout code with an HTTP response as ambiguous', async () => {
    const fixture = createFixture();
    const serverError = Object.assign(new Error('gateway timeout'), {
      code: 'ECONNABORTED',
      httpStatusCode: 504,
      response: { status: 504 },
    });
    fixture.deleteOneKeyIdAccountOnServer.mockRejectedValue(serverError);

    await expect(
      fixture.service.deleteOneKeyIdAccount({
        uuid: 'delete-request-1',
        emailOTP: '123456',
      }),
    ).rejects.toBe(serverError);
    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).not.toHaveBeenCalled();
  });

  test.each([
    new OneKeyServerApiError({
      message: 'Invalid verification code',
      code: 40_001,
      httpStatusCode: 200,
    }),
    new OneKeyServerApiError({
      message: 'Server error',
      code: 500,
      httpStatusCode: 500,
    }),
    new OneKeyLocalError('Unclassified account deletion failure'),
  ])(
    'preserves local identity when account deletion is definitively rejected',
    async (serverError) => {
      const fixture = createFixture();
      fixture.deleteOneKeyIdAccountOnServer.mockRejectedValue(serverError);

      await expect(
        fixture.service.deleteOneKeyIdAccount({
          uuid: 'delete-request-1',
          emailOTP: '123456',
        }),
      ).rejects.toBe(serverError);

      expect(
        fixture.clearAllIdentityAuthForExplicitOperation,
      ).not.toHaveBeenCalled();
      expect(fixture.journalState).toEqual({});
      expect(
        fixture.setIdentityExitJournalEntry.mock.calls.map(
          ([entry]) => entry.status,
        ),
      ).toContain('serverDeleteRejected');
    },
  );

  test('preserves local identity when the server returns a rejected result', async () => {
    const fixture = createFixture();
    fixture.deleteOneKeyIdAccountOnServer.mockResolvedValue({ ok: false });

    await expect(
      fixture.service.deleteOneKeyIdAccount({
        uuid: 'delete-request-1',
        emailOTP: '123456',
      }),
    ).resolves.toEqual({
      ok: false,
      oneKeyIdLoggedOut: false,
      serverOutcome: 'rejected',
      localStateCleared: false,
    });
    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).not.toHaveBeenCalled();
    expect(fixture.journalState).toEqual({});
  });

  test.each(['serverDeletePrepared', 'serverDeleteRejected'] as const)(
    'abandons %s recovery without clearing local identity',
    async (status) => {
      const journal: IIdentityExitJournalEntry = {
        operationId: `recover-${status}`,
        planId: `recover-${status}`,
        intentType: 'deleteOneKeyIdAccount',
        status,
        startedAt: 1,
        updatedAt: 2,
        expectedLifecycleRevision: 10,
        target: {
          logoutOneKeyId: true,
          removeKeyless: false,
          clearKeylessSession: true,
          clearAllIdentityAuth: true,
        },
      };
      const fixture = createFixture({
        journalEntries: { [journal.operationId]: journal },
      });

      await expect(
        fixture.service.recoverInterruptedIdentityExitOperations(),
      ).resolves.toEqual({
        recoveredOperationCount: 0,
        abandonedOperationCount: 1,
      });
      expect(
        fixture.clearAllIdentityAuthForExplicitOperation,
      ).not.toHaveBeenCalled();
      expect(fixture.journalState[journal.operationId]).toBeUndefined();
    },
  );

  test('settles rejected account-deletion recovery when terminal journal deletion rejects after deleting', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'recover-server-delete-rejected-delete-then-reject',
      planId: 'recover-server-delete-rejected-delete-then-reject',
      intentType: 'deleteOneKeyIdAccount',
      status: 'serverDeleteRejected',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: true,
        clearAllIdentityAuth: true,
      },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });
    fixture.removeIdentityExitJournalEntry.mockImplementationOnce(
      async ({ operationId }) => {
        delete fixture.journalState[operationId];
        throw new OneKeyLocalError(
          'Rejected account-deletion journal removal failed',
        );
      },
    );

    const recoveryResult = await fixture.service
      .recoverInterruptedIdentityExitOperations()
      .then(
        (value) => ({ status: 'resolved' as const, value }),
        (error: unknown) => ({
          status: 'rejected' as const,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    const readinessResult = await waitForIdentityMutationReady().then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({
        status: 'rejected' as const,
        message: error instanceof Error ? error.message : String(error),
      }),
    );

    expect({
      recoveryResult,
      readinessResult,
      recoveryReady: isIdentityRecoveryReady(),
    }).toEqual({
      recoveryResult: {
        status: 'resolved',
        value: {
          recoveredOperationCount: 0,
          abandonedOperationCount: 1,
        },
      },
      readinessResult: { status: 'resolved' },
      recoveryReady: true,
    });
    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).not.toHaveBeenCalled();
    expect(fixture.journalState).toEqual({});
  });

  test('recovers serverDeleteOutcomeUnknown by clearing authorized local auth', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'recover-server-delete-outcome-unknown',
      planId: 'recover-server-delete-outcome-unknown',
      intentType: 'deleteOneKeyIdAccount',
      status: 'serverDeleteOutcomeUnknown',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: true,
        clearAllIdentityAuth: true,
      },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 1,
      abandonedOperationCount: 0,
    });
    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).toHaveBeenCalledWith({
      callerName: 'accountDeletion',
      expectedIdentityLifecycleRevision: 10,
    });
    expect(fixture.journalState[journal.operationId]).toBeUndefined();
  });

  test('recovers local cleanup only from a confirmed serverDeleted phase', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'recover-server-deleted',
      planId: 'recover-server-deleted',
      intentType: 'deleteOneKeyIdAccount',
      status: 'serverDeleted',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: true,
        clearAllIdentityAuth: true,
      },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 1,
      abandonedOperationCount: 0,
    });
    expect(
      fixture.clearAllIdentityAuthForExplicitOperation,
    ).toHaveBeenCalledTimes(1);
    expect(fixture.journalState[journal.operationId]).toBeUndefined();
  });

  test('durably stages invalid-token reconciliation before lifecycle cleanup', async () => {
    const fixture = createFixture({
      source: EPrimeAuthSessionSource.KeylessOAuth,
      wallet: null,
    });

    const staged =
      await fixture.service.stageRemoteOneKeyIdLogoutReconciliation({
        expectedAccessToken: keylessToken,
      });
    expect(staged).toMatchObject({ staged: true });
    if (!staged.staged) {
      throw new OneKeyLocalError(
        'Expected invalid-token reconciliation to be staged',
      );
    }
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'executing',
      intentType: 'remoteOneKeyIdLogout',
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: true,
      },
    });

    await expect(
      fixture.service.executeIdentityExit({
        planId: staged.planId as IIdentityExitPlanId,
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith(
      expect.objectContaining({
        oneKeyId: expect.objectContaining({
          source: EPrimeAuthSessionSource.KeylessOAuth,
          sessionCommitId: 'keyless-session',
        }),
        keylessSession: {
          sessionCommitId: 'keyless-session',
          sessionTokenSub: 'keyless-sub',
        },
        keylessWalletSession: undefined,
      }),
    );
  });

  test('stages a WebSocket logout by message ID and retains its completed tombstone', async () => {
    const fixture = createFixture({ wallet: null });

    const staged = await fixture.service.stageRemoteOneKeyIdLogoutNotification({
      messageId: 'device-logout-message',
    });

    expect(staged).toEqual({
      operationId: 'remoteDeviceLogout:device-logout-message',
      planId: 'system:remoteDeviceLogout:device-logout-message',
      acknowledged: false,
      presentationHandled: false,
    });
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'executing',
      intentType: 'remoteOneKeyIdLogout',
      expectedLifecycleRevision: 10,
      oneKeyId: {
        source: EPrimeAuthSessionSource.LegacyEmailSupabase,
        sessionCommitId: 'email-session',
        sessionTokenSub: 'email-sub',
      },
      remoteDeviceLogout: {
        messageId: 'device-logout-message',
      },
    });

    await expect(
      fixture.service.executeIdentityExit({ planId: staged.planId }),
    ).resolves.toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'completed',
      completed: {
        oneKeyIdLoggedOut: true,
      },
      remoteDeviceLogout: {
        messageId: 'device-logout-message',
      },
    });
    await expect(
      fixture.service.getPendingRemoteOneKeyIdLogoutNotifications(),
    ).resolves.toEqual([
      {
        operationId: staged.operationId,
        planId: staged.planId,
        messageId: 'device-logout-message',
        needsAcknowledgement: true,
        needsPresentation: true,
      },
    ]);
    await expect(
      fixture.service.getPendingRemoteOneKeyIdLogoutPresentations(),
    ).resolves.toEqual([
      {
        operationId: staged.operationId,
        messageId: 'device-logout-message',
      },
    ]);

    await fixture.service.markRemoteOneKeyIdLogoutNotificationDelivered({
      operationId: staged.operationId,
      messageId: 'device-logout-message',
      delivery: 'acknowledged',
    });
    await fixture.service.markRemoteOneKeyIdLogoutNotificationDelivered({
      operationId: staged.operationId,
      messageId: 'device-logout-message',
      delivery: 'presentationHandled',
    });

    await expect(
      fixture.service.getPendingRemoteOneKeyIdLogoutNotifications(),
    ).resolves.toEqual([]);
    await expect(
      fixture.service.getPendingRemoteOneKeyIdLogoutPresentations(),
    ).resolves.toEqual([]);
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'completed',
      remoteDeviceLogout: {
        messageId: 'device-logout-message',
        acknowledgedAt: expect.any(Number),
        presentationHandledAt: expect.any(Number),
        tombstoneExpiresAt: expect.any(Number),
      },
    });
    await expect(
      fixture.service.stageRemoteOneKeyIdLogoutNotification({
        messageId: 'device-logout-message',
      }),
    ).resolves.toMatchObject({
      operationId: staged.operationId,
      planId: staged.planId,
      acknowledged: true,
      presentationHandled: true,
    });
    expect(fixture.ensureIdentityExitJournalEntry).toHaveBeenCalledTimes(1);
  });

  test('recovers an executing remote logout before listing pending presentations', async () => {
    const fixture = createFixture({ wallet: null });
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    const staged = await fixture.service.stageRemoteOneKeyIdLogoutNotification({
      messageId: 'presentation-bootstrap-message',
    });

    await expect(
      fixture.service.getPendingRemoteOneKeyIdLogoutPresentations(),
    ).resolves.toEqual([
      {
        operationId: staged.operationId,
        messageId: 'presentation-bootstrap-message',
      },
    ]);
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledTimes(1);
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'completed',
      completed: {
        oneKeyIdLoggedOut: true,
      },
    });
    expect(emitSpy).toHaveBeenCalledWith(EAppEventBusNames.PrimeDeviceLogout, {
      operationId: staged.operationId,
      messageId: 'presentation-bootstrap-message',
    });
  });

  test('stages an already-logged-out device notification as presentation handled', async () => {
    const fixture = createFixture({ wallet: null });
    fixture.backgroundApi.simpleDb.prime.getOneKeyIdAuthState.mockResolvedValue(
      'loggedOut',
    );
    fixture.backgroundApi.simpleDb.prime.getAuthSessionSource.mockResolvedValue(
      undefined,
    );
    fixture.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource.mockResolvedValue(
      undefined,
    );
    jest.spyOn(primePersistAtom, 'get').mockResolvedValue({
      ...primePersistAtomInitialValue,
      isLoggedIn: false,
      isLoggedInOnServer: false,
    });

    const staged = await fixture.service.stageRemoteOneKeyIdLogoutNotification({
      messageId: 'already-logged-out-message',
    });

    expect(staged).toMatchObject({
      acknowledged: false,
      presentationHandled: true,
    });
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'completed',
      completed: {
        oneKeyIdLoggedOut: false,
      },
      remoteDeviceLogout: {
        messageId: 'already-logged-out-message',
        presentationHandledAt: expect.any(Number),
      },
    });
  });

  test('settles older identity work before staging a remote logout', async () => {
    const pendingKeylessRemoval: IIdentityExitJournalEntry = {
      operationId: 'pending-keyless-removal',
      planId: 'pending-keyless-removal-plan',
      intentType: 'removeKeyless',
      status: 'walletRemoved',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        clearKeylessSession: false,
      },
      oneKeyId: {
        onekeyUserId: 'onekey-user-1',
        source: EPrimeAuthSessionSource.LegacyEmailSupabase,
        sessionCommitId: 'email-session',
        sessionTokenSub: 'email-sub',
      },
      keyless: {
        walletId: keylessWallet.id,
        ownerId: 'owner-1',
        provider: EOAuthSocialLoginProvider.Google,
        socialUserIdHash: 'social-hash-1',
        sessionCommitId: 'keyless-session',
        sessionTokenSub: 'keyless-sub',
      },
    };
    const fixture = createFixture({
      wallet: null,
      lifecycleRevisions: [10, 10, 11, 11, 11],
      journalEntries: {
        [pendingKeylessRemoval.operationId]: pendingKeylessRemoval,
      },
    });
    fixture.backgroundApi.simpleDb.prime.getKeylessSessionCommitId.mockResolvedValue(
      undefined,
    );
    fixture.commitIdentityExitLocalState
      .mockResolvedValueOnce({ status: 'committed', revision: 11 })
      .mockResolvedValueOnce({ status: 'committed', revision: 12 });

    const staged = await fixture.service.stageRemoteOneKeyIdLogoutNotification({
      messageId: 'logout-after-keyless-recovery',
    });

    expect(
      fixture.journalState[pendingKeylessRemoval.operationId],
    ).toBeUndefined();
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'executing',
      expectedLifecycleRevision: 11,
    });
    await expect(
      fixture.service.executeIdentityExit({ planId: staged.planId }),
    ).resolves.toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
  });

  test('does not stage while a competing identity recovery is pending', async () => {
    const fixture = createFixture({ wallet: null });
    const competingOperationId = 'competing-identity-operation';
    jest
      .spyOn(fixture.service, 'recoverInterruptedIdentityExitOperations')
      .mockImplementationOnce(async () => {
        markIdentityRecoveryPending(competingOperationId);
        return {
          recoveredOperationCount: 0,
          abandonedOperationCount: 0,
        };
      });

    let stageSettled = false;
    const stagePromise = fixture.service
      .stageRemoteOneKeyIdLogoutNotification({
        messageId: 'logout-during-competing-recovery',
      })
      .finally(() => {
        stageSettled = true;
      });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    try {
      expect(stageSettled).toBe(false);
      expect(fixture.ensureIdentityExitJournalEntry).not.toHaveBeenCalled();
    } finally {
      markIdentityRecoveryReady(competingOperationId);
    }
    await expect(stagePromise).resolves.toMatchObject({
      operationId: 'remoteDeviceLogout:logout-during-competing-recovery',
    });
  });

  test('does not list presentations while a competing identity recovery is pending', async () => {
    const completedRemoteLogout: IIdentityExitJournalEntry = {
      operationId: 'remoteDeviceLogout:pending-presentation',
      planId: 'system:remoteDeviceLogout:pending-presentation',
      intentType: 'remoteOneKeyIdLogout',
      status: 'completed',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      committedLifecycleRevision: 11,
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: false,
      },
      completed: {
        oneKeyIdLoggedOut: true,
      },
      remoteDeviceLogout: {
        messageId: 'pending-presentation',
      },
    };
    const fixture = createFixture({
      wallet: null,
      journalEntries: {
        [completedRemoteLogout.operationId]: completedRemoteLogout,
      },
    });
    const competingOperationId = 'competing-presentation-operation';
    jest
      .spyOn(fixture.service, 'recoverInterruptedIdentityExitOperations')
      .mockImplementationOnce(async () => {
        markIdentityRecoveryPending(competingOperationId);
        return {
          recoveredOperationCount: 0,
          abandonedOperationCount: 0,
        };
      });

    let querySettled = false;
    const queryPromise = fixture.service
      .getPendingRemoteOneKeyIdLogoutPresentations()
      .finally(() => {
        querySettled = true;
      });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    try {
      expect(querySettled).toBe(false);
    } finally {
      markIdentityRecoveryReady(competingOperationId);
    }
    await expect(queryPromise).resolves.toEqual([
      {
        operationId: completedRemoteLogout.operationId,
        messageId: 'pending-presentation',
      },
    ]);
  });

  test('never ACK-enables an optimistic WebSocket journal after its durable write rejects', async () => {
    const fixture = createFixture({ wallet: null });
    const storageError = new OneKeyLocalError(
      'Remote logout journal storage write failed',
    );
    fixture.ensureIdentityExitJournalEntry.mockImplementationOnce(
      async (entry) => {
        fixture.journalState[entry.operationId] = entry;
        throw storageError;
      },
    );

    await expect(
      fixture.service.stageRemoteOneKeyIdLogoutNotification({
        messageId: 'ambiguous-device-logout',
      }),
    ).rejects.toBe(storageError);
    await expect(
      fixture.service.stageRemoteOneKeyIdLogoutNotification({
        messageId: 'ambiguous-device-logout',
      }),
    ).rejects.toThrow('Identity journal storage outcome is unknown');
    await expect(
      fixture.service.getPendingRemoteOneKeyIdLogoutNotifications(),
    ).rejects.toThrow('Identity journal storage outcome is unknown');
    expect(fixture.ensureIdentityExitJournalEntry).toHaveBeenCalledTimes(1);
  });

  test('recovers a staged WebSocket logout after the first processing attempt fails', async () => {
    const fixture = createFixture({ wallet: null });
    const staged = await fixture.service.stageRemoteOneKeyIdLogoutNotification({
      messageId: 'retry-device-logout',
    });
    const transientError = new OneKeyLocalError(
      'Identity local commit is temporarily unavailable',
    );
    fixture.commitIdentityExitLocalState.mockRejectedValue(transientError);

    await expect(
      fixture.service.executeIdentityExit({ planId: staged.planId }),
    ).rejects.toBe(transientError);
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'executing',
      remoteDeviceLogout: {
        messageId: 'retry-device-logout',
      },
    });

    resetIdentityExitRegistriesForTest();
    resetIdentityRecoveryStateForTest('ready');
    fixture.commitIdentityExitLocalState.mockResolvedValue({
      status: 'committed',
      revision: 11,
    });
    const restartedService = new ServiceIdentityExit({
      backgroundApi: fixture.backgroundApi,
    });

    await expect(
      restartedService.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 1,
      abandonedOperationCount: 0,
    });
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      status: 'completed',
      completed: {
        oneKeyIdLoggedOut: true,
      },
    });
  });

  test('settles a stale WebSocket logout without clearing a newer identity session', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'remoteDeviceLogout:stale-message',
      planId: 'system:remoteDeviceLogout:stale-message',
      intentType: 'remoteOneKeyIdLogout',
      status: 'executing',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: false,
      },
      oneKeyId: {
        onekeyUserId: 'old-onekey-user',
        source: EPrimeAuthSessionSource.LegacyEmailSupabase,
        sessionCommitId: 'old-email-session',
        sessionTokenSub: 'old-email-sub',
      },
      remoteDeviceLogout: {
        messageId: 'stale-message',
      },
    };
    const fixture = createFixture({
      lifecycleRevisions: [11],
      journalEntries: {
        [journal.operationId]: journal,
      },
    });

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 1,
      abandonedOperationCount: 0,
    });
    expect(fixture.commitIdentityExitLocalState).not.toHaveBeenCalled();
    expect(fixture.journalState[journal.operationId]).toMatchObject({
      status: 'completed',
      completed: {
        oneKeyIdLoggedOut: false,
      },
      remoteDeviceLogout: {
        messageId: 'stale-message',
        presentationHandledAt: expect.any(Number),
      },
    });
  });

  test('remote OneKey ID logout preserves an unknown-linkage Keyless association', async () => {
    const fixture = createFixture({
      source: EPrimeAuthSessionSource.KeylessOAuth,
    });
    fixture.backgroundApi.simpleDb.prime.getKeylessSessionCommitId.mockResolvedValue(
      'replacement-keyless-session',
    );

    const staged =
      await fixture.service.stageRemoteOneKeyIdLogoutReconciliation({
        expectedAccessToken: keylessToken,
      });
    expect(staged).toMatchObject({ staged: true });
    if (!staged.staged) {
      throw new OneKeyLocalError(
        'Expected invalid-token reconciliation to be staged',
      );
    }
    expect(fixture.journalState[staged.operationId]).toMatchObject({
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: false,
      },
    });

    await expect(
      fixture.service.executeIdentityExit({ planId: staged.planId }),
    ).resolves.toMatchObject({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith(
      expect.objectContaining({
        oneKeyId: expect.objectContaining({
          source: EPrimeAuthSessionSource.KeylessOAuth,
        }),
        keylessSession: undefined,
        keylessWalletSession: undefined,
      }),
    );
  });

  test('abandons a stale durable invalid-token request instead of clearing a new login', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'invalid-token-stale',
      planId: 'system:invalid-token-stale',
      intentType: 'remoteOneKeyIdLogout',
      status: 'executing',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      target: {
        logoutOneKeyId: true,
        removeKeyless: false,
        clearKeylessSession: false,
      },
      oneKeyId: {
        onekeyUserId: 'onekey-user-1',
        source: EPrimeAuthSessionSource.LegacyEmailSupabase,
        sessionCommitId: 'email-session',
        sessionTokenSub: 'email-sub',
      },
    };
    const fixture = createFixture({
      lifecycleRevisions: [11],
      journalEntries: { [journal.operationId]: journal },
    });

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 0,
      abandonedOperationCount: 1,
    });
    expect(fixture.commitIdentityExitLocalState).not.toHaveBeenCalled();
    expect(fixture.journalState[journal.operationId]).toBeUndefined();
  });

  test('recovers walletRemoved without another password or wallet deletion', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'recover-wallet-removed',
      planId: 'recover-wallet-removed-plan',
      intentType: 'removeKeyless',
      status: 'walletRemoved',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      target: { logoutOneKeyId: false, removeKeyless: true },
      oneKeyId: {
        onekeyUserId: 'onekey-user-1',
        source: EPrimeAuthSessionSource.LegacyEmailSupabase,
        sessionCommitId: 'email-session',
        sessionTokenSub: 'email-sub',
      },
      keyless: {
        walletId: keylessWallet.id,
        ownerId: 'owner-1',
        provider: EOAuthSocialLoginProvider.Google,
        socialUserIdHash: 'social-hash-1',
        sessionCommitId: 'keyless-session',
        sessionTokenSub: 'keyless-sub',
      },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });
    fixture.backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue(
      undefined,
    );
    fixture.backgroundApi.serviceAccount.getIdentityManagedKeylessWalletCandidate.mockResolvedValue(
      undefined,
    );

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 1,
      abandonedOperationCount: 0,
    });
    expect(fixture.promptPasswordVerifyByWallet).not.toHaveBeenCalled();
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledTimes(1);
    expect(fixture.journalState[journal.operationId]).toBeUndefined();
  });

  test('recovery preserves OneKey ID session for an unknown-linkage Keyless removal', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'recover-unknown-linkage-wallet-removed',
      planId: 'recover-unknown-linkage-wallet-removed-plan',
      intentType: 'removeKeyless',
      status: 'walletRemoved',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        clearKeylessSession: false,
      },
      oneKeyId: {
        onekeyUserId: 'onekey-user-1',
        source: EPrimeAuthSessionSource.KeylessOAuth,
        sessionCommitId: 'keyless-session',
        sessionTokenSub: 'keyless-sub',
      },
      keyless: {
        walletId: keylessWallet.id,
        ownerId: 'owner-1',
        provider: EOAuthSocialLoginProvider.Google,
        socialUserIdHash: 'social-hash-1',
        sessionCommitId: 'keyless-session',
        sessionTokenSub: 'keyless-sub',
        walletSessionCommitId: 'replacement-keyless-session',
      },
    };
    const fixture = createFixture({
      source: EPrimeAuthSessionSource.KeylessOAuth,
      journalEntries: { [journal.operationId]: journal },
    });
    fixture.backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue(
      undefined,
    );

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 1,
      abandonedOperationCount: 0,
    });

    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledWith({
      expectedIdentityLifecycleRevision: 10,
      oneKeyId: undefined,
      keylessSession: undefined,
      keylessWalletSession: {
        walletId: keylessWallet.id,
        sessionCommitId: 'replacement-keyless-session',
      },
    });
  });

  test('repairs credentials when restart observes executing with the wallet already absent', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'recover-executing',
      planId: 'recover-executing-plan',
      intentType: 'removeKeyless',
      status: 'executing',
      startedAt: 1,
      updatedAt: 1,
      expectedLifecycleRevision: 10,
      target: { logoutOneKeyId: false, removeKeyless: true },
      keyless: {
        walletId: keylessWallet.id,
        ownerId: 'owner-1',
        provider: EOAuthSocialLoginProvider.Google,
        socialUserIdHash: 'social-hash-1',
        sessionCommitId: 'keyless-session',
        sessionTokenSub: 'keyless-sub',
      },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });
    fixture.backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue(
      undefined,
    );

    fixture.finalizeRemovedKeylessWalletSideEffects.mockRejectedValue(
      new Error('DApp cleanup failed'),
    );

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 1,
      abandonedOperationCount: 0,
    });

    expect(
      fixture.finalizeRemovedKeylessWalletSideEffects,
    ).toHaveBeenCalledWith({ walletId: keylessWallet.id });
    expect(
      fixture.cleanupChildBotWalletsForRemovedKeylessParent,
    ).toHaveBeenCalledWith({ walletId: keylessWallet.id });
    expect(fixture.cleanupKeylessWalletCredentialStorage).toHaveBeenCalledWith({
      ownerId: 'owner-1',
    });
    expect(
      fixture.cleanupChildBotWalletsForRemovedKeylessParent.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      fixture.cleanupKeylessWalletCredentialStorage.mock.invocationCallOrder[0],
    );
    expect(
      fixture.commitIdentityExitLocalState.mock.invocationCallOrder[0],
    ).toBeLessThan(
      fixture.finalizeRemovedKeylessWalletSideEffects.mock
        .invocationCallOrder[0],
    );
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(fixture.journalState[journal.operationId]).toBeUndefined();
  });

  test('does not roll back a completed exit when post-delete side effects fail', async () => {
    const fixture = createFixture();
    fixture.finalizeRemovedKeylessWalletSideEffects.mockRejectedValue(
      new Error('Cloud cleanup failed'),
    );
    const plan = await fixture.service.prepareIdentityExit({
      type: 'removeKeyless',
      expectedWalletId: keylessWallet.id,
      scene: 'accountSelector',
    });
    expectReadyPlan(plan);

    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      removedWalletId: keylessWallet.id,
    });
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledTimes(1);
    expect(
      Object.values(fixture.journalState).find(
        (entry) => entry.planId === plan.planId,
      ),
    ).toBeUndefined();
  });

  test('recovers critical owner credentials after the wallet row was removed', async () => {
    const fixture = createFixture();
    fixture.cleanupKeylessWalletCredentialStorage
      .mockRejectedValueOnce(new Error('Credential storage unavailable'))
      .mockResolvedValueOnce(undefined);
    fixture.backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue(
      undefined,
    );
    const plan = await fixture.service.prepareIdentityExit({
      type: 'removeKeyless',
      expectedWalletId: keylessWallet.id,
      scene: 'accountSelector',
    });
    expectReadyPlan(plan);

    await expect(
      fixture.service.executeIdentityExit({
        planId: plan.planId,
        acknowledgement: 'keylessWalletRemoval',
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      removedWalletId: keylessWallet.id,
    });
    expect(fixture.promptPasswordVerifyByWallet).toHaveBeenCalledTimes(1);
    expect(fixture.removeKeylessWalletWithCapability).toHaveBeenCalledTimes(1);
    expect(fixture.cleanupKeylessWalletCredentialStorage).toHaveBeenCalledTimes(
      2,
    );
    expect(fixture.commitIdentityExitLocalState).toHaveBeenCalledTimes(1);
  });

  test('abandons a pre-destructive journal when restart still sees the exact wallet', async () => {
    const journal: IIdentityExitJournalEntry = {
      operationId: 'recover-wallet-still-present',
      planId: 'recover-wallet-still-present-plan',
      intentType: 'removeKeyless',
      status: 'executing',
      startedAt: 1,
      updatedAt: 1,
      expectedLifecycleRevision: 10,
      target: { logoutOneKeyId: false, removeKeyless: true },
      keyless: {
        walletId: keylessWallet.id,
        ownerId: 'owner-1',
        provider: EOAuthSocialLoginProvider.Google,
        socialUserIdHash: 'social-hash-1',
      },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });

    await expect(
      fixture.service.recoverInterruptedIdentityExitOperations(),
    ).resolves.toEqual({
      recoveredOperationCount: 0,
      abandonedOperationCount: 1,
    });
    expect(fixture.promptPasswordVerifyByWallet).not.toHaveBeenCalled();
    expect(fixture.removeKeylessWalletWithCapability).not.toHaveBeenCalled();
    expect(fixture.commitIdentityExitLocalState).not.toHaveBeenCalled();
    expect(fixture.journalState[journal.operationId]).toBeUndefined();
  });

  test('restores a completed receipt by plan ID after a BG restart', async () => {
    const planId = 'completed-plan-after-restart' as IIdentityExitPlanId;
    const journal: IIdentityExitJournalEntry = {
      operationId: 'completed-operation-after-restart',
      planId,
      intentType: 'logoutOneKeyId',
      status: 'completed',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      committedLifecycleRevision: 11,
      target: { logoutOneKeyId: true, removeKeyless: false },
      completed: { oneKeyIdLoggedOut: true },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });

    await expect(
      fixture.service.executeIdentityExit({ planId }),
    ).resolves.toEqual({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    expect(fixture.commitIdentityExitLocalState).not.toHaveBeenCalled();
    expect(fixture.journalState[journal.operationId]).toBeUndefined();
  });

  test('keeps startup recovery ready when completed-journal cleanup fails', async () => {
    const planId = 'completed-plan-with-cleanup-failure' as IIdentityExitPlanId;
    const journal: IIdentityExitJournalEntry = {
      operationId: 'completed-operation-with-cleanup-failure',
      planId,
      intentType: 'logoutOneKeyId',
      status: 'completed',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      committedLifecycleRevision: 11,
      target: { logoutOneKeyId: true, removeKeyless: false },
      completed: { oneKeyIdLoggedOut: true },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });
    fixture.removeIdentityExitJournalEntry.mockRejectedValueOnce(
      new OneKeyLocalError('Completed journal cleanup failed during recovery'),
    );

    const recoveryResult = await fixture.service
      .recoverInterruptedIdentityExitOperations()
      .then(
        (value) => ({ status: 'resolved' as const, value }),
        (error: unknown) => ({
          status: 'rejected' as const,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    const receipt = await fixture.service.executeIdentityExit({ planId });

    expect({
      recoveryResult,
      receipt: {
        status: receipt.status,
        oneKeyIdLoggedOut:
          receipt.status === 'completed'
            ? receipt.oneKeyIdLoggedOut
            : undefined,
      },
      recoveryReady: isIdentityRecoveryReady(),
    }).toEqual({
      recoveryResult: {
        status: 'resolved',
        value: {
          recoveredOperationCount: 0,
          abandonedOperationCount: 0,
        },
      },
      receipt: {
        status: 'completed',
        oneKeyIdLoggedOut: true,
      },
      recoveryReady: true,
    });
    expect(fixture.journalState[journal.operationId]).toEqual(journal);
  });

  test('removes an expired OAuth handoff journal without replaying its continuation', async () => {
    const planId = 'expired-handoff-plan' as IIdentityExitPlanId;
    const journal: IIdentityExitJournalEntry = {
      operationId: 'expired-handoff-operation',
      planId,
      intentType: 'switchOAuth',
      status: 'completed',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      committedLifecycleRevision: 11,
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        switchOAuthProvider: EOAuthSocialLoginProvider.Apple,
      },
      keyless: {
        walletId: keylessWallet.id,
      },
      completed: {
        oneKeyIdLoggedOut: false,
        removedWalletId: keylessWallet.id,
        oauthHandoff: 'expired-handoff',
        oauthProvider: EOAuthSocialLoginProvider.Apple,
        oauthHandoffExpiresAt: Date.now() - 1,
        oauthExpectedLifecycleRevision: 11,
      },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });

    await fixture.service.recoverInterruptedIdentityExitOperations();

    expect(fixture.journalState[journal.operationId]).toBeUndefined();
    await expect(
      fixture.service.executeIdentityExit({ planId }),
    ).resolves.toEqual({
      status: 'completed',
      oneKeyIdLoggedOut: false,
      removedWalletId: keylessWallet.id,
      startIndependentOneKeyIdOAuth: undefined,
    });
  });

  test('actively removes a live OAuth handoff journal when its TTL expires', async () => {
    jest.useFakeTimers();
    try {
      const fixture = createFixture();
      fixture.backgroundApi.simpleDb.prime.getOneKeyIdAuthState.mockResolvedValue(
        'loggedOut',
      );
      fixture.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource.mockResolvedValue(
        undefined,
      );
      jest.spyOn(primePersistAtom, 'get').mockResolvedValue({
        ...primePersistAtomInitialValue,
        isLoggedIn: false,
        isLoggedInOnServer: false,
      });
      const plan = await fixture.service.prepareIdentityExit({
        type: 'switchOAuth',
        expectedWalletId: keylessWallet.id,
        nextProvider: EOAuthSocialLoginProvider.Apple,
        scene: 'oneKeyIdLogin',
      });
      expectReadyPlan(plan);

      await expect(
        fixture.service.executeIdentityExit({
          planId: plan.planId,
          acknowledgement: 'keylessWalletRemoval',
        }),
      ).resolves.toMatchObject({
        status: 'completed',
        startIndependentOneKeyIdOAuth: {
          provider: EOAuthSocialLoginProvider.Apple,
        },
      });
      expect(Object.values(fixture.journalState)).toHaveLength(1);

      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(fixture.journalState).toEqual({});
    } finally {
      jest.useRealTimers();
    }
  });

  test('persists a single OAuth handoff when recovering localStateCommitted', async () => {
    const planId = 'switch-plan-after-restart' as IIdentityExitPlanId;
    const journal: IIdentityExitJournalEntry = {
      operationId: 'switch-operation-after-restart',
      planId,
      intentType: 'switchOAuth',
      status: 'localStateCommitted',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      committedLifecycleRevision: 11,
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        switchOAuthProvider: EOAuthSocialLoginProvider.Apple,
      },
      keyless: {
        walletId: keylessWallet.id,
        ownerId: 'owner-1',
        provider: EOAuthSocialLoginProvider.Google,
        socialUserIdHash: 'social-hash-1',
      },
    };
    const fixture = createFixture({
      journalEntries: { [journal.operationId]: journal },
    });

    await fixture.service.recoverInterruptedIdentityExitOperations();
    const firstReceipt = await fixture.service.executeIdentityExit({ planId });
    const secondService = new ServiceIdentityExit({
      backgroundApi: fixture.backgroundApi,
    });
    const secondReceipt = await secondService.executeIdentityExit({ planId });

    expect(firstReceipt).toEqual(secondReceipt);
    expect(firstReceipt).toMatchObject({
      status: 'completed',
      startIndependentOneKeyIdOAuth: {
        provider: EOAuthSocialLoginProvider.Apple,
      },
    });
  });

  test('consuming an OAuth handoff atomically removes its persisted journal', async () => {
    const handoff = 'persisted-one-time-handoff' as IIdentityExitOAuthHandoff;
    const journal: IIdentityExitJournalEntry = {
      operationId: 'handoff-operation',
      planId: 'handoff-plan',
      intentType: 'switchOAuth',
      status: 'completed',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      committedLifecycleRevision: 11,
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        switchOAuthProvider: EOAuthSocialLoginProvider.Apple,
      },
      keyless: {
        walletId: keylessWallet.id,
        ownerId: 'owner-1',
        provider: EOAuthSocialLoginProvider.Google,
        socialUserIdHash: 'social-hash-1',
      },
      completed: {
        oneKeyIdLoggedOut: false,
        removedWalletId: keylessWallet.id,
        oauthHandoff: handoff,
        oauthProvider: EOAuthSocialLoginProvider.Apple,
        oauthHandoffExpiresAt: Date.now() + 60_000,
        oauthExpectedLifecycleRevision: 11,
      },
    };
    const fixture = createFixture({
      lifecycleRevisions: [11],
      journalEntries: { [journal.operationId]: journal },
    });
    fixture.backgroundApi.simpleDb.prime.getOneKeyIdAuthState.mockResolvedValue(
      'loggedOut',
    );
    fixture.backgroundApi.simpleDb.prime.getAuthSessionSource.mockResolvedValue(
      undefined,
    );
    fixture.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource.mockResolvedValue(
      undefined,
    );
    fixture.backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue(
      undefined,
    );
    fixture.backgroundApi.serviceAccount.getIdentityManagedKeylessWalletCandidate.mockResolvedValue(
      undefined,
    );
    jest.spyOn(primePersistAtom, 'get').mockResolvedValue({
      ...primePersistAtomInitialValue,
      isLoggedIn: false,
      isLoggedInOnServer: false,
    });
    mockReadSession.mockResolvedValue({ status: 'empty' });

    await fixture.service.recoverInterruptedIdentityExitOperations();
    await fixture.service.consumeOAuthHandoffForLogin({
      handoff,
      provider: EOAuthSocialLoginProvider.Apple,
    });
    await expect(
      new ServiceIdentityExit({
        backgroundApi: fixture.backgroundApi,
      }).consumeOAuthHandoffForLogin({
        handoff,
        provider: EOAuthSocialLoginProvider.Apple,
      }),
    ).rejects.toThrow('was not found');
    expect(fixture.consumeIdentityExitOAuthHandoff).toHaveBeenCalledTimes(1);
    expect(fixture.journalState).toEqual({});
    await expect(
      fixture.service.executeIdentityExit({
        planId: journal.planId as IIdentityExitPlanId,
      }),
    ).resolves.toMatchObject({
      status: 'blocked',
      code: 'STATE_CHANGED',
    });
  });

  test('fails closed when OAuth handoff consumption has an unknown storage outcome', async () => {
    const handoff = 'uncertain-consume-handoff' as IIdentityExitOAuthHandoff;
    const journal: IIdentityExitJournalEntry = {
      operationId: 'uncertain-consume-operation',
      planId: 'uncertain-consume-plan',
      intentType: 'switchOAuth',
      status: 'completed',
      startedAt: 1,
      updatedAt: 2,
      expectedLifecycleRevision: 10,
      committedLifecycleRevision: 11,
      target: {
        logoutOneKeyId: false,
        removeKeyless: true,
        switchOAuthProvider: EOAuthSocialLoginProvider.Apple,
      },
      keyless: {
        walletId: keylessWallet.id,
      },
      completed: {
        oneKeyIdLoggedOut: false,
        removedWalletId: keylessWallet.id,
        oauthHandoff: handoff,
        oauthProvider: EOAuthSocialLoginProvider.Apple,
        oauthHandoffExpiresAt: Date.now() + 60_000,
        oauthExpectedLifecycleRevision: 11,
      },
    };
    const fixture = createFixture({
      lifecycleRevisions: [11],
      journalEntries: { [journal.operationId]: journal },
    });
    fixture.backgroundApi.simpleDb.prime.getOneKeyIdAuthState.mockResolvedValue(
      'loggedOut',
    );
    fixture.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource.mockResolvedValue(
      undefined,
    );
    fixture.backgroundApi.serviceAccount.getIdentityManagedKeylessWalletCandidate.mockResolvedValue(
      undefined,
    );
    jest.spyOn(primePersistAtom, 'get').mockResolvedValue({
      ...primePersistAtomInitialValue,
      isLoggedIn: false,
      isLoggedInOnServer: false,
    });
    mockReadSession.mockResolvedValue({ status: 'empty' });
    await fixture.service.recoverInterruptedIdentityExitOperations();
    const storageError = new OneKeyLocalError(
      'Handoff consume storage write failed',
    );
    fixture.consumeIdentityExitOAuthHandoff.mockImplementationOnce(async () => {
      delete fixture.journalState[journal.operationId];
      throw storageError;
    });

    await expect(
      fixture.service.consumeOAuthHandoffForLogin({
        handoff,
        provider: EOAuthSocialLoginProvider.Apple,
      }),
    ).rejects.toBe(storageError);
    await expect(
      fixture.service.executeIdentityExit({
        planId: journal.planId as IIdentityExitPlanId,
      }),
    ).rejects.toThrow('Identity journal storage outcome is unknown');
  });
});

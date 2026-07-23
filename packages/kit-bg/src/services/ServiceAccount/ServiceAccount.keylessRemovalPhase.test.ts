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

jest.mock('@onekeyhq/core/src/secret', () => {
  const actual = jest.requireActual<typeof import('@onekeyhq/core/src/secret')>(
    '@onekeyhq/core/src/secret',
  );
  return {
    ...actual,
    decryptRevealableSeed: jest.fn(),
    ensureSensitiveTextEncoded: jest.fn(),
  };
});

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/timerUtils')
  >('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      wait: jest.fn(async () => undefined),
    },
  };
});

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    clearStoreCachedData: jest.fn(),
    createHDWallet: jest.fn(),
    getAllWallets: jest.fn(),
    getWalletSafe: jest.fn(),
    removeWallet: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    botWallet: {
      getBotWalletsForParent: jest.fn(),
      removeMetadata: jest.fn(),
    },
  },
}));

jest.mock('../../states/jotai/atoms', () => {
  const actual = jest.requireActual<typeof import('../../states/jotai/atoms')>(
    '../../states/jotai/atoms',
  );
  return {
    ...actual,
    devSettingsPersistAtom: {
      get: jest.fn(async () => ({ enabled: false, settings: {} })),
      set: jest.fn(),
    },
  };
});

jest.mock('../ServiceKeylessWallet/utils/keylessSyncCredentialStorage', () => ({
  __esModule: true,
  default: {
    saveCredential: jest.fn(),
    getCredential: jest.fn(),
    removeAllCredentials: jest.fn(),
  },
}));

jest.mock('../ServicePrimeCloudSync/keylessCloudSyncUtils', () => ({
  __esModule: true,
  default: {
    deriveKeylessCredential: jest.fn(),
  },
}));

import { decryptRevealableSeed } from '@onekeyhq/core/src/secret';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

import localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';
import {
  identityLifecycleMutex,
  resetIdentityRecoveryStateForTest,
} from '../ServiceIdentityExit/identityLifecycleMutex';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import { createKeylessWalletRemovalCapability } from './keylessWalletRemovalCapability';
import ServiceAccount from './ServiceAccount';

import type { IDBWallet } from '../../dbs/local/types';

const expectedIdentity = {
  walletId: 'hd-keyless-1',
  keylessOwnerId: 'owner-1',
  keylessProvider: EOAuthSocialLoginProvider.Google,
  socialUserIdHash: 'social-hash-1',
};

const keylessWallet = {
  id: expectedIdentity.walletId,
  name: 'Keyless wallet',
  type: 'hd',
  backuped: true,
  accounts: [],
  nextIds: {},
  walletNo: 1,
  isKeyless: true,
  keylessDetailsInfo: {
    keylessOwnerId: expectedIdentity.keylessOwnerId,
    keylessProvider: expectedIdentity.keylessProvider,
    socialUserIdHash: expectedIdentity.socialUserIdHash,
  },
} as IDBWallet;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('ServiceAccount Keyless removal phase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetIdentityRecoveryStateForTest('ready');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('commits all authoritative Keyless creation resources inside the lifecycle critical section', async () => {
    jest.mocked(localDb).createHDWallet.mockResolvedValue({
      wallet: keylessWallet,
      indexedAccount: undefined,
    });
    jest.mocked(decryptRevealableSeed).mockResolvedValue({
      seed: '00',
    } as never);
    const credential = {
      keylessWalletId: keylessWallet.id,
      signingPrivateKey: 'signing-private-key',
      signingPublicKey: 'signing-public-key',
      encryptionKey: 'encryption-key',
      pwdHash: 'keyless-pwd-hash',
    };
    const credentialSaveStarted = createDeferred();
    const releaseCredentialSave = createDeferred();
    let isCredentialSaveCompleted = false;
    jest
      .mocked(keylessCloudSyncUtils.deriveKeylessCredential)
      .mockResolvedValue(credential);
    jest
      .mocked(keylessSyncCredentialStorage.saveCredential)
      .mockImplementation(async () => {
        credentialSaveStarted.resolve();
        await releaseCredentialSave.promise;
        isCredentialSaveCompleted = true;
      });

    const setKeylessSessionCommitId = jest.fn().mockResolvedValue(undefined);
    const bumpIdentityLifecycleRevision = jest.fn().mockResolvedValue(1);
    const setKeylessCloudSyncCredentialCache = jest.fn();
    const clearCachedSyncCredential = jest.fn().mockResolvedValue(undefined);
    const setPersistedCurrentCloudSyncKeylessWalletId = jest
      .fn()
      .mockResolvedValue(undefined);
    const syncNowKeyless = jest.fn().mockResolvedValue(undefined);
    const updateClientBasicAppInfoDebounced = jest
      .fn()
      .mockResolvedValue(undefined);
    const service = new ServiceAccount({
      backgroundApi: {
        simpleDb: {
          prime: {
            getAuthSessionCommitId: jest
              .fn()
              .mockResolvedValue('session-commit-1'),
            setKeylessSessionCommitId,
            bumpIdentityLifecycleRevision,
          },
        },
        serviceKeylessCloudSync: {
          setKeylessCloudSyncCredentialCache,
          setPersistedCurrentCloudSyncKeylessWalletId,
        },
        servicePrimeCloudSync: {
          clearCachedSyncCredential,
          syncNowKeyless,
        },
        serviceNotification: {
          updateClientBasicAppInfoDebounced,
        },
        servicePrimeTransfer: {
          isInTransferImportOrBackupRestoreFlow: jest
            .fn()
            .mockResolvedValue(true),
        },
      },
    });
    jest.spyOn(service, 'getKeylessWallet').mockResolvedValue(undefined);

    const creation = service.createHDWalletWithRs({
      rs: 'encrypted-revealable-seed',
      password: 'encoded-password',
      walletHash: '',
      walletXfp: '',
      isKeylessWallet: true,
      keylessDetailsInfo: keylessWallet.keylessDetailsInfo,
    });
    await credentialSaveStarted.promise;

    const competingIdentityMutation = identityLifecycleMutex.runExclusive(
      async () => {
        expect(isCredentialSaveCompleted).toBe(true);
        expect(
          setPersistedCurrentCloudSyncKeylessWalletId,
        ).toHaveBeenCalledWith(keylessWallet.id);
        expect(bumpIdentityLifecycleRevision).toHaveBeenCalledTimes(1);
      },
    );
    releaseCredentialSave.resolve();
    await Promise.all([creation, competingIdentityMutation]);

    expect(setKeylessSessionCommitId).toHaveBeenCalledWith({
      walletId: keylessWallet.id,
      sessionCommitId: 'session-commit-1',
    });
    expect(setKeylessCloudSyncCredentialCache).toHaveBeenCalledWith(credential);
    expect(setPersistedCurrentCloudSyncKeylessWalletId).toHaveBeenCalledWith(
      keylessWallet.id,
    );
    expect(bumpIdentityLifecycleRevision).toHaveBeenCalledTimes(1);
    expect(syncNowKeyless).toHaveBeenCalledTimes(1);
    expect(updateClientBasicAppInfoDebounced).toHaveBeenCalledTimes(1);
  });

  test('returns after child cascade and parent-row deletion without running post-delete side effects', async () => {
    const phaseOrder: string[] = [];
    jest
      .spyOn(simpleDb.botWallet, 'getBotWalletsForParent')
      .mockImplementation(async () => {
        phaseOrder.push('children');
        return [];
      });
    const removeWallet = jest
      .spyOn(localDb, 'removeWallet')
      .mockImplementation(async () => {
        phaseOrder.push('parent');
      });
    const service = new ServiceAccount({ backgroundApi: {} });
    jest.spyOn(service, 'getWalletSafe').mockResolvedValue(keylessWallet);
    const finalizeRemovedKeylessWalletSideEffects = jest
      .spyOn(service, 'finalizeRemovedKeylessWalletSideEffects')
      .mockRejectedValue(new Error('Cloud cleanup failed'));
    const operationId = 'operation-1';
    const lifecycleRevision = 7;
    const capability = createKeylessWalletRemovalCapability({
      expectedIdentity,
      operationId,
      lifecycleRevision,
    });

    await expect(
      service.removeKeylessWalletWithCapability({
        capability,
        expectedIdentity,
        operationId,
        lifecycleRevision,
      }),
    ).resolves.toBeUndefined();

    expect(phaseOrder).toEqual(['parent', 'children']);
    expect(removeWallet).toHaveBeenCalledWith({
      walletId: expectedIdentity.walletId,
    });
    expect(finalizeRemovedKeylessWalletSideEffects).not.toHaveBeenCalled();
  });

  test('continues independent post-delete side effects after earlier failures', async () => {
    jest.spyOn(localDb, 'getAllWallets').mockResolvedValue({ wallets: [] });
    const syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets = jest
      .fn()
      .mockRejectedValue(new Error('Cloud sync failed'));
    const clearCachedSyncCredential = jest.fn().mockResolvedValue(undefined);
    const removeDappConnectionAfterWalletRemove = jest
      .fn()
      .mockRejectedValue(new Error('DApp cleanup failed'));
    const updateClientBasicAppInfoDebounced = jest
      .fn()
      .mockResolvedValue(undefined);
    const removeBackupHDWallet = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceAccount({
      backgroundApi: {
        serviceKeylessCloudSync: {
          syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets,
        },
        servicePrimeCloudSync: { clearCachedSyncCredential },
        serviceDApp: { removeDappConnectionAfterWalletRemove },
        serviceNotification: { updateClientBasicAppInfoDebounced },
        serviceDBBackup: { removeBackupHDWallet },
      },
    });
    jest
      .spyOn(service, 'cleanupOrphanedHyperLiquidAgentCredentials')
      .mockRejectedValue(new Error('HyperLiquid cleanup failed'));

    await expect(
      service.finalizeRemovedKeylessWalletSideEffects({
        walletId: expectedIdentity.walletId,
      }),
    ).resolves.toBeUndefined();

    expect(clearCachedSyncCredential).toHaveBeenCalledTimes(1);
    expect(removeDappConnectionAfterWalletRemove).toHaveBeenCalledWith({
      walletId: expectedIdentity.walletId,
    });
    expect(updateClientBasicAppInfoDebounced).toHaveBeenCalledTimes(1);
    expect(removeBackupHDWallet).toHaveBeenCalledWith({
      walletId: expectedIdentity.walletId,
    });
  });

  test('keeps child metadata retryable when the local wallet row cannot be removed', async () => {
    const child = {
      walletId: 'hd-bot-1',
      metadata: { parentWalletId: expectedIdentity.walletId },
    };
    jest
      .spyOn(simpleDb.botWallet, 'getBotWalletsForParent')
      .mockResolvedValue([child] as never);
    jest.spyOn(localDb, 'getWalletSafe').mockResolvedValue(child as never);
    jest
      .spyOn(localDb, 'removeWallet')
      .mockRejectedValue(new Error('Local wallet removal failed'));
    const removeMetadata = jest.spyOn(simpleDb.botWallet, 'removeMetadata');
    const service = new ServiceAccount({ backgroundApi: {} });
    jest
      .spyOn(
        service as unknown as {
          syncBotWalletSyncItem: (params: unknown) => Promise<void>;
        },
        'syncBotWalletSyncItem',
      )
      .mockRejectedValue(new Error('Cloud tombstone failed'));

    await expect(
      service.cleanupChildBotWalletsForRemovedKeylessParent({
        walletId: expectedIdentity.walletId,
      }),
    ).rejects.toThrow('Local wallet removal failed');

    expect(removeMetadata).not.toHaveBeenCalled();
  });

  test('fails the critical phase when child metadata cleanup fails', async () => {
    const child = {
      walletId: 'hd-bot-1',
      metadata: { parentWalletId: expectedIdentity.walletId },
    };
    jest
      .spyOn(simpleDb.botWallet, 'getBotWalletsForParent')
      .mockResolvedValue([child] as never);
    jest.spyOn(localDb, 'getWalletSafe').mockResolvedValue(child as never);
    jest.spyOn(localDb, 'removeWallet').mockResolvedValue(undefined);
    jest
      .spyOn(simpleDb.botWallet, 'removeMetadata')
      .mockRejectedValue(new Error('Bot metadata removal failed'));
    const service = new ServiceAccount({ backgroundApi: {} });
    jest
      .spyOn(
        service as unknown as {
          syncBotWalletSyncItem: (params: unknown) => Promise<void>;
        },
        'syncBotWalletSyncItem',
      )
      .mockResolvedValue(undefined);

    await expect(
      service.cleanupChildBotWalletsForRemovedKeylessParent({
        walletId: expectedIdentity.walletId,
      }),
    ).rejects.toThrow('Bot metadata removal failed');
  });

  test('finishes child metadata cleanup when recovery finds the wallet row already absent', async () => {
    const child = {
      walletId: 'hd-bot-1',
      metadata: { parentWalletId: expectedIdentity.walletId },
    };
    jest
      .spyOn(simpleDb.botWallet, 'getBotWalletsForParent')
      .mockResolvedValue([child] as never);
    jest.spyOn(localDb, 'getWalletSafe').mockResolvedValue(undefined);
    const removeWallet = jest.spyOn(localDb, 'removeWallet');
    const removeMetadata = jest
      .spyOn(simpleDb.botWallet, 'removeMetadata')
      .mockResolvedValue(undefined);
    const service = new ServiceAccount({ backgroundApi: {} });
    jest
      .spyOn(
        service as unknown as {
          syncBotWalletSyncItem: (params: unknown) => Promise<void>;
        },
        'syncBotWalletSyncItem',
      )
      .mockResolvedValue(undefined);

    await expect(
      service.cleanupChildBotWalletsForRemovedKeylessParent({
        walletId: expectedIdentity.walletId,
      }),
    ).resolves.toBeUndefined();

    expect(removeWallet).not.toHaveBeenCalled();
    expect(removeMetadata).toHaveBeenCalledWith(child.walletId);
  });
});

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { getAccountSelectorWriteIntentEpoch } from './accountSelectorPersistenceGuard';
import { SimpleDbEntityAccountSelector } from './SimpleDbEntityAccountSelector';

import type {
  IAccountSelectorPersistInfo,
  IAccountSelectorSelectedAccount,
} from './SimpleDbEntityAccountSelector';

type IDeferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): IDeferred {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {
    promise,
    resolve: () => resolve?.(),
  };
}

function createSelectedAccount({
  indexedAccountId,
  networkId = 'evm--1',
  walletId,
}: {
  indexedAccountId: string;
  networkId?: string;
  walletId: string;
}): IAccountSelectorSelectedAccount {
  return {
    deriveType: 'default',
    focusedWallet: walletId,
    indexedAccountId,
    networkId,
    othersWalletAccountId: undefined,
    walletId,
  };
}

function createClearedSelectedAccount(
  networkId = 'evm--1',
): IAccountSelectorSelectedAccount {
  return {
    deriveType: 'default',
    focusedWallet: undefined,
    indexedAccountId: undefined,
    networkId,
    othersWalletAccountId: undefined,
    walletId: undefined,
  };
}

function createPersistInfo({
  home,
  swap,
}: {
  home?: IAccountSelectorSelectedAccount;
  swap?: IAccountSelectorSelectedAccount;
}): IAccountSelectorPersistInfo {
  return {
    globalDeriveTypesMap: {},
    selectorInfo: {
      ...(home
        ? {
            [EAccountSelectorSceneName.home]: {
              selector: { 0: home },
            },
          }
        : {}),
      ...(swap
        ? {
            [EAccountSelectorSceneName.swap]: {
              selector: { 0: swap },
            },
          }
        : {}),
    },
  };
}

async function createEntityWithPersistInfo(
  persistInfo: IAccountSelectorPersistInfo,
) {
  const entity = new SimpleDbEntityAccountSelector();
  entity.appStorage = {
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => undefined),
    setItem: jest.fn(async () => undefined),
  } as unknown as typeof entity.appStorage;
  await entity.setRawData(persistInfo);
  return entity;
}

describe('SimpleDbEntityAccountSelector unavailable selection CAS', () => {
  const unavailableSelection = createSelectedAccount({
    indexedAccountId: 'hd-1--0',
    walletId: 'hd-1',
  });
  const clearedSelection = createClearedSelectedAccount();
  const newerSelection = createSelectedAccount({
    indexedAccountId: 'hd-2--0',
    walletId: 'hd-2',
  });

  it('keeps a newer primary selection that committed while cleanup waited for the entity mutex', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: unavailableSelection }),
    );
    const newerWriteReached = createDeferred();
    const releaseNewerWrite = createDeferred();
    jest.mocked(entity.appStorage.setItem).mockImplementationOnce(async () => {
      newerWriteReached.resolve();
      await releaseNewerWrite.promise;
    });

    const newerWrite = entity.saveSelectedAccount({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: newerSelection,
    });
    await newerWriteReached.promise;
    const cleanup = entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: false,
    });
    releaseNewerWrite.resolve();

    await newerWrite;
    const cleanupResult = await cleanup;
    expect(cleanupResult.primaryMatched).toBe(false);
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(newerSelection);
  });

  it('matches normalized ownership and preserves the raw primary network context', async () => {
    const rawAllNetworksSelection = {
      ...unavailableSelection,
      deriveType: undefined,
      networkId: 'onekeyall',
    };
    const normalizedAllNetworksSelection = {
      ...rawAllNetworksSelection,
      deriveType: 'default' as const,
    };
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: rawAllNetworksSelection }),
    );

    const result = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: normalizedAllNetworksSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: createClearedSelectedAccount('onekeyall'),
      shouldSyncWithHomeSource: false,
    });

    expect(result).toMatchObject({
      primaryMatched: true,
      primaryPersisted: true,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual({
      ...createClearedSelectedAccount('onekeyall'),
      deriveType: undefined,
    });
  });

  it('rejects an ABA-matching selection from an older storage init generation', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: unavailableSelection }),
    );
    const olderGeneration = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.home,
    });
    await entity.saveSelectedAccount({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: newerSelection,
    });
    await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.home,
    });
    await entity.saveSelectedAccount({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: unavailableSelection,
    });

    const result = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: false,
      storageInitGeneration: olderGeneration,
    });

    expect(result).toMatchObject({
      primaryMatched: false,
      primaryPersisted: false,
      storageInitGenerationMatched: false,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(unavailableSelection);
  });

  it('lets a new storage init cancel cleanup while its persistence write is pending', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: unavailableSelection }),
    );
    const olderGeneration = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.home,
    });
    const cleanupWriteReached = createDeferred();
    const releaseCleanupWrite = createDeferred();
    jest.mocked(entity.appStorage.setItem).mockImplementationOnce(async () => {
      cleanupWriteReached.resolve();
      await releaseCleanupWrite.promise;
    });

    const cleanup = entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: false,
      storageInitGeneration: olderGeneration,
    });
    await cleanupWriteReached.promise;
    let newerInitResolved = false;
    const newerInit = entity
      .beginAccountSelectorStorageInit({
        sceneName: EAccountSelectorSceneName.home,
      })
      .then((generation) => {
        newerInitResolved = true;
        return generation;
      });
    await Promise.resolve();
    await Promise.resolve();
    const newerInitResolvedWhileWritePending = newerInitResolved;
    releaseCleanupWrite.resolve();

    const [cleanupResult] = await Promise.all([cleanup, newerInit]);
    expect(newerInitResolvedWhileWritePending).toBe(true);
    expect(cleanupResult).toMatchObject({
      primaryMatched: true,
      primaryPersisted: false,
      storageInitGenerationMatched: false,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(unavailableSelection);
  });

  it('lets a same-selection save intent cancel cleanup from an older init', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: unavailableSelection }),
    );
    const olderGeneration = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.home,
    });
    const cleanupWriteReached = createDeferred();
    const releaseCleanupWrite = createDeferred();
    jest.mocked(entity.appStorage.setItem).mockImplementationOnce(async () => {
      cleanupWriteReached.resolve();
      await releaseCleanupWrite.promise;
    });

    const cleanup = entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: false,
      storageInitGeneration: olderGeneration,
    });
    await cleanupWriteReached.promise;
    const sameSelectionSave = entity.saveSelectedAccount({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: unavailableSelection,
    });
    releaseCleanupWrite.resolve();

    const [cleanupResult] = await Promise.all([cleanup, sameSelectionSave]);
    expect(cleanupResult).toMatchObject({
      primaryMatched: true,
      primaryPersisted: false,
      storageInitGenerationMatched: false,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(unavailableSelection);
  });

  it('keeps one init generation valid across its own cleanup writes', async () => {
    const secondUnavailableSelection = createSelectedAccount({
      indexedAccountId: 'hd-1--1',
      walletId: 'hd-1',
    });
    const entity = await createEntityWithPersistInfo({
      globalDeriveTypesMap: {},
      selectorInfo: {
        [EAccountSelectorSceneName.home]: {
          selector: {
            0: unavailableSelection,
            1: secondUnavailableSelection,
          },
        },
      },
    });
    const generation = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.home,
    });

    const firstResult = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: false,
      storageInitGeneration: generation,
    });
    const secondResult = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: secondUnavailableSelection,
      num: 1,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: false,
      storageInitGeneration: generation,
    });

    expect(firstResult).toMatchObject({
      primaryPersisted: true,
      storageInitGenerationMatched: true,
    });
    expect(secondResult).toMatchObject({
      primaryPersisted: true,
      storageInitGenerationMatched: true,
    });
    await expect(
      entity.getSelectedAccountsMap({
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toMatchObject({
      0: clearedSelection,
      1: clearedSelection,
    });
  });

  it('keeps one swap init generation valid after its first home maintenance write', async () => {
    const secondUnavailableSelection = createSelectedAccount({
      indexedAccountId: 'hd-1--1',
      walletId: 'hd-1',
    });
    const entity = await createEntityWithPersistInfo({
      globalDeriveTypesMap: {},
      selectorInfo: {
        [EAccountSelectorSceneName.home]: {
          selector: { 0: unavailableSelection },
        },
        [EAccountSelectorSceneName.swap]: {
          selector: {
            0: unavailableSelection,
            1: secondUnavailableSelection,
          },
        },
      },
    });
    const generation = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.swap,
    });

    const firstResult = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: true,
      storageInitGeneration: generation,
    });
    const secondResult = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: secondUnavailableSelection,
      num: 1,
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: true,
      storageInitGeneration: generation,
    });

    expect(firstResult).toMatchObject({
      homeSelectionIntentMatched: true,
      primaryPersisted: true,
      storageInitGenerationMatched: true,
      syncedHome: true,
    });
    expect(secondResult).toMatchObject({
      homeSelectionIntentMatched: true,
      primaryPersisted: true,
      storageInitGenerationMatched: true,
    });
    await expect(
      entity.getSelectedAccountsMap({
        sceneName: EAccountSelectorSceneName.swap,
      }),
    ).resolves.toMatchObject({
      0: clearedSelection,
      1: clearedSelection,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(clearedSelection);
  });

  it('lets a valid user intent supersede an init that started afterward', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: unavailableSelection }),
    );
    const scope = {
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
    };
    const selectionIntentEpoch = await entity.recordSelectedAccountIntent({
      ...scope,
      selectedAccount: unavailableSelection,
    });
    const supersededGeneration = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.home,
    });

    const saveResult = await entity.saveSelectedAccount({
      ...scope,
      selectedAccount: unavailableSelection,
      selectionIntentEpoch,
    });
    const cleanupResult = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      ...scope,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: false,
      storageInitGeneration: supersededGeneration,
    });

    expect(saveResult).toMatchObject({ persisted: true });
    expect(getAccountSelectorWriteIntentEpoch(scope)).toBe(
      selectionIntentEpoch,
    );
    expect(cleanupResult).toMatchObject({
      primaryMatched: false,
      primaryPersisted: false,
      storageInitGenerationMatched: false,
    });
    await expect(entity.getSelectedAccount(scope)).resolves.toEqual(
      unavailableSelection,
    );
  });

  it('invalidates an init that starts while the user selection is being persisted', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: newerSelection }),
    );
    const scope = {
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
    };
    const selectionIntentEpoch = await entity.recordSelectedAccountIntent({
      ...scope,
      selectedAccount: unavailableSelection,
    });
    const saveWriteReached = createDeferred();
    const releaseSaveWrite = createDeferred();
    jest.mocked(entity.appStorage.setItem).mockImplementationOnce(async () => {
      saveWriteReached.resolve();
      await releaseSaveWrite.promise;
    });

    const save = entity.saveSelectedAccount({
      ...scope,
      selectedAccount: unavailableSelection,
      selectionIntentEpoch,
    });
    await saveWriteReached.promise;
    const supersededGeneration = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.home,
    });
    releaseSaveWrite.resolve();

    await expect(save).resolves.toMatchObject({ persisted: true });
    await expect(
      entity.clearUnavailableSelectedAccount({
        expectedSelectedAccount: unavailableSelection,
        ...scope,
        selectedAccount: clearedSelection,
        shouldSyncWithHomeSource: false,
        storageInitGeneration: supersededGeneration,
      }),
    ).resolves.toMatchObject({
      primaryMatched: false,
      primaryPersisted: false,
      storageInitGenerationMatched: false,
    });
    await expect(entity.getSelectedAccount(scope)).resolves.toEqual(
      unavailableSelection,
    );
  });

  it('rolls back an A save when a newer B intent arrives during persistence', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: newerSelection }),
    );
    const scope = {
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
    };
    const olderIntentEpoch = await entity.recordSelectedAccountIntent({
      ...scope,
      selectedAccount: unavailableSelection,
    });
    const saveWriteReached = createDeferred();
    const releaseSaveWrite = createDeferred();
    jest.mocked(entity.appStorage.setItem).mockImplementationOnce(async () => {
      saveWriteReached.resolve();
      await releaseSaveWrite.promise;
    });

    const olderSave = entity.saveSelectedAccount({
      ...scope,
      selectedAccount: unavailableSelection,
      selectionIntentEpoch: olderIntentEpoch,
    });
    await saveWriteReached.promise;
    const newerIntentEpoch = await entity.recordSelectedAccountIntent({
      ...scope,
      selectedAccount: newerSelection,
    });
    releaseSaveWrite.resolve();

    await expect(olderSave).resolves.toMatchObject({
      persisted: false,
      staleSelectionIntent: true,
    });
    expect(getAccountSelectorWriteIntentEpoch(scope)).toBe(newerIntentEpoch);
    await expect(entity.getSelectedAccount(scope)).resolves.toEqual(
      newerSelection,
    );
  });

  it('rejects an A save when a newer B selection intent owns the scope', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({ home: newerSelection }),
    );
    const scope = {
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
    };
    const olderIntentEpoch = await entity.recordSelectedAccountIntent({
      ...scope,
      selectedAccount: unavailableSelection,
    });
    const newerIntentEpoch = await entity.recordSelectedAccountIntent({
      ...scope,
      selectedAccount: newerSelection,
    });

    const result = await entity.saveSelectedAccount({
      ...scope,
      selectedAccount: unavailableSelection,
      selectionIntentEpoch: olderIntentEpoch,
    });

    expect(result).toMatchObject({
      persisted: false,
      staleSelectionIntent: true,
    });
    expect(getAccountSelectorWriteIntentEpoch(scope)).toBe(newerIntentEpoch);
    await expect(entity.getSelectedAccount(scope)).resolves.toEqual(
      newerSelection,
    );
  });

  it('does not clear home when the primary CAS rejects a newer account', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({
        home: unavailableSelection,
        swap: newerSelection,
      }),
    );

    const result = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: true,
    });

    expect(result).toMatchObject({
      homeMatched: false,
      primaryMatched: false,
      primaryPersisted: false,
      syncedHome: false,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(unavailableSelection);
  });

  it('keeps a newer home account after the primary CAS succeeds', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({
        home: newerSelection,
        swap: unavailableSelection,
      }),
    );

    const result = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: true,
    });

    expect(result).toMatchObject({
      homeMatched: false,
      primaryMatched: true,
      primaryPersisted: true,
      syncedHome: false,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(newerSelection);
  });

  it('rolls back swap cleanup when a same-account home intent arrives during persistence', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({
        home: unavailableSelection,
        swap: unavailableSelection,
      }),
    );
    const generation = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.swap,
    });
    const cleanupWriteReached = createDeferred();
    const releaseCleanupWrite = createDeferred();
    jest.mocked(entity.appStorage.setItem).mockImplementationOnce(async () => {
      cleanupWriteReached.resolve();
      await releaseCleanupWrite.promise;
    });

    const cleanup = entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: true,
      storageInitGeneration: generation,
    });
    await cleanupWriteReached.promise;
    await entity.recordSelectedAccountIntent({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: unavailableSelection,
    });
    releaseCleanupWrite.resolve();

    await expect(cleanup).resolves.toMatchObject({
      homeSelectionIntentMatched: false,
      primaryPersisted: false,
      syncedHome: false,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.swap,
      }),
    ).resolves.toEqual(unavailableSelection);
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(unavailableSelection);
  });

  it('rolls back swap cleanup when a home init starts during persistence', async () => {
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({
        home: unavailableSelection,
        swap: unavailableSelection,
      }),
    );
    const swapGeneration = await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.swap,
    });
    const cleanupWriteReached = createDeferred();
    const releaseCleanupWrite = createDeferred();
    jest.mocked(entity.appStorage.setItem).mockImplementationOnce(async () => {
      cleanupWriteReached.resolve();
      await releaseCleanupWrite.promise;
    });

    const cleanup = entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: true,
      storageInitGeneration: swapGeneration,
    });
    await cleanupWriteReached.promise;
    await entity.beginAccountSelectorStorageInit({
      sceneName: EAccountSelectorSceneName.home,
    });
    releaseCleanupWrite.resolve();

    await expect(cleanup).resolves.toMatchObject({
      homeSelectionIntentMatched: false,
      primaryPersisted: false,
      syncedHome: false,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.swap,
      }),
    ).resolves.toEqual(unavailableSelection);
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(unavailableSelection);
  });

  it('clears the same unavailable home account while preserving its scene-specific network', async () => {
    const homeSelection = {
      ...unavailableSelection,
      deriveType: 'BIP44' as const,
      networkId: 'evm--42161',
    };
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({
        home: homeSelection,
        swap: unavailableSelection,
      }),
    );

    const result = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: true,
    });

    expect(result).toMatchObject({
      homeMatched: true,
      primaryMatched: true,
      primaryPersisted: true,
      syncedHome: true,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual({
      ...clearedSelection,
      deriveType: 'BIP44',
      networkId: 'evm--42161',
    });
  });

  it('preserves a newer focused wallet on an already identity-less home selection', async () => {
    const focusedSelection = {
      ...clearedSelection,
      focusedWallet: 'hd-2',
    };
    const entity = await createEntityWithPersistInfo(
      createPersistInfo({
        home: focusedSelection,
        swap: clearedSelection,
      }),
    );

    const result = await entity.clearUnavailableSelectedAccount({
      expectedSelectedAccount: unavailableSelection,
      num: 0,
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccount: clearedSelection,
      shouldSyncWithHomeSource: true,
    });

    expect(result).toMatchObject({
      homeMatched: false,
      primaryMatched: true,
      primaryPersisted: false,
      syncedHome: false,
    });
    await expect(
      entity.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(focusedSelection);
  });
});

describe('SimpleDbEntityAccountSelector global derive type persistence', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // The write-side half of the loop cut for the GlobalDeriveTypeUpdate chain:
  // event -> receiver sync -> autoSave -> saveGlobalDeriveType writes the value
  // it just received. Re-emitting on that equal-value write would hand every UI
  // runtime a fresh event for a value it already holds; together with the
  // receiver-side noop short-circuit this gate is what terminates the chain.
  it('emits GlobalDeriveTypeUpdate only when the saved value actually changes', async () => {
    jest.useFakeTimers();
    const entity = new SimpleDbEntityAccountSelector();
    let rawData: IAccountSelectorPersistInfo = {
      selectorInfo: {},
      globalDeriveTypesMap: {},
    };
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation(async (dataOrBuilder) => {
        rawData =
          typeof dataOrBuilder === 'function'
            ? await dataOrBuilder(rawData)
            : dataOrBuilder;
        return rawData;
      });
    const emitSpy = jest
      .spyOn(appEventBus, 'emit')
      .mockImplementation(() => true);

    await entity.saveGlobalDeriveType({
      networkId: 'evm--1',
      deriveType: 'BIP44',
    });
    jest.runAllTimers();
    expect(emitSpy).toHaveBeenCalledTimes(1);

    // Writing back the value already stored must not schedule another event.
    await entity.saveGlobalDeriveType({
      networkId: 'evm--1',
      deriveType: 'BIP44',
    });
    jest.runAllTimers();
    expect(emitSpy).toHaveBeenCalledTimes(1);

    // The gate compares values, it is not a once-only latch.
    await entity.saveGlobalDeriveType({
      networkId: 'evm--1',
      deriveType: 'BIP86',
    });
    jest.runAllTimers();
    expect(emitSpy).toHaveBeenCalledTimes(2);
  });
});

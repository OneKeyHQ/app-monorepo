/* eslint-disable import/first */

const mockSettingsPersistAtomGet = jest.fn();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('../providers/backgroundProviders', () => ({
  providerApiLoaders: {},
}));

jest.mock('../states/jotai/atoms', () => ({
  settingsPersistAtom: {
    get: (...args: unknown[]): unknown =>
      mockSettingsPersistAtomGet(...args) as unknown,
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {},
}));

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EAlignPrimaryAccountMode,
  type IConnectionAccountInfo,
} from '@onekeyhq/shared/types/dappConnection';

import { SimpleDbEntityAccountSelector } from '../dbs/simple/entity/SimpleDbEntityAccountSelector';
import { SimpleDbEntityDappConnection } from '../dbs/simple/entity/SimpleDbEntityDappConnection';

import ServiceDApp from './ServiceDApp';

import type { IAccountSelectorSelectedAccount } from '../dbs/simple/entity/SimpleDbEntityAccountSelector';

type IDeferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): IDeferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

function createStorageHarness() {
  const values = new Map<string, unknown>();
  let nextWriteGate:
    | {
        entityKey: string;
        release: IDeferred;
        started: IDeferred;
      }
    | undefined;
  const storage = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
    setItem: jest.fn(async (key: string, value: unknown) => {
      values.set(key, value);
      const gate = nextWriteGate;
      if (gate?.entityKey === key) {
        nextWriteGate = undefined;
        gate.started.resolve();
        await gate.release.promise;
      }
    }),
  };
  return {
    gateNextWrite(entityKey: string) {
      const gate = {
        entityKey,
        release: createDeferred(),
        started: createDeferred(),
      };
      nextWriteGate = gate;
      return gate;
    },
    storage,
  };
}

function buildSelectedAccount(walletSuffix: string) {
  const walletId = `hd-${walletSuffix}`;
  return {
    deriveType: 'default',
    focusedWallet: walletId,
    indexedAccountId: `${walletId}--0`,
    networkId: 'evm--1',
    othersWalletAccountId: undefined,
    walletId,
  } satisfies IAccountSelectorSelectedAccount;
}

function buildConnectionAccount(walletSuffix: string): IConnectionAccountInfo {
  const selectedAccount = buildSelectedAccount(walletSuffix);
  return {
    accountId: `${selectedAccount.walletId}--m/44'/60'/0'/0/0`,
    address: `0x-${walletSuffix}`,
    deriveType: 'default',
    focusedWallet: selectedAccount.focusedWallet,
    indexedAccountId: selectedAccount.indexedAccountId,
    networkId: 'evm--1',
    networkImpl: 'evm',
    othersWalletAccountId: selectedAccount.othersWalletAccountId,
    walletId: selectedAccount.walletId ?? '',
  };
}

function createHarness({
  alignPrimaryAccountMode = EAlignPrimaryAccountMode.Independent,
}: {
  alignPrimaryAccountMode?: EAlignPrimaryAccountMode;
} = {}) {
  const storageHarness = createStorageHarness();
  const accountSelector = new SimpleDbEntityAccountSelector();
  const dappConnection = new SimpleDbEntityDappConnection();
  accountSelector.appStorage =
    storageHarness.storage as unknown as typeof accountSelector.appStorage;
  dappConnection.appStorage =
    storageHarness.storage as unknown as typeof dappConnection.appStorage;

  let callbackPending = true;
  let accountAvailable = true;
  let resolveObserver: ((data: unknown) => void) | undefined;
  const resolveCallback = jest.fn(
    ({ data }: { id: number | string; data: unknown }) => {
      if (!callbackPending) {
        return false;
      }
      callbackPending = false;
      resolveObserver?.(data);
      return Boolean(data);
    },
  );
  const addConnectedSite = jest.fn(async () => undefined);
  const walletConnectDisconnect = jest.fn(async () => undefined);
  const getAccount = jest.fn(
    async ({ accountId }: { accountId: string; networkId: string }) => {
      if (!accountAvailable) {
        throw new OneKeyLocalError('account unavailable');
      }
      const walletSuffix = accountId.slice('hd-'.length).split('--m/')[0];
      return {
        address: `0x-${walletSuffix}`,
        id: accountId,
      };
    },
  );
  const backgroundApi = {
    providers: {},
    serviceAccount: {
      getAccount,
    },
    serviceDiscovery: {
      buildWebsiteIconUrl: jest.fn(async () => 'https://icon.test/icon.png'),
    },
    serviceNetwork: {
      getNetworkIdsByImpls: jest.fn(async () => ({
        networkIds: ['evm--1'],
      })),
    },
    servicePromise: {
      hasCallback: jest.fn(() => callbackPending),
      resolveCallbackSync: resolveCallback,
    },
    serviceSignature: {
      addConnectedSite,
    },
    serviceWalletConnect: {
      walletConnectDisconnect,
    },
    simpleDb: {
      accountSelector,
      dappConnection,
    },
  };
  const service = new ServiceDApp({ backgroundApi });
  jest
    .spyOn(service, 'notifyDAppAccountsChangedAfterConnected')
    .mockResolvedValue(undefined);
  mockSettingsPersistAtomGet.mockImplementation(async () => ({
    alignPrimaryAccountMode,
  }));
  return {
    accountSelector,
    addConnectedSite,
    dappConnection,
    getAccount,
    resolveCallback,
    service,
    setAccountAvailable(value: boolean) {
      accountAvailable = value;
    },
    setCallbackPending(value: boolean) {
      callbackPending = value;
    },
    setResolveObserver(observer: (data: unknown) => void) {
      resolveObserver = observer;
    },
    storageHarness,
    walletConnectDisconnect,
  };
}

function expectNoApprovalSideEffects({
  addConnectedSite,
  emitSpy,
  resolveCallback,
  walletConnectDisconnect,
}: {
  addConnectedSite: jest.Mock;
  emitSpy: jest.SpyInstance;
  resolveCallback: jest.Mock;
  walletConnectDisconnect: jest.Mock;
}) {
  expect(resolveCallback).not.toHaveBeenCalled();
  expect(addConnectedSite).not.toHaveBeenCalled();
  expect(walletConnectDisconnect).not.toHaveBeenCalled();
  expect(emitSpy).not.toHaveBeenCalledWith(
    EAppEventBusNames.DAppConnectUpdate,
    undefined,
  );
  expect(emitSpy).not.toHaveBeenCalledWith(
    EAppEventBusNames.SyncDappAccountToHomeAccount,
    expect.anything(),
  );
}

describe('ServiceDApp connection approval transaction', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation(() => false);
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  it('rejects an older renderer snapshot when a newer cross-runtime selection intent arrived first', async () => {
    const origin = 'https://cross-renderer-order.test';
    const harness = createHarness();
    await harness.service.recordConnectionSelectionIntent({
      accountSelectorNum: 0,
      origin,
      selectedAccount: buildSelectedAccount('newer-b'),
    });

    await expect(
      harness.service.approveConnectionSession({
        accountInfo: buildConnectionAccount('older-a'),
        accountSelectorNum: 0,
        approvalId: 'approval-cross-renderer-order',
        expectedSelectedAccount: buildSelectedAccount('older-a'),
        mode: 'save',
        origin,
        requestId: 100,
      }),
    ).resolves.toEqual({
      approved: false,
      reason: 'selection-changed',
    });

    await expect(harness.dappConnection.getRawData()).resolves.toBeNull();
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });

  it('rolls back when a non-persisted discover selection publishes a newer write intent during session I/O', async () => {
    const origin = 'https://selection-intent.test';
    const accountInfo = buildConnectionAccount('approval-a');
    const harness = createHarness();
    const writeGate = harness.storageHarness.gateNextWrite(
      harness.dappConnection.entityKey,
    );

    const approval = harness.service.approveConnectionSession({
      accountInfo,
      accountSelectorNum: 0,
      approvalId: 'approval-selection-intent',
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 101,
    });
    await writeGate.started.promise;

    await expect(
      harness.accountSelector.saveSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: origin,
        selectedAccount: buildSelectedAccount('newer-b'),
      }),
    ).resolves.toEqual({ persisted: false });
    writeGate.release.resolve();

    await expect(approval).resolves.toEqual({
      approved: false,
      reason: 'selection-changed',
    });
    await expect(harness.dappConnection.getRawData()).resolves.toBeNull();
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });

  it('rolls back when the modal invalidates the same raw selection after observing no account', async () => {
    const origin = 'https://addressless-observation.test';
    const harness = createHarness();
    const writeGate = harness.storageHarness.gateNextWrite(
      harness.dappConnection.entityKey,
    );
    const approvalId = 'approval-addressless-observation';

    const approval = harness.service.approveConnectionSession({
      accountInfo: buildConnectionAccount('approval-a'),
      accountSelectorNum: 0,
      approvalId,
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 102,
    });
    await writeGate.started.promise;
    await harness.service.invalidateConnectionApproval({ approvalId });
    writeGate.release.resolve();

    await expect(approval).resolves.toEqual({
      approved: false,
      reason: 'selection-changed',
    });
    await expect(harness.dappConnection.getRawData()).resolves.toBeNull();
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });

  it('drains a delayed addressless invalidation before the final publish', async () => {
    const origin = 'https://delayed-addressless-invalidation.test';
    const approvalId = 'approval-delayed-addressless-invalidation';
    const harness = createHarness();
    let lookupCount = 0;
    harness.getAccount.mockImplementation(
      async ({ accountId }: { accountId: string; networkId: string }) => {
        lookupCount += 1;
        if (lookupCount === 2) {
          setTimeout(() => {
            void harness.service.invalidateConnectionApproval({ approvalId });
          }, 0);
        }
        const walletSuffix = accountId.slice('hd-'.length).split('--m/')[0];
        return { address: `0x-${walletSuffix}`, id: accountId };
      },
    );
    const approval = harness.service.approveConnectionSession({
      accountInfo: buildConnectionAccount('approval-a'),
      accountSelectorNum: 0,
      approvalId,
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 110,
    });

    await expect(approval).resolves.toEqual({
      approved: false,
      reason: 'selection-changed',
    });
    await expect(harness.dappConnection.getRawData()).resolves.toBeNull();
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });

  it('rolls back when the account disappears during session I/O even without modal invalidation', async () => {
    const origin = 'https://account-removed.test';
    const harness = createHarness();
    const writeGate = harness.storageHarness.gateNextWrite(
      harness.dappConnection.entityKey,
    );

    const approval = harness.service.approveConnectionSession({
      accountInfo: buildConnectionAccount('approval-a'),
      accountSelectorNum: 0,
      approvalId: 'approval-account-removed',
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 104,
    });
    await writeGate.started.promise;
    harness.setAccountAvailable(false);
    writeGate.release.resolve();

    await expect(approval).resolves.toEqual({
      approved: false,
      reason: 'selection-changed',
    });
    await expect(harness.dappConnection.getRawData()).resolves.toBeNull();
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });

  it('commits, resolves, emits, and cleans up a replaced WalletConnect session on the stable happy path', async () => {
    const origin = 'https://stable-approval.test';
    const harness = createHarness();
    const accountInfo = buildConnectionAccount('approval-a');
    await harness.dappConnection.upsertConnection({
      accountsInfo: [buildConnectionAccount('wallet-connect-old')],
      origin,
      storageType: 'walletConnect',
      walletConnectTopic: 'old-wallet-connect-topic',
    });
    jest.clearAllMocks();
    harness.addConnectedSite.mockRejectedValueOnce(
      new Error('site history unavailable'),
    );
    harness.setResolveObserver(() => {
      expect(
        harness.dappConnection.cachedRawData?.data.injectedProvider[origin]
          ?.connectionMap[0],
      ).toEqual(accountInfo);
    });
    const cleanupFinished = createDeferred();
    const deleteWalletConnectConnectionIfTopic =
      harness.dappConnection.deleteWalletConnectConnectionIfTopic.bind(
        harness.dappConnection,
      );
    jest
      .spyOn(harness.dappConnection, 'deleteWalletConnectConnectionIfTopic')
      .mockImplementation(async (params) => {
        const removed = await deleteWalletConnectConnectionIfTopic(params);
        cleanupFinished.resolve();
        return removed;
      });
    const approval = harness.service.approveConnectionSession({
      accountInfo,
      accountSelectorNum: 0,
      approvalId: 'approval-stable',
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 103,
    });
    await expect(approval).resolves.toEqual({ approved: true });
    await cleanupFinished.promise;

    const rawData = await harness.dappConnection.getRawData();
    expect(rawData?.data.injectedProvider[origin]?.connectionMap[0]).toEqual(
      accountInfo,
    );
    expect(rawData?.data.walletConnect[origin]).toBeUndefined();
    expect(harness.resolveCallback).toHaveBeenCalledWith({
      data: accountInfo,
      id: 103,
    });
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.DAppConnectUpdate,
      undefined,
    );
    expect(harness.addConnectedSite).toHaveBeenCalledWith({
      items: [{ address: accountInfo.address, networkId: 'evm--1' }],
      url: origin,
    });
    expect(harness.walletConnectDisconnect).toHaveBeenCalledWith(
      'old-wallet-connect-topic',
    );
  });

  it('retains the replaced WalletConnect state when remote disconnect fails', async () => {
    const origin = 'https://wallet-connect-disconnect-failure.test';
    const harness = createHarness();
    const accountInfo = buildConnectionAccount('approval-a');
    const previousWalletConnectAccount = buildConnectionAccount(
      'wallet-connect-recoverable',
    );
    await harness.dappConnection.upsertConnection({
      accountsInfo: [previousWalletConnectAccount],
      origin,
      storageType: 'walletConnect',
      walletConnectTopic: 'recoverable-wallet-connect-topic',
    });
    jest.clearAllMocks();
    harness.walletConnectDisconnect.mockRejectedValueOnce(
      new Error('remote disconnect unavailable'),
    );
    const approval = harness.service.approveConnectionSession({
      accountInfo,
      accountSelectorNum: 0,
      approvalId: 'approval-wallet-connect-disconnect-failure',
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 108,
    });
    await expect(approval).resolves.toEqual({ approved: true });
    await Promise.resolve();

    const rawData = await harness.dappConnection.getRawData();
    expect(rawData?.data.injectedProvider[origin]?.connectionMap[0]).toEqual(
      accountInfo,
    );
    expect(rawData?.data.walletConnect[origin]).toMatchObject({
      connectionMap: { 1000: previousWalletConnectAccount },
      walletConnectTopic: 'recoverable-wallet-connect-topic',
    });
    expect(harness.walletConnectDisconnect).toHaveBeenCalledWith(
      'recoverable-wallet-connect-topic',
    );
  });

  it('does not delete a newer WalletConnect session after the old topic disconnects', async () => {
    const origin = 'https://wallet-connect-cleanup-race.test';
    const harness = createHarness();
    const oldWalletConnectAccount =
      buildConnectionAccount('wallet-connect-old');
    const newWalletConnectAccount =
      buildConnectionAccount('wallet-connect-new');
    await harness.dappConnection.upsertConnection({
      accountsInfo: [oldWalletConnectAccount],
      origin,
      storageType: 'walletConnect',
      walletConnectTopic: 'old-wallet-connect-topic',
    });
    jest.clearAllMocks();
    const disconnectStarted = createDeferred();
    const finishDisconnect = createDeferred();
    harness.walletConnectDisconnect.mockImplementationOnce(async () => {
      disconnectStarted.resolve();
      await finishDisconnect.promise;
    });
    const approval = harness.service.approveConnectionSession({
      accountInfo: buildConnectionAccount('approval-a'),
      accountSelectorNum: 0,
      approvalId: 'approval-wallet-connect-cleanup-race',
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 109,
    });
    await expect(approval).resolves.toEqual({ approved: true });
    await disconnectStarted.promise;

    await harness.dappConnection.upsertConnection({
      accountsInfo: [newWalletConnectAccount],
      origin,
      storageType: 'walletConnect',
      walletConnectTopic: 'new-wallet-connect-topic',
    });
    finishDisconnect.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const rawData = await harness.dappConnection.getRawData();
    expect(rawData?.data.walletConnect[origin]).toMatchObject({
      connectionMap: { 1000: newWalletConnectAccount },
      walletConnectTopic: 'new-wallet-connect-topic',
    });
    expect(
      Object.values(rawData?.data.walletConnect[origin]?.connectionMap ?? {}),
    ).toEqual([newWalletConnectAccount]);
    expect(
      Object.values(rawData?.data.walletConnect[origin]?.connectionMap ?? {}),
    ).not.toContainEqual(oldWalletConnectAccount);
    expect(harness.walletConnectDisconnect).toHaveBeenCalledWith(
      'old-wallet-connect-topic',
    );
  });

  it('clears injected and old WalletConnect state before saving a new WalletConnect session', async () => {
    const origin = 'https://wallet-connect-reconnect.test';
    const harness = createHarness();
    const injectedAccount = buildConnectionAccount('injected-old');
    const oldWalletConnectAccount =
      buildConnectionAccount('wallet-connect-old');
    const newWalletConnectAccount =
      buildConnectionAccount('wallet-connect-new');
    await harness.dappConnection.upsertConnection({
      accountsInfo: [injectedAccount],
      origin,
      storageType: 'injectedProvider',
    });
    await harness.dappConnection.upsertConnection({
      accountsInfo: [oldWalletConnectAccount],
      origin,
      storageType: 'walletConnect',
      walletConnectTopic: 'old-wallet-connect-topic',
    });
    jest.clearAllMocks();

    await harness.service.deleteExistSessionBeforeConnect({
      origin,
      storageType: 'walletConnect',
    });

    let rawData = await harness.dappConnection.getRawData();
    expect(rawData?.data.injectedProvider[origin]).toBeUndefined();
    expect(rawData?.data.walletConnect[origin]).toBeUndefined();
    expect(harness.walletConnectDisconnect).toHaveBeenCalledWith(
      'old-wallet-connect-topic',
    );

    await harness.dappConnection.upsertConnection({
      accountsInfo: [newWalletConnectAccount],
      origin,
      storageType: 'walletConnect',
      walletConnectTopic: 'new-wallet-connect-topic',
    });
    rawData = await harness.dappConnection.getRawData();
    expect(rawData?.data.walletConnect[origin]).toMatchObject({
      connectionMap: { 1000: newWalletConnectAccount },
      walletConnectTopic: 'new-wallet-connect-topic',
    });
    expect(
      Object.values(rawData?.data.walletConnect[origin]?.connectionMap ?? {}),
    ).toEqual([newWalletConnectAccount]);
  });

  it('restores the staged DApp session when guarded Home preparation throws', async () => {
    const origin = 'https://home-prepare-error.test';
    const harness = createHarness({
      alignPrimaryAccountMode: EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount,
    });
    jest
      .spyOn(harness.service, 'buildHomeSelectedAccountByDappAccount')
      .mockRejectedValueOnce(new Error('home preparation failed'));

    await expect(
      harness.service.approveConnectionSession({
        accountInfo: buildConnectionAccount('approval-a'),
        accountSelectorNum: 0,
        approvalId: 'approval-home-prepare-error',
        expectedSelectedAccount: buildSelectedAccount('approval-a'),
        mode: 'save',
        origin,
        requestId: 105,
      }),
    ).rejects.toThrow('home preparation failed');

    await expect(harness.dappConnection.getRawData()).resolves.toBeNull();
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });

  it('rolls back Home and DApp when the account disappears during Home storage I/O', async () => {
    const origin = 'https://account-removed-during-home.test';
    const harness = createHarness({
      alignPrimaryAccountMode: EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount,
    });
    const previousHome = buildSelectedAccount('previous-home');
    const nextHome = buildSelectedAccount('next-home');
    await harness.accountSelector.saveSelectedAccount({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: previousHome,
    });
    jest
      .spyOn(harness.service, 'buildHomeSelectedAccountByDappAccount')
      .mockResolvedValue(nextHome);
    jest.clearAllMocks();
    const homeWriteGate = harness.storageHarness.gateNextWrite(
      harness.accountSelector.entityKey,
    );

    const approval = harness.service.approveConnectionSession({
      accountInfo: buildConnectionAccount('approval-a'),
      accountSelectorNum: 0,
      approvalId: 'approval-account-removed-during-home',
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 106,
    });
    await homeWriteGate.started.promise;
    harness.setAccountAvailable(false);
    homeWriteGate.release.resolve();

    await expect(approval).resolves.toEqual({
      approved: false,
      reason: 'selection-changed',
    });
    await expect(
      harness.accountSelector.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(previousHome);
    await expect(harness.dappConnection.getRawData()).resolves.toBeNull();
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });

  it('does not mint an internal Home intent over a newer explicit user intent', async () => {
    const origin = 'https://newer-home-intent.test';
    const harness = createHarness({
      alignPrimaryAccountMode: EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount,
    });
    const previousHome = buildSelectedAccount('previous-home');
    const alignedHome = buildSelectedAccount('aligned-home');
    const explicitHome = buildSelectedAccount('explicit-home');
    await harness.accountSelector.saveSelectedAccount({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: previousHome,
    });
    jest
      .spyOn(harness.service, 'buildHomeSelectedAccountByDappAccount')
      .mockResolvedValue(alignedHome);
    jest.clearAllMocks();
    const dappWriteGate = harness.storageHarness.gateNextWrite(
      harness.dappConnection.entityKey,
    );

    const approval = harness.service.approveConnectionSession({
      accountInfo: buildConnectionAccount('approval-a'),
      accountSelectorNum: 0,
      approvalId: 'approval-newer-home-intent',
      expectedSelectedAccount: buildSelectedAccount('approval-a'),
      mode: 'save',
      origin,
      requestId: 107,
    });
    await dappWriteGate.started.promise;
    const explicitIntentEpoch =
      await harness.accountSelector.recordSelectedAccountIntent({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount: explicitHome,
      });
    const explicitSave = harness.accountSelector.saveSelectedAccount({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: explicitHome,
      selectionIntentEpoch: explicitIntentEpoch,
    });
    dappWriteGate.release.resolve();

    await expect(approval).resolves.toEqual({
      approved: false,
      reason: 'selection-changed',
    });
    await expect(explicitSave).resolves.toEqual({ persisted: true });
    await expect(
      harness.accountSelector.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(explicitHome);
    await expect(harness.dappConnection.getRawData()).resolves.toBeNull();
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });

  it('rolls back both Home preselection and the DApp session when the request settles during Home storage I/O', async () => {
    const origin = 'https://cancel-during-home-sync.test';
    const harness = createHarness({
      alignPrimaryAccountMode: EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount,
    });
    const previousConnection = buildConnectionAccount('previous-dapp');
    const nextConnection = buildConnectionAccount('next-dapp');
    const concurrentConnection = buildConnectionAccount('concurrent-dapp');
    const previousHome = buildSelectedAccount('previous-home');
    await harness.dappConnection.upsertConnection({
      accountsInfo: [previousConnection],
      origin,
      storageType: 'injectedProvider',
    });
    await harness.accountSelector.saveSelectedAccount({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      selectedAccount: previousHome,
    });
    jest.clearAllMocks();
    const homeWriteGate = harness.storageHarness.gateNextWrite(
      harness.accountSelector.entityKey,
    );

    const approval = harness.service.approveConnectionSession({
      accountInfo: nextConnection,
      accountSelectorNum: 0,
      approvalId: 'approval-cancel-during-home',
      expectedSelectedAccount: buildSelectedAccount('next-dapp'),
      mode: 'update',
      origin,
      preselectKeylessProvider: EOAuthSocialLoginProvider.Google,
      requestId: 104,
    });
    await homeWriteGate.started.promise;
    const concurrentWrite = harness.dappConnection.upsertConnection({
      accountsInfo: [concurrentConnection],
      origin,
      storageType: 'injectedProvider',
    });
    await expect(harness.dappConnection.getRawData()).resolves.toMatchObject({
      data: {
        injectedProvider: {
          [origin]: {
            connectionMap: { 0: previousConnection },
          },
        },
      },
    });
    harness.setCallbackPending(false);
    homeWriteGate.release.resolve();

    await expect(approval).resolves.toEqual({
      approved: false,
      reason: 'request-settled',
    });
    await concurrentWrite;
    await expect(
      harness.accountSelector.getSelectedAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }),
    ).resolves.toEqual(previousHome);
    const rawData = await harness.dappConnection.getRawData();
    expect(rawData?.data.injectedProvider[origin]?.connectionMap[0]).toEqual(
      previousConnection,
    );
    expect(rawData?.data.injectedProvider[origin]?.connectionMap[1]).toEqual(
      concurrentConnection,
    );
    expect(
      Object.values(
        rawData?.data.injectedProvider[origin]?.connectionMap ?? {},
      ),
    ).not.toContainEqual(nextConnection);
    expectNoApprovalSideEffects({ ...harness, emitSpy });
  });
});

/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EAccountSelectorAutoSelectTriggerBy,
  EAccountSelectorSceneName,
} from '@onekeyhq/shared/types';

import {
  getAccountSelectorActions,
  useAccountSelectorActions,
} from './actions';
import {
  AccountSelectorJotaiProvider,
  accountSelectorActiveAccountInitDoneAtom,
  accountSelectorStorageInitDoneAtom,
  accountSelectorStorageReadyAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';

import type { IAccountSelectorContextData } from './atoms';

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};
type ISelectedAccount = ReturnType<typeof defaultSelectedAccount>;
type ISelectedAccountsMap = Partial<Record<number, ISelectedAccount>>;
type IBuildActiveAccountInfoResult = {
  activeAccount: ReturnType<typeof defaultActiveAccountInfo>;
};
type IFixDeriveTypesForInitAccountSelectorMapParams = {
  selectedAccountsMapInDB: ISelectedAccountsMap | undefined;
};
type IGetSelectedAccountParams = {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  num: number;
};
type ISaveSelectedAccountParams = {
  selectedAccount: ISelectedAccount;
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  num: number;
  selectedAccountUpdatedAt?: number;
};
type IMergeHomeDataToSwapMapParams = {
  swapMap: ISelectedAccountsMap | undefined;
};
type IFixOthersWalletAccountNetworkPairParams = {
  selectedAccount: ISelectedAccount;
};
type IIndexedAccount = NonNullable<
  ReturnType<typeof defaultActiveAccountInfo>['indexedAccount']
>;
type IWallet = NonNullable<
  ReturnType<typeof defaultActiveAccountInfo>['wallet']
>;
type IWriteContextAtomColdStartCacheValues =
  typeof import('@onekeyhq/kit-bg/src/states/jotai/utils').writeContextAtomColdStartCacheValues;

function createDeferred<T>(): IDeferred<T> {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return {
    promise,
    resolve: (value: T) => {
      resolve?.(value);
    },
  };
}

const mockGetSelectedAccountsMap: jest.MockedFunction<
  () => Promise<ISelectedAccountsMap | undefined>
> = jest.fn();
const mockGetDappAccountSelectorMap: jest.MockedFunction<
  () => Promise<Record<number, Record<string, unknown>> | undefined>
> = jest.fn();
const mockBuildActiveAccountInfoFromSelectedAccount: jest.MockedFunction<
  () => Promise<IBuildActiveAccountInfoResult>
> = jest.fn();
const mockFixDeriveTypesForInitAccountSelectorMap: jest.MockedFunction<
  (
    params: IFixDeriveTypesForInitAccountSelectorMapParams,
  ) => Promise<ISelectedAccountsMap | undefined>
> = jest.fn();
const mockGetSelectedAccount: jest.MockedFunction<
  (params: IGetSelectedAccountParams) => Promise<ISelectedAccount | undefined>
> = jest.fn();
const mockSaveSelectedAccount: jest.MockedFunction<
  (params: ISaveSelectedAccountParams) => Promise<void>
> = jest.fn();
const mockSaveGlobalDeriveType: jest.MockedFunction<() => Promise<void>> =
  jest.fn();
const mockShouldSyncWithHomeSource: jest.MockedFunction<
  (params: IGetSelectedAccountParams) => Promise<boolean>
> = jest.fn();
const mockMergeHomeDataToSwapMap: jest.MockedFunction<
  (
    params: IMergeHomeDataToSwapMapParams,
  ) => Promise<ISelectedAccountsMap | undefined>
> = jest.fn();
const mockFixOthersWalletAccountNetworkPair: jest.MockedFunction<
  (
    params: IFixOthersWalletAccountNetworkPairParams,
  ) => Promise<ISelectedAccount>
> = jest.fn();
const mockGetGlobalDeriveType: jest.MockedFunction<() => Promise<string>> =
  jest.fn();
const mockShouldUseGlobalDeriveType: jest.MockedFunction<
  () => Promise<boolean>
> = jest.fn();
const mockIsDeriveTypeAvailableForNetwork: jest.MockedFunction<
  () => Promise<boolean>
> = jest.fn();
const mockShouldSyncHomeAndSwapSelectedAccount: jest.MockedFunction<
  () => Promise<boolean>
> = jest.fn();
const mockClearAccountCache: jest.MockedFunction<() => Promise<void>> =
  jest.fn();
const mockGetAllHdHwQrWallets: jest.MockedFunction<
  () => Promise<{
    wallets: IWallet[];
  }>
> = jest.fn();
const mockIsWalletHasIndexedAccounts: jest.MockedFunction<
  ({ walletId }: { walletId: string }) => Promise<boolean>
> = jest.fn();
const mockGetIndexedAccountsOfWallet: jest.MockedFunction<
  ({ walletId }: { walletId: string }) => Promise<{
    accounts: IIndexedAccount[];
  }>
> = jest.fn();
const mockGetSingletonAccountsOfWallet: jest.MockedFunction<
  ({
    walletId,
    activeNetworkId,
  }: {
    walletId: string;
    activeNetworkId?: string;
  }) => Promise<{
    accounts: IDBAccount[];
  }>
> = jest.fn();
const mockGetDBAccount: jest.MockedFunction<
  ({ accountId }: { accountId: string }) => Promise<IDBAccount | undefined>
> = jest.fn();
const mockGetWalletSafe: jest.MockedFunction<
  ({ walletId }: { walletId: string }) => Promise<IWallet | undefined>
> = jest.fn();
const mockIsTempWalletRemoved: jest.MockedFunction<
  ({ wallet }: { wallet: IWallet }) => Promise<boolean>
> = jest.fn();
const mockColdStartCacheStorageData = new Map<string, unknown>();
const mockColdStartCacheStorage = {
  delete: jest.fn((key: string) => {
    mockColdStartCacheStorageData.delete(key);
  }),
  getObject: jest.fn((key: string) => mockColdStartCacheStorageData.get(key)),
  setObject: jest.fn((key: string, value: unknown) => {
    mockColdStartCacheStorageData.set(key, value);
  }),
};
const mockFlushColdStartCacheNow = jest.fn(async () => undefined);
const mockWriteContextAtomColdStartCacheValues: jest.MockedFunction<IWriteContextAtomColdStartCacheValues> =
  jest.fn();
const mockAddTonImportedAccountByMnemonic = jest.fn<
  Promise<{
    networkId: string;
    walletId: string;
    accounts: IDBAccount[];
    isOverrideAccounts: boolean;
  }>,
  [
    {
      mnemonic: string;
      name?: string;
      shouldCheckDuplicateName?: boolean;
    },
  ]
>();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/utils')
  >('@onekeyhq/kit-bg/src/states/jotai/utils');

  return {
    ...actual,
    writeContextAtomColdStartCacheValues: async (
      ...args: Parameters<IWriteContextAtomColdStartCacheValues>
    ): Promise<void> => {
      await mockWriteContextAtomColdStartCacheValues(...args);
    },
  };
});

jest.mock('@onekeyhq/kit/src/components/Hardware/Hardware', () => ({
  CommonDeviceLoading: jest.fn(() => null),
}));

jest.mock(
  '@onekeyhq/kit/src/provider/Container/ThirdPartyHardwareUiStateContainer/ledgerCoreAppsReadyUtils',
  () => ({
    shouldContinueLedgerAutoCreateForCoreAppsCheckResult: jest.fn(() => false),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/provider/Container/ThirdPartyHardwareUiStateContainer/LedgerInstallCoreAppsDialog',
  () => ({
    ensureLedgerCoreAppsReady: jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit/src/utils/toastExistingWalletSwitch', () => ({
  toastExistingWalletSwitch: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isExtensionBackgroundServiceWorker: false,
    isJest: true,
    isNative: false,
    isWeb: false,
    isWebDappMode: false,
  },
}));

jest.mock('@onekeyhq/shared/src/storage/instance/webColdStartStorage', () => ({
  flushColdStartCacheNow: () => mockFlushColdStartCacheNow(),
}));

jest.mock('@onekeyhq/shared/src/storage/instance/syncStorageInstance', () => ({
  coldStartCacheStorage: {
    delete: (key: string) => mockColdStartCacheStorage.delete(key),
    getObject: (key: string) => mockColdStartCacheStorage.getObject(key),
    setObject: (key: string, value: unknown) =>
      mockColdStartCacheStorage.setObject(key, value),
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/qrHiddenCreateGuideDialog',
  () => ({
    __esModule: true,
    default: jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      addTonImportedAccountByMnemonic: (
        ...args: Parameters<typeof mockAddTonImportedAccountByMnemonic>
      ) => mockAddTonImportedAccountByMnemonic(...args),
      clearAccountCache: () => mockClearAccountCache(),
      getAllHdHwQrWallets: () => mockGetAllHdHwQrWallets(),
      getIndexedAccountsOfWallet: ({ walletId }: { walletId: string }) =>
        mockGetIndexedAccountsOfWallet({ walletId }),
      getSingletonAccountsOfWallet: ({
        walletId,
        activeNetworkId,
      }: {
        walletId: string;
        activeNetworkId?: string;
      }) => mockGetSingletonAccountsOfWallet({ walletId, activeNetworkId }),
      getDBAccount: ({ accountId }: { accountId: string }) =>
        mockGetDBAccount({ accountId }),
      getWalletSafe: ({ walletId }: { walletId: string }) =>
        mockGetWalletSafe({ walletId }),
      isWalletHasIndexedAccounts: ({ walletId }: { walletId: string }) =>
        mockIsWalletHasIndexedAccounts({ walletId }),
      isTempWalletRemoved: ({ wallet }: { wallet: IWallet }) =>
        mockIsTempWalletRemoved({ wallet }),
    },
    serviceAccountSelector: {
      buildActiveAccountInfoFromSelectedAccount: () =>
        mockBuildActiveAccountInfoFromSelectedAccount(),
      fixDeriveTypesForInitAccountSelectorMap: (
        params: IFixDeriveTypesForInitAccountSelectorMapParams,
      ) => mockFixDeriveTypesForInitAccountSelectorMap(params),
      fixOthersWalletAccountNetworkPair: (
        params: IFixOthersWalletAccountNetworkPairParams,
      ) => mockFixOthersWalletAccountNetworkPair(params),
      getGlobalDeriveType: () => mockGetGlobalDeriveType(),
      mergeHomeDataToSwapMap: (params: IMergeHomeDataToSwapMapParams) =>
        mockMergeHomeDataToSwapMap(params),
      saveGlobalDeriveType: () => mockSaveGlobalDeriveType(),
      shouldSyncHomeAndSwapSelectedAccount: () =>
        mockShouldSyncHomeAndSwapSelectedAccount(),
      shouldSyncWithHomeSource: (params: IGetSelectedAccountParams) =>
        mockShouldSyncWithHomeSource(params),
      shouldUseGlobalDeriveType: () => mockShouldUseGlobalDeriveType(),
    },
    serviceNetwork: {
      isDeriveTypeAvailableForNetwork: () =>
        mockIsDeriveTypeAvailableForNetwork(),
    },
    simpleDb: {
      accountSelector: {
        getSelectedAccount: (params: IGetSelectedAccountParams) =>
          mockGetSelectedAccount(params),
        getSelectedAccountsMap: () => mockGetSelectedAccountsMap(),
        saveSelectedAccount: (params: ISaveSelectedAccountParams) =>
          mockSaveSelectedAccount(params),
      },
      dappConnection: {
        getAccountSelectorMap: () => mockGetDappAccountSelectorMap(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });

  return {
    defaultLogger: noopLogger,
  };
});

function createWrapper(
  config?: EAccountSelectorSceneName | IAccountSelectorContextData,
) {
  const store = createStore();
  store.set(accountSelectorStorageReadyAtom(), true);
  store.set(accountSelectorStorageInitDoneAtom(), false);
  store.set(accountSelectorActiveAccountInitDoneAtom(), {});
  store.set(selectedAccountsAtom(), {
    0: defaultSelectedAccount(),
  });
  const providerConfig: IAccountSelectorContextData =
    config && typeof config === 'object'
      ? config
      : { sceneName: config ?? EAccountSelectorSceneName.home };

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <AccountSelectorJotaiProvider store={store} config={providerConfig}>
        {children}
      </AccountSelectorJotaiProvider>
    );
  }

  return {
    store,
    Wrapper,
  };
}

function createHdSelectedAccount(indexedAccountId: string): ISelectedAccount {
  return {
    ...defaultSelectedAccount(),
    walletId: 'hd-1',
    indexedAccountId,
    networkId: 'tron--0x2b6653dc',
    deriveType: 'default',
    focusedWallet: 'hd-1',
  };
}

describe('useAccountSelectorActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    mockColdStartCacheStorageData.clear();
    mockGetDappAccountSelectorMap.mockResolvedValue(undefined);
    mockWriteContextAtomColdStartCacheValues.mockResolvedValue(undefined);
    mockBuildActiveAccountInfoFromSelectedAccount.mockResolvedValue({
      activeAccount: {
        ...defaultActiveAccountInfo(),
        ready: true,
      },
    });
    mockFixDeriveTypesForInitAccountSelectorMap.mockImplementation(
      async (params) => params.selectedAccountsMapInDB,
    );
    mockGetSelectedAccount.mockResolvedValue(undefined);
    mockSaveSelectedAccount.mockResolvedValue(undefined);
    mockSaveGlobalDeriveType.mockResolvedValue(undefined);
    mockMergeHomeDataToSwapMap.mockImplementation(
      async (params) => params.swapMap,
    );
    mockFixOthersWalletAccountNetworkPair.mockImplementation(
      async ({ selectedAccount }) => selectedAccount,
    );
    mockGetGlobalDeriveType.mockResolvedValue('default');
    mockShouldUseGlobalDeriveType.mockResolvedValue(true);
    mockIsDeriveTypeAvailableForNetwork.mockResolvedValue(true);
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(false);
    mockShouldSyncWithHomeSource.mockResolvedValue(false);
    mockClearAccountCache.mockResolvedValue(undefined);
    mockGetAllHdHwQrWallets.mockResolvedValue({ wallets: [] });
    mockIsWalletHasIndexedAccounts.mockResolvedValue(true);
    mockGetDBAccount.mockResolvedValue(undefined);
    mockGetIndexedAccountsOfWallet.mockResolvedValue({
      accounts: [
        { id: 'hd-1--0', walletId: 'hd-1' } as IIndexedAccount,
        { id: 'hd-1--1', walletId: 'hd-1' } as IIndexedAccount,
      ],
    });
    mockGetSingletonAccountsOfWallet.mockResolvedValue({ accounts: [] });
    mockGetWalletSafe.mockResolvedValue({ id: 'hd-1' } as IWallet);
    mockIsTempWalletRemoved.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks active account init done when reload finishes before storage init', async () => {
    const selectedAccountsMapDeferred = createDeferred<
      ISelectedAccountsMap | undefined
    >();
    mockGetSelectedAccountsMap.mockReturnValue(
      selectedAccountsMapDeferred.promise,
    );

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let initFromStoragePromise: Promise<void> | undefined;
    await act(async () => {
      initFromStoragePromise = result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
      });
      await Promise.resolve();
    });

    expect(store.get(accountSelectorStorageInitDoneAtom())).toBe(false);

    await act(async () => {
      await result.current.reloadActiveAccountInfo({
        num: 0,
        selectedAccount: defaultSelectedAccount(),
      });
    });

    expect(store.get(accountSelectorActiveAccountInitDoneAtom())?.[0]).toBe(
      true,
    );

    await act(async () => {
      selectedAccountsMapDeferred.resolve(undefined);
      await initFromStoragePromise;
    });

    expect(store.get(accountSelectorStorageInitDoneAtom())).toBe(true);
    expect(store.get(accountSelectorActiveAccountInitDoneAtom())?.[0]).toBe(
      true,
    );
  });

  it('marks storage and active account init done when storage loading fails', async () => {
    mockGetSelectedAccountsMap.mockRejectedValue(
      new Error('storage loading failed'),
    );

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorActiveAccountInitDoneAtom(), { 0: true });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.initFromStorage({
          sceneName: EAccountSelectorSceneName.home,
        }),
      ).resolves.toBeUndefined();
    });

    expect(store.get(accountSelectorStorageReadyAtom())).toBe(true);
    expect(store.get(accountSelectorStorageInitDoneAtom())).toBe(true);
    expect(store.get(accountSelectorActiveAccountInitDoneAtom())?.[0]).toBe(
      true,
    );
  });

  it('creates TON imported wallets through the background service', async () => {
    const accountId = 'imported--607--ton';
    const mnemonic = 'encoded-ton-mnemonic';
    const waitSpy = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    mockAddTonImportedAccountByMnemonic.mockResolvedValue({
      networkId: getNetworkIdsMap().ton,
      walletId: WALLET_TYPE_IMPORTED,
      accounts: [{ id: accountId } as IDBAccount],
      isOverrideAccounts: false,
    });

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    try {
      await act(async () => {
        await result.current.createTonImportedWallet({ mnemonic });
      });
    } finally {
      waitSpy.mockRestore();
    }

    expect(mockAddTonImportedAccountByMnemonic).toHaveBeenCalledWith({
      mnemonic,
      name: '',
      shouldCheckDuplicateName: true,
    });
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      networkId: getNetworkIdsMap().ton,
      walletId: WALLET_TYPE_IMPORTED,
      focusedWallet: WALLET_TYPE_IMPORTED,
      indexedAccountId: undefined,
      othersWalletAccountId: accountId,
    });
  });

  it('normalizes imported account network pairs before saving to storage', async () => {
    const btcAccountId =
      'imported--0--xpub6CgTVumLgde7C8aBr9Zfbn6LeJN347raED9oW6ZCfbwEqeQodRGLUvrjK3ec3uNbGYxMcxRJ5Q5grxip4Bd5XWmnai12tkdTLkTepQiAdnR--P2TR';
    const mismatchedSelectedAccount = {
      ...defaultSelectedAccount(),
      walletId: WALLET_TYPE_IMPORTED,
      focusedWallet: WALLET_TYPE_IMPORTED,
      networkId: 'cfx--1029',
      deriveType: 'default' as const,
      othersWalletAccountId: btcAccountId,
    };
    mockGetSelectedAccount.mockResolvedValue(undefined);
    mockGetDBAccount.mockResolvedValue({
      id: btcAccountId,
      impl: 'btc',
      createAtNetwork: 'btc--0',
      networks: ['btc--0'],
    } as IDBAccount);
    mockFixOthersWalletAccountNetworkPair.mockImplementation(
      async ({ selectedAccount }) => ({
        ...selectedAccount,
        networkId: 'btc--0',
      }),
    );

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: mismatchedSelectedAccount,
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.saveToStorage({
        selectedAccount: mismatchedSelectedAccount,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: Date.now(),
      });
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccount: expect.objectContaining({
          walletId: WALLET_TYPE_IMPORTED,
          focusedWallet: WALLET_TYPE_IMPORTED,
          networkId: 'btc--0',
          othersWalletAccountId: btcAccountId,
        }),
      }),
    );
  });

  it('skips persisting an all-default selected account', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.saveToStorage({
        selectedAccount: defaultSelectedAccount(),
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: Date.now(),
      });
    });

    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).not.toHaveBeenCalled();
  });

  it('does not persist a network-only cold-start selection over a saved account', async () => {
    mockGetSelectedAccount.mockResolvedValue(
      createHdSelectedAccount('hd-1--1'),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.saveToStorage({
        selectedAccount: {
          ...defaultSelectedAccount(),
          networkId: 'tron--0x2b6653dc',
          deriveType: 'default',
          focusedWallet: 'hd-1',
        },
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: Date.now(),
      });
    });

    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).not.toHaveBeenCalled();
  });

  it('does not persist a stale selected account after the current account changes', async () => {
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--1'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        updatedAt: 2000,
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.saveToStorage({
        selectedAccount: createHdSelectedAccount('hd-1--0'),
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: 1000,
      });
    });

    expect(mockGetSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).not.toHaveBeenCalled();
  });

  it('does not persist an incompatible others wallet account and network pair', async () => {
    const currentBtcAccount = {
      id: 'imported--btc-p2tr',
      impl: 'btc',
      createAtNetwork: 'btc--0',
      networks: ['btc--0'],
    } as IDBAccount;
    const selectedAccount: ISelectedAccount = {
      ...defaultSelectedAccount(),
      walletId: WALLET_TYPE_IMPORTED,
      othersWalletAccountId: currentBtcAccount.id,
      networkId: 'evm--42161',
      deriveType: 'default',
      focusedWallet: WALLET_TYPE_IMPORTED,
    };

    mockGetDBAccount.mockResolvedValue(currentBtcAccount);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: selectedAccount,
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.saveToStorage({
        selectedAccount,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: Date.now(),
      });
    });

    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).not.toHaveBeenCalled();
  });

  it('does not sync an event-disabled swap source save back to home', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    mockShouldSyncWithHomeSource.mockResolvedValue(true);

    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    store.set(selectedAccountsAtom(), {
      0: selectedAccount,
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: true,
        updatedAt: 2000,
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.saveToStorage({
        selectedAccount,
        sceneName: EAccountSelectorSceneName.swap,
        num: 0,
        selectedAccountUpdatedAt: 2000,
      });
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
    expect(mockShouldSyncWithHomeSource).not.toHaveBeenCalled();
  });

  it('ignores stale home-swap sync events when current selection is newer', async () => {
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(true);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--1'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        updatedAt: 2000,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const staleEventPayload = {
      selectedAccount: createHdSelectedAccount('hd-1--0'),
      selectedAccountUpdatedAt: 1000,
      sceneName: EAccountSelectorSceneName.swap,
      num: 0,
    };

    await act(async () => {
      await result.current.syncHomeAndSwapSelectedAccount({
        eventPayload: staleEventPayload,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
  });

  it('keeps a restored indexed account when active account is temporarily incomplete', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--1');

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: selectedAccount,
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: { id: 'hd-1' } as IWallet,
        network: { id: 'tron--0x2b6653dc' } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['network']
        >,
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--1',
      focusedWallet: 'hd-1',
    });
  });

  it('keeps a restored indexed account when active wallet is temporarily missing', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--1');

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: selectedAccount,
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--1',
      focusedWallet: 'hd-1',
    });
  });

  it('restores the active indexed account from a network-only cold-start selection', async () => {
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        networkId: 'tron--0x2b6653dc',
        deriveType: 'default' as const,
      },
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: { id: 'hd-1' } as IWallet,
        indexedAccount: { id: 'hd-1--1', walletId: 'hd-1' } as IIndexedAccount,
        account: {
          id: "hd-1--m/44'/195'/1'/0/0",
          indexedAccountId: 'hd-1--1',
        } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['account']
        >,
        dbAccount: {
          id: "hd-1--m/44'/195'/1'/0/0",
          indexedAccountId: 'hd-1--1',
        } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['dbAccount']
        >,
        network: { id: 'tron--0x2b6653dc' } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['network']
        >,
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--1',
      focusedWallet: 'hd-1',
      networkId: 'tron--0x2b6653dc',
      deriveType: 'default',
    });
  });

  it('falls back to the first indexed account when restored indexed account no longer exists', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--99');

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: selectedAccount,
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: { id: 'hd-1' } as IWallet,
        network: { id: 'tron--0x2b6653dc' } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['network']
        >,
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      focusedWallet: 'hd-1',
    });
  });

  it('keeps swap all-network auto-select fallback local to swap', async () => {
    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        networkId: getNetworkIdsMap().onekeyall,
        deriveType: 'default' as const,
      },
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: { id: 'hd-1' } as IWallet,
        network: { id: getNetworkIdsMap().onekeyall } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['network']
        >,
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.swap,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      focusedWallet: 'hd-1',
      networkId: getNetworkIdsMap().onekeyall,
      deriveType: 'default',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]).toMatchObject({
      eventEmitDisabled: true,
    });
  });

  it('repairs an incompatible others wallet pair kept from a recent in-memory selection', async () => {
    const currentBtcAccount = {
      id: 'imported--btc-p2tr',
      impl: 'btc',
      createAtNetwork: 'btc--0',
      networks: ['btc--0'],
    } as IDBAccount;
    const matchingEvmAccount = {
      id: 'imported--evm-account',
      impl: 'evm',
      createAtNetwork: 'evm--1',
    } as IDBAccount;

    mockGetSelectedAccountsMap.mockResolvedValue(undefined);
    mockGetDBAccount.mockResolvedValue(currentBtcAccount);
    mockGetSingletonAccountsOfWallet.mockResolvedValue({
      accounts: [currentBtcAccount, matchingEvmAccount],
    });

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: WALLET_TYPE_IMPORTED,
        othersWalletAccountId: currentBtcAccount.id,
        networkId: 'evm--42161',
        deriveType: 'default' as const,
        focusedWallet: WALLET_TYPE_IMPORTED,
      },
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        updatedAt: Date.now(),
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: WALLET_TYPE_IMPORTED,
      focusedWallet: WALLET_TYPE_IMPORTED,
      indexedAccountId: undefined,
      othersWalletAccountId: matchingEvmAccount.id,
      networkId: 'evm--42161',
      deriveType: 'default',
    });
  });

  it('clears a restored mocked hardware wallet selection during storage init', async () => {
    const staleSelection = {
      ...defaultSelectedAccount(),
      walletId: 'hw-standard',
      indexedAccountId: 'hw-standard--0',
      networkId: 'onekeyall',
      deriveType: 'default' as const,
      focusedWallet: 'hw-standard',
    };
    const mockedStandardWallet = {
      id: 'hw-standard',
      name: 'Standard wallet',
      isMocked: true,
    } as IWallet;

    mockGetSelectedAccountsMap.mockResolvedValue({
      0: staleSelection,
    });
    mockGetWalletSafe.mockResolvedValue(mockedStandardWallet);

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: undefined,
      focusedWallet: undefined,
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
      networkId: 'onekeyall',
    });
    expect(mockSaveSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccount: expect.objectContaining({
          walletId: undefined,
          focusedWallet: undefined,
          indexedAccountId: undefined,
          othersWalletAccountId: undefined,
          networkId: 'onekeyall',
        }),
      }),
    );
  });

  it('syncs home when storage init clears an unavailable home-sync source wallet', async () => {
    const staleHomeSelection = {
      ...defaultSelectedAccount(),
      walletId: 'hw-zombie',
      indexedAccountId: 'hw-zombie--0',
      networkId: 'evm--1',
      deriveType: 'default' as const,
      focusedWallet: 'hw-zombie',
    };
    const clearedSelection = {
      ...defaultSelectedAccount(),
      networkId: 'evm--1',
      deriveType: 'default' as const,
    };
    const mockedWallet = {
      id: 'hw-zombie',
      name: 'Removed wallet',
      isMocked: true,
    } as IWallet;

    mockGetSelectedAccountsMap.mockResolvedValue({
      0: clearedSelection,
    });
    mockMergeHomeDataToSwapMap.mockImplementation(async ({ swapMap }) => ({
      ...swapMap,
      0: staleHomeSelection,
    }));
    mockGetWalletSafe.mockResolvedValue(mockedWallet);
    mockGetSelectedAccount.mockImplementation(async ({ sceneName }) =>
      sceneName === EAccountSelectorSceneName.home
        ? staleHomeSelection
        : clearedSelection,
    );
    mockShouldSyncWithHomeSource.mockResolvedValue(true);

    const { Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.swap,
      });
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccount: expect.objectContaining({
          walletId: undefined,
          focusedWallet: undefined,
          indexedAccountId: undefined,
          othersWalletAccountId: undefined,
          networkId: 'evm--1',
        }),
      }),
    );
    expect(mockSaveSelectedAccount).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sceneName: EAccountSelectorSceneName.swap,
      }),
    );
  });

  it('keeps a locked temp hidden wallet selection during storage init', async () => {
    const lockedHiddenWalletSelection = {
      ...defaultSelectedAccount(),
      walletId: 'hw-standard--hidden',
      indexedAccountId: 'hw-standard--hidden-indexed-1',
      networkId: 'onekeyall',
      deriveType: 'default' as const,
      focusedWallet: 'hw-standard--hidden',
    };
    const lockedHiddenWallet = {
      id: 'hw-standard--hidden',
      name: 'Hidden wallet',
      isTemp: true,
    } as IWallet;

    mockGetSelectedAccountsMap.mockResolvedValue({
      0: lockedHiddenWalletSelection,
    });
    mockGetWalletSafe.mockResolvedValue(lockedHiddenWallet);
    mockIsTempWalletRemoved.mockResolvedValue(true);

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: lockedHiddenWallet.id,
      focusedWallet: lockedHiddenWallet.id,
      indexedAccountId: lockedHiddenWalletSelection.indexedAccountId,
      networkId: 'onekeyall',
    });
    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
  });

  it('selects an empty hardware wallet after a hidden wallet becomes unavailable', async () => {
    const hiddenWalletSelection = {
      ...defaultSelectedAccount(),
      walletId: 'hw-standard--hidden',
      indexedAccountId: 'hw-standard--hidden-indexed-1',
      networkId: 'onekeyall',
      deriveType: 'default' as const,
      focusedWallet: 'hw-standard--hidden',
    };
    const standardWallet = {
      id: 'hw-standard',
      name: 'Standard wallet',
    } as IWallet;

    mockGetAllHdHwQrWallets.mockResolvedValue({
      wallets: [standardWallet],
    });
    mockIsWalletHasIndexedAccounts.mockResolvedValue(false);
    mockGetIndexedAccountsOfWallet.mockResolvedValue({ accounts: [] });
    mockGetWalletSafe.mockResolvedValue(standardWallet);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: hiddenWalletSelection,
    });
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        network: {
          id: 'onekeyall',
        } as ReturnType<typeof defaultActiveAccountInfo>['network'],
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hw-standard',
      focusedWallet: 'hw-standard',
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
    });
  });

  it('keeps a wallet with indexed accounts when replacing a mocked wallet', async () => {
    const hiddenWalletSelection = {
      ...defaultSelectedAccount(),
      walletId: 'hw-standard--hidden',
      indexedAccountId: 'hw-standard--hidden-indexed-1',
      networkId: 'evm--1',
      deriveType: 'default' as const,
      focusedWallet: 'hw-standard--hidden',
    };
    const mockedHiddenWallet = {
      id: 'hw-standard--hidden',
      name: 'Hidden wallet',
      isMocked: true,
    } as IWallet;
    const emptyWallet = {
      id: 'hw-empty',
      name: 'Empty wallet',
    } as IWallet;
    const walletWithAccounts = {
      id: 'hw-with-accounts',
      name: 'Wallet with accounts',
    } as IWallet;
    const indexedAccount = {
      id: 'hw-with-accounts-indexed-1',
      walletId: walletWithAccounts.id,
    } as IIndexedAccount;

    mockGetAllHdHwQrWallets.mockResolvedValue({
      wallets: [emptyWallet, walletWithAccounts],
    });
    mockIsWalletHasIndexedAccounts.mockImplementation(
      async ({ walletId }) => walletId === walletWithAccounts.id,
    );
    mockGetIndexedAccountsOfWallet.mockImplementation(async ({ walletId }) => ({
      accounts: walletId === walletWithAccounts.id ? [indexedAccount] : [],
    }));
    mockGetWalletSafe.mockImplementation(async ({ walletId }) => {
      if (walletId === mockedHiddenWallet.id) {
        return mockedHiddenWallet;
      }
      if (walletId === emptyWallet.id) {
        return emptyWallet;
      }
      if (walletId === walletWithAccounts.id) {
        return walletWithAccounts;
      }
      return undefined;
    });

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: hiddenWalletSelection,
    });
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: mockedHiddenWallet,
        network: {
          id: 'evm--1',
        } as ReturnType<typeof defaultActiveAccountInfo>['network'],
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: walletWithAccounts.id,
      focusedWallet: walletWithAccounts.id,
      indexedAccountId: indexedAccount.id,
      othersWalletAccountId: undefined,
    });
  });

  it('selects an empty hardware wallet after a temp hidden wallet is removed', async () => {
    const hiddenWalletSelection = {
      ...defaultSelectedAccount(),
      walletId: 'hw-standard--hidden',
      indexedAccountId: 'hw-standard--hidden-indexed-1',
      networkId: 'evm--1',
      deriveType: 'default' as const,
      focusedWallet: 'hw-standard--hidden',
    };
    const hiddenWallet = {
      id: 'hw-standard--hidden',
      name: 'Hidden wallet',
      isTemp: true,
    } as IWallet;
    const standardWallet = {
      id: 'hw-standard',
      name: 'Standard wallet',
    } as IWallet;

    mockGetAllHdHwQrWallets.mockResolvedValue({
      wallets: [standardWallet],
    });
    mockIsWalletHasIndexedAccounts.mockResolvedValue(true);
    mockGetIndexedAccountsOfWallet.mockResolvedValue({ accounts: [] });
    mockGetWalletSafe.mockImplementation(async ({ walletId }) => {
      if (walletId === hiddenWallet.id) {
        return hiddenWallet;
      }
      return standardWallet;
    });
    mockIsTempWalletRemoved.mockImplementation(
      async ({ wallet }) => wallet.id === hiddenWallet.id,
    );

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: hiddenWalletSelection,
    });
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        network: {
          id: 'evm--1',
        } as ReturnType<typeof defaultActiveAccountInfo>['network'],
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hw-standard',
      focusedWallet: 'hw-standard',
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
    });
  });

  it('clears a temp hidden wallet without persisting when no usable fallback exists', async () => {
    const hiddenWalletSelection = {
      ...defaultSelectedAccount(),
      walletId: 'hw-standard--hidden',
      indexedAccountId: 'hw-standard--hidden-indexed-1',
      networkId: 'onekeyall',
      deriveType: 'default' as const,
      focusedWallet: 'hw-standard--hidden',
    };
    const hiddenWallet = {
      id: 'hw-standard--hidden',
      name: 'Hidden wallet',
      isTemp: true,
    } as IWallet;
    const mockedStandardWallet = {
      id: 'hw-standard',
      name: 'Standard wallet',
      isMocked: true,
    } as IWallet;

    mockGetAllHdHwQrWallets.mockResolvedValue({
      wallets: [mockedStandardWallet],
    });
    mockGetWalletSafe.mockImplementation(async ({ walletId }) => {
      if (walletId === hiddenWallet.id) {
        return hiddenWallet;
      }
      if (walletId === mockedStandardWallet.id) {
        return mockedStandardWallet;
      }
      return undefined;
    });
    mockIsTempWalletRemoved.mockImplementation(
      async ({ wallet }) => wallet.id === hiddenWallet.id,
    );

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: hiddenWalletSelection,
    });
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        network: {
          id: 'onekeyall',
        } as ReturnType<typeof defaultActiveAccountInfo>['network'],
        account: {
          id: 'mocked-all-network-account',
        } as ReturnType<typeof defaultActiveAccountInfo>['account'],
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    const selectedAccountInState = store.get(selectedAccountsAtom())[0];
    expect(selectedAccountInState).toMatchObject({
      walletId: undefined,
      focusedWallet: undefined,
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
      networkId: 'onekeyall',
    });

    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
  });

  it('clears an empty standard wallet selection after the standard wallet is removed', async () => {
    const standardWalletSelection = {
      ...defaultSelectedAccount(),
      walletId: 'hw-standard',
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
      networkId: 'onekeyall',
      deriveType: 'default' as const,
      focusedWallet: 'hw-standard',
    };
    const staleActiveStandardWallet = {
      id: 'hw-standard',
      name: 'Standard wallet',
    } as IWallet;
    const mockedStandardWallet = {
      id: 'hw-standard',
      name: 'Standard wallet',
      isMocked: true,
    } as IWallet;

    mockGetAllHdHwQrWallets.mockResolvedValue({
      wallets: [mockedStandardWallet],
    });
    mockIsWalletHasIndexedAccounts.mockResolvedValue(false);
    mockGetIndexedAccountsOfWallet.mockResolvedValue({ accounts: [] });
    mockGetWalletSafe.mockResolvedValue(mockedStandardWallet);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: standardWalletSelection,
    });
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: staleActiveStandardWallet,
        network: {
          id: 'onekeyall',
        } as ReturnType<typeof defaultActiveAccountInfo>['network'],
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: undefined,
      focusedWallet: undefined,
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
      networkId: 'onekeyall',
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccount: expect.objectContaining({
          walletId: undefined,
          focusedWallet: undefined,
          indexedAccountId: undefined,
          othersWalletAccountId: undefined,
          networkId: 'onekeyall',
        }),
      }),
    );
  });

  // OK-57139: the dApp connection record is the single source of truth for
  // discover scenes. The cold-start keep/restore logic must never resurrect
  // a stale browser-side selection over a connection record that background
  // has since re-aligned to the wallet account.
  describe('discover scene init must follow the dApp connection record', () => {
    const dappOrigin = 'https://1inch.com';
    const staleSelectedAccount = {
      ...defaultSelectedAccount(),
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      focusedWallet: 'hd-1',
      networkId: 'evm--1',
      deriveType: 'default' as const,
    };
    const alignedConnectionAccount = {
      walletId: 'hd-2',
      indexedAccountId: 'hd-2--1',
      focusedWallet: 'hd-2',
      networkId: 'evm--1',
      deriveType: 'default' as const,
    };

    it('applies the connection record even when a recent stale selection exists in memory', async () => {
      mockGetSelectedAccountsMap.mockResolvedValue(undefined);
      mockGetDappAccountSelectorMap.mockResolvedValue({
        0: { ...alignedConnectionAccount },
      });

      const { store, Wrapper } = createWrapper({
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: dappOrigin,
      });
      // Simulate a browser-side account switch made moments ago: the stale
      // account sits in memory with a fresh updateMeta timestamp, exactly
      // the state that used to win over the re-aligned connection record.
      store.set(selectedAccountsAtom(), {
        0: { ...staleSelectedAccount },
      });
      store.set(accountSelectorUpdateMetaAtom(), {
        0: {
          eventEmitDisabled: false,
          updatedAt: Date.now(),
        },
      });

      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.initFromStorage({
          sceneName: EAccountSelectorSceneName.discover,
          sceneUrl: dappOrigin,
        });
      });

      expect(store.get(selectedAccountsAtom())[0]).toEqual(
        alignedConnectionAccount,
      );
      expect(store.get(accountSelectorStorageInitDoneAtom())).toBe(true);
    });

    it('never reads or writes the recent-selection cache for discover scenes', () => {
      const actions = getAccountSelectorActions();

      expect(
        actions.buildAccountSelectorRecentSelectionCacheSceneId({
          sceneName: EAccountSelectorSceneName.discover,
          sceneUrl: dappOrigin,
        }),
      ).toBeUndefined();
      expect(
        actions.buildAccountSelectorRecentSelectionCacheSceneId({
          sceneName: EAccountSelectorSceneName.home,
        }),
      ).toBe(EAccountSelectorSceneName.home);
    });

    it('does not write generic cold-start snapshots for discover scenes', async () => {
      const actions = getAccountSelectorActions();

      await actions.flushAccountSelectorColdStartSnapshot({
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: dappOrigin,
        selectedAccounts: {
          0: { ...staleSelectedAccount },
        },
        updateMeta: {
          0: {
            eventEmitDisabled: false,
            updatedAt: Date.now(),
          },
        },
      });

      expect(mockWriteContextAtomColdStartCacheValues).not.toHaveBeenCalled();
    });

    it('still keeps a recent in-memory selection for the home scene (cold-start protection intact)', async () => {
      const homeRecentSelectedAccount = {
        ...defaultSelectedAccount(),
        walletId: 'hd-3',
        indexedAccountId: 'hd-3--2',
        focusedWallet: 'hd-3',
        networkId: 'evm--1',
        deriveType: 'default' as const,
      };
      const homeSelectedAccountInDB = {
        ...defaultSelectedAccount(),
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--0',
        focusedWallet: 'hd-1',
        networkId: 'evm--1',
        deriveType: 'default' as const,
      };
      mockGetSelectedAccountsMap.mockResolvedValue({
        0: homeSelectedAccountInDB,
      });

      const { store, Wrapper } = createWrapper();
      store.set(selectedAccountsAtom(), {
        0: { ...homeRecentSelectedAccount },
      });
      store.set(accountSelectorUpdateMetaAtom(), {
        0: {
          eventEmitDisabled: false,
          updatedAt: Date.now(),
        },
      });

      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });
      const recentCacheSpy = jest
        .spyOn(
          getAccountSelectorActions(),
          'getRecentAccountSelectorSelectionCache',
        )
        .mockReturnValue(undefined);

      try {
        await act(async () => {
          await result.current.initFromStorage({
            sceneName: EAccountSelectorSceneName.home,
          });
        });
      } finally {
        recentCacheSpy.mockRestore();
      }

      expect(store.get(selectedAccountsAtom())[0]).toEqual(
        homeRecentSelectedAccount,
      );
    });
  });
});

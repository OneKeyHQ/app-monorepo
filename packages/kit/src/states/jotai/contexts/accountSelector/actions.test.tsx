/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useAccountSelectorActions } from './actions';
import {
  AccountSelectorJotaiProvider,
  accountSelectorActiveAccountInitDoneAtom,
  accountSelectorContextDataAtom,
  accountSelectorStorageInitDoneAtom,
  accountSelectorStorageReadyAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';

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
type IIndexedAccount = NonNullable<
  ReturnType<typeof defaultActiveAccountInfo>['indexedAccount']
>;
type IWallet = NonNullable<
  ReturnType<typeof defaultActiveAccountInfo>['wallet']
>;

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
const mockBuildActiveAccountInfoFromSelectedAccount: jest.MockedFunction<
  () => Promise<IBuildActiveAccountInfoResult>
> = jest.fn();
const mockFixDeriveTypesForInitAccountSelectorMap: jest.MockedFunction<
  (
    params: IFixDeriveTypesForInitAccountSelectorMapParams,
  ) => Promise<ISelectedAccountsMap | undefined>
> = jest.fn();
const mockGetSelectedAccount: jest.MockedFunction<
  () => Promise<ISelectedAccount | undefined>
> = jest.fn();
const mockSaveSelectedAccount: jest.MockedFunction<() => Promise<void>> =
  jest.fn();
const mockSaveGlobalDeriveType: jest.MockedFunction<() => Promise<void>> =
  jest.fn();
const mockShouldSyncWithHomeSource: jest.MockedFunction<
  () => Promise<boolean>
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
    },
    serviceAccountSelector: {
      buildActiveAccountInfoFromSelectedAccount: () =>
        mockBuildActiveAccountInfoFromSelectedAccount(),
      fixDeriveTypesForInitAccountSelectorMap: (
        params: IFixDeriveTypesForInitAccountSelectorMapParams,
      ) => mockFixDeriveTypesForInitAccountSelectorMap(params),
      getGlobalDeriveType: () => mockGetGlobalDeriveType(),
      saveGlobalDeriveType: () => mockSaveGlobalDeriveType(),
      shouldSyncHomeAndSwapSelectedAccount: () =>
        mockShouldSyncHomeAndSwapSelectedAccount(),
      shouldSyncWithHomeSource: () => mockShouldSyncWithHomeSource(),
      shouldUseGlobalDeriveType: () => mockShouldUseGlobalDeriveType(),
    },
    serviceNetwork: {
      isDeriveTypeAvailableForNetwork: () =>
        mockIsDeriveTypeAvailableForNetwork(),
    },
    simpleDb: {
      accountSelector: {
        getSelectedAccount: () => mockGetSelectedAccount(),
        getSelectedAccountsMap: () => mockGetSelectedAccountsMap(),
        saveSelectedAccount: () => mockSaveSelectedAccount(),
      },
      dappConnection: {
        getAccountSelectorMap: jest.fn(async () => undefined),
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

function createWrapper(sceneName = EAccountSelectorSceneName.home) {
  const store = createStore();
  store.set(accountSelectorStorageReadyAtom(), true);
  store.set(accountSelectorStorageInitDoneAtom(), false);
  store.set(accountSelectorActiveAccountInitDoneAtom(), {});
  store.set(selectedAccountsAtom(), {
    0: defaultSelectedAccount(),
  });

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <AccountSelectorJotaiProvider store={store} config={{ sceneName }}>
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

function getRecentSelectionCache() {
  return mockColdStartCacheStorageData.get(
    EAppSyncStorageKeys.onekey_account_selector_recent_selection,
  ) as
    | Record<
        string,
        {
          selectedAccountsMap?: ISelectedAccountsMap;
        }
      >
    | undefined;
}

describe('useAccountSelectorActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockColdStartCacheStorageData.clear();
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
    mockGetGlobalDeriveType.mockResolvedValue('default');
    mockShouldUseGlobalDeriveType.mockResolvedValue(true);
    mockIsDeriveTypeAvailableForNetwork.mockResolvedValue(true);
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(false);
    mockShouldSyncWithHomeSource.mockResolvedValue(false);
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
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });
    expect(store.get(accountSelectorContextDataAtom())?.sceneName).toBe(
      EAccountSelectorSceneName.home,
    );
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
        deriveType: 'default',
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

  it('keeps swap all-network auto-select fallback local to swap', async () => {
    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        networkId: 'onekeyall--0',
        deriveType: 'default',
      },
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: { id: 'hd-1' } as IWallet,
        network: { id: 'onekeyall--0' } as NonNullable<
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
      networkId: 'onekeyall--0',
      deriveType: 'default',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]).toMatchObject({
      eventEmitDisabled: true,
    });
  });

  it('repairs an incompatible others wallet account restored from storage', async () => {
    const currentBtcAccount = {
      id: 'imported--btc-p2tr',
      impl: 'btc',
      createAtNetwork: 'btc--0',
    } as IDBAccount;
    const matchingEvmAccount = {
      id: 'imported--evm-account',
      impl: 'evm',
      createAtNetwork: 'evm--1',
    } as IDBAccount;

    mockGetSelectedAccountsMap.mockResolvedValue({
      0: {
        ...defaultSelectedAccount(),
        walletId: 'imported',
        othersWalletAccountId: currentBtcAccount.id,
        networkId: 'evm--42161',
        deriveType: 'default',
        focusedWallet: 'imported',
      },
    });
    mockGetDBAccount.mockResolvedValue(currentBtcAccount);
    mockGetSingletonAccountsOfWallet.mockResolvedValue({
      accounts: [currentBtcAccount, matchingEvmAccount],
    });

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
      walletId: 'imported',
      focusedWallet: 'imported',
      indexedAccountId: undefined,
      othersWalletAccountId: matchingEvmAccount.id,
      networkId: 'evm--42161',
      deriveType: 'default',
    });
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

  it('does not persist an incompatible others wallet account and network pair', async () => {
    const currentBtcAccount = {
      id: 'imported--btc-p2tr',
      impl: 'btc',
      createAtNetwork: 'btc--0',
    } as IDBAccount;
    const selectedAccount: ISelectedAccount = {
      ...defaultSelectedAccount(),
      walletId: 'imported',
      othersWalletAccountId: currentBtcAccount.id,
      networkId: 'evm--42161',
      deriveType: 'default',
      focusedWallet: 'imported',
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

  it('writes recent selection cache immediately when switching network', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: selectedAccount,
    });
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.updateSelectedAccountNetwork({
        num: 0,
        networkId: 'sui--mainnet',
      });
    });

    expect(store.get(selectedAccountsAtom())[0]?.networkId).toBe(
      'sui--mainnet',
    );

    const recentSelectionCache = getRecentSelectionCache();

    expect(
      recentSelectionCache?.[EAccountSelectorSceneName.home]
        ?.selectedAccountsMap?.[0],
    ).toMatchObject({
      indexedAccountId: 'hd-1--0',
      networkId: 'sui--mainnet',
      walletId: 'hd-1',
    });
    expect(mockColdStartCacheStorage.setObject).toHaveBeenCalledWith(
      EAppSyncStorageKeys.onekey_account_selector_recent_selection,
      expect.any(Object),
    );
    expect(mockFlushColdStartCacheNow).toHaveBeenCalled();
  });

  it('keeps the home recent-cache network when swap syncs the same indexed account', async () => {
    const homeSelectedAccount: ISelectedAccount = {
      ...defaultSelectedAccount(),
      walletId: 'hd-2',
      indexedAccountId: 'hd-2--4',
      networkId: 'aptos--1',
      deriveType: 'default',
      focusedWallet: 'hd-2',
    };
    const swapSelectedAccount: ISelectedAccount = {
      ...homeSelectedAccount,
      networkId: 'evm--42161',
    };

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const updatedAt = Date.now();

    await act(async () => {
      store.set(accountSelectorContextDataAtom(), {
        sceneName: EAccountSelectorSceneName.home,
      });
      await result.current.updateSelectedAccount({
        num: 0,
        updateMeta: {
          eventEmitDisabled: false,
          updatedAt,
        },
        builder: () => homeSelectedAccount,
      });
      store.set(accountSelectorContextDataAtom(), {
        sceneName: EAccountSelectorSceneName.swap,
      });
      await result.current.updateSelectedAccount({
        num: 0,
        updateMeta: {
          eventEmitDisabled: false,
          updatedAt: updatedAt + 1,
        },
        builder: () => swapSelectedAccount,
      });
    });

    expect(
      getRecentSelectionCache()?.[EAccountSelectorSceneName.swap]
        ?.selectedAccountsMap?.[0],
    ).toMatchObject({
      walletId: 'hd-2',
      indexedAccountId: 'hd-2--4',
      networkId: 'evm--42161',
      focusedWallet: 'hd-2',
    });

    expect(
      getRecentSelectionCache()?.[EAccountSelectorSceneName.home]
        ?.selectedAccountsMap?.[0],
    ).toMatchObject({
      walletId: 'hd-2',
      indexedAccountId: 'hd-2--4',
      networkId: 'aptos--1',
      focusedWallet: 'hd-2',
    });

    mockGetSelectedAccountsMap.mockResolvedValue({
      0: homeSelectedAccount,
    });
    store.set(selectedAccountsAtom(), {
      0: defaultSelectedAccount(),
    });
    store.set(accountSelectorUpdateMetaAtom(), {});
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hd-2',
      indexedAccountId: 'hd-2--4',
      networkId: 'aptos--1',
      focusedWallet: 'hd-2',
    });
  });

  it('switches an others wallet account to one that matches the selected network', async () => {
    const currentBtcAccount = {
      id: 'imported--btc-p2tr',
      impl: 'btc',
      createAtNetwork: 'btc--0',
    } as IDBAccount;
    const matchingEvmAccount = {
      id: 'imported--evm-account',
      impl: 'evm',
      createAtNetwork: 'evm--1',
    } as IDBAccount;

    mockGetDBAccount.mockResolvedValue(currentBtcAccount);
    mockGetSingletonAccountsOfWallet.mockResolvedValue({
      accounts: [currentBtcAccount, matchingEvmAccount],
    });

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: 'imported',
        othersWalletAccountId: currentBtcAccount.id,
        networkId: 'btc--0',
        deriveType: 'default',
        focusedWallet: 'imported',
      },
    });
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.updateSelectedAccountNetwork({
        num: 0,
        networkId: 'evm--42161',
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'imported',
      focusedWallet: 'imported',
      indexedAccountId: undefined,
      othersWalletAccountId: matchingEvmAccount.id,
      networkId: 'evm--42161',
      deriveType: 'default',
    });
    expect(
      getRecentSelectionCache()?.[EAccountSelectorSceneName.home]
        ?.selectedAccountsMap?.[0],
    ).toMatchObject({
      walletId: 'imported',
      othersWalletAccountId: matchingEvmAccount.id,
      networkId: 'evm--42161',
    });
  });

  it('preserves concurrent fields while resolving an others wallet network switch', async () => {
    const currentEvmAccount = {
      id: 'imported--evm-account',
      impl: 'evm',
      createAtNetwork: 'evm--1',
    } as IDBAccount;
    const dbAccountDeferred = createDeferred<IDBAccount | undefined>();
    mockGetDBAccount.mockReturnValueOnce(dbAccountDeferred.promise);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: 'imported',
        othersWalletAccountId: currentEvmAccount.id,
        networkId: 'evm--1',
        deriveType: 'default',
        focusedWallet: 'imported',
      },
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    const updatePromise = result.current.updateSelectedAccountNetwork({
      num: 0,
      networkId: 'evm--42161',
    });

    await Promise.resolve();
    await act(async () => {
      await result.current.updateSelectedAccountDeriveType({
        num: 0,
        deriveType: 'ledgerLive',
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      deriveType: 'ledgerLive',
      networkId: 'evm--1',
      othersWalletAccountId: currentEvmAccount.id,
    });

    dbAccountDeferred.resolve(currentEvmAccount);
    await act(async () => {
      await updatePromise;
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      deriveType: 'ledgerLive',
      networkId: 'evm--42161',
      othersWalletAccountId: currentEvmAccount.id,
    });
  });

  it('writes network switch cache before derive type lookup resolves', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const deriveTypeDeferred = createDeferred<string>();
    mockGetGlobalDeriveType.mockReturnValueOnce(deriveTypeDeferred.promise);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: selectedAccount,
    });
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });

    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    const updatePromise = result.current.updateSelectedAccountNetwork({
      num: 0,
      networkId: 'sui--mainnet',
    });

    await Promise.resolve();

    expect(store.get(selectedAccountsAtom())[0]?.networkId).toBe(
      'tron--0x2b6653dc',
    );
    expect(
      getRecentSelectionCache()?.[EAccountSelectorSceneName.home]
        ?.selectedAccountsMap?.[0],
    ).toMatchObject({
      indexedAccountId: 'hd-1--0',
      networkId: 'sui--mainnet',
      walletId: 'hd-1',
    });
    expect(mockFlushColdStartCacheNow).toHaveBeenCalledTimes(1);

    deriveTypeDeferred.resolve('default');
    await act(async () => {
      await updatePromise;
    });

    expect(store.get(selectedAccountsAtom())[0]?.networkId).toBe(
      'sui--mainnet',
    );
    expect(mockFlushColdStartCacheNow).toHaveBeenCalled();
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
});

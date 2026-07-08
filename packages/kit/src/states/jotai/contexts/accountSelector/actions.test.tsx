/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EAccountSelectorAutoSelectTriggerBy,
  EAccountSelectorSceneName,
} from '@onekeyhq/shared/types';

import { useAccountSelectorActions } from './actions';
import {
  AccountSelectorJotaiProvider,
  accountSelectorActiveAccountInitDoneAtom,
  accountSelectorStorageInitDoneAtom,
  accountSelectorStorageReadyAtom,
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
type ISaveSelectedAccountParams = {
  selectedAccount: ISelectedAccount;
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  num: number;
  selectedAccountUpdatedAt?: number;
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
const mockSaveSelectedAccount: jest.MockedFunction<
  (params: ISaveSelectedAccountParams) => Promise<void>
> = jest.fn();
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
        saveSelectedAccount: (params: ISaveSelectedAccountParams) =>
          mockSaveSelectedAccount(params),
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

describe('useAccountSelectorActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
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
});

/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
const mockIsWalletHasIndexedAccounts: jest.MockedFunction<
  ({ walletId }: { walletId: string }) => Promise<boolean>
> = jest.fn();
const mockGetIndexedAccountsOfWallet: jest.MockedFunction<
  ({ walletId }: { walletId: string }) => Promise<{
    accounts: IIndexedAccount[];
  }>
> = jest.fn();
const mockGetSingletonAccountsOfWallet: jest.MockedFunction<
  ({ walletId }: { walletId: string }) => Promise<{
    accounts: [];
  }>
> = jest.fn();
const mockGetWalletSafe: jest.MockedFunction<
  ({ walletId }: { walletId: string }) => Promise<IWallet | undefined>
> = jest.fn();

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
      getSingletonAccountsOfWallet: ({ walletId }: { walletId: string }) =>
        mockGetSingletonAccountsOfWallet({ walletId }),
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
      saveGlobalDeriveType: () => mockSaveGlobalDeriveType(),
      shouldSyncWithHomeSource: () => mockShouldSyncWithHomeSource(),
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

function createWrapper() {
  const store = createStore();
  store.set(accountSelectorStorageReadyAtom(), true);
  store.set(accountSelectorStorageInitDoneAtom(), false);
  store.set(accountSelectorActiveAccountInitDoneAtom(), {});
  store.set(selectedAccountsAtom(), {
    0: defaultSelectedAccount(),
  });

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <AccountSelectorJotaiProvider
        store={store}
        config={{ sceneName: EAccountSelectorSceneName.home }}
      >
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
    mockShouldSyncWithHomeSource.mockResolvedValue(false);
    mockIsWalletHasIndexedAccounts.mockResolvedValue(true);
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

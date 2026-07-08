/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';

import type { IAccountSelectorContextData } from './atoms';

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};
type ISelectedAccountsMap = Partial<
  Record<number, ReturnType<typeof defaultSelectedAccount>>
>;
type IBuildActiveAccountInfoResult = {
  activeAccount: ReturnType<typeof defaultActiveAccountInfo>;
};
type IFixDeriveTypesForInitAccountSelectorMapParams = {
  selectedAccountsMapInDB: ISelectedAccountsMap | undefined;
};
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
const mockWriteContextAtomColdStartCacheValues: jest.MockedFunction<IWriteContextAtomColdStartCacheValues> =
  jest.fn();

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
    serviceAccount: {},
    serviceAccountSelector: {
      buildActiveAccountInfoFromSelectedAccount: () =>
        mockBuildActiveAccountInfoFromSelectedAccount(),
      fixDeriveTypesForInitAccountSelectorMap: (
        params: IFixDeriveTypesForInitAccountSelectorMapParams,
      ) => mockFixDeriveTypesForInitAccountSelectorMap(params),
    },
    simpleDb: {
      accountSelector: {
        getSelectedAccountsMap: () => mockGetSelectedAccountsMap(),
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

function createWrapper(config?: IAccountSelectorContextData) {
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
        config={config ?? { sceneName: EAccountSelectorSceneName.home }}
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

describe('useAccountSelectorActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

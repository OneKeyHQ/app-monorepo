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
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';

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
});

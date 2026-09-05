/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type {
  IDBAccount,
  IDBCreateHwWalletParamsBase,
  IDBCreateQRWalletParams,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import { DeviceNotOpenedPassphrase } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
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
const mockCreateQrWalletService = jest.fn<
  Promise<{
    wallet: IWallet;
    indexedAccount: IIndexedAccount | undefined;
    isOverrideWallet?: boolean;
  }>,
  [IDBCreateQRWalletParams]
>();
const mockCreateHWWalletService = jest.fn();
const mockCreateHWHiddenWalletService = jest.fn();
const mockRestoreTempCreatedWallet = jest.fn();
const mockGetWalletDevice = jest.fn();
const mockGetAllHwQrWalletWithDevice = jest.fn();
const mockUpdateWalletsDeprecatedState = jest.fn();
const mockShowQrHiddenCreateGuideDialogIfErrorMatched = jest.fn();
const mockIsSoftwareWalletOnlyUser = jest.fn();
const mockAddDefaultNetworkAccountsService = jest.fn<
  Promise<{
    addedAccounts: { networkId: string; deriveType: IAccountDeriveTypes }[];
    failedAccounts: {
      networkId: string;
      deriveType: IAccountDeriveTypes;
      error: unknown;
    }[];
  }>,
  [unknown]
>();
const mockGetEnabledNetworksCompatibleWithWalletId = jest.fn<
  Promise<IServerNetwork[]>,
  [{ walletId: string }]
>();
const mockGetAllNetworksFallbackNetworkId = jest.fn<
  Promise<string | undefined>,
  [{ walletId: string }]
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
    default: {
      showDialogIfErrorMatched: (...args: unknown[]) => {
        mockShowQrHiddenCreateGuideDialogIfErrorMatched(...args);
      },
    },
  }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      addTonImportedAccountByMnemonic: (
        ...args: Parameters<typeof mockAddTonImportedAccountByMnemonic>
      ) => mockAddTonImportedAccountByMnemonic(...args),
      createQrWallet: (...args: Parameters<typeof mockCreateQrWalletService>) =>
        mockCreateQrWalletService(...args),
      createHWWallet: (...args: unknown[]): Promise<unknown> =>
        mockCreateHWWalletService(...args) as Promise<unknown>,
      createHWHiddenWallet: (...args: unknown[]): Promise<unknown> =>
        mockCreateHWHiddenWalletService(...args) as Promise<unknown>,
      restoreTempCreatedWallet: (...args: unknown[]): Promise<unknown> =>
        mockRestoreTempCreatedWallet(...args) as Promise<unknown>,
      getWalletDevice: (...args: unknown[]): Promise<unknown> =>
        mockGetWalletDevice(...args) as Promise<unknown>,
      getAllHwQrWalletWithDevice: (...args: unknown[]) =>
        mockGetAllHwQrWalletWithDevice(...args) as Promise<unknown>,
      updateWalletsDeprecatedState: (...args: unknown[]) =>
        mockUpdateWalletsDeprecatedState(...args) as Promise<unknown>,
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
    serviceAccountProfile: {
      isSoftwareWalletOnlyUser: (): Promise<boolean> =>
        mockIsSoftwareWalletOnlyUser() as Promise<boolean>,
    },
    serviceAllNetwork: {
      getAllNetworksFallbackNetworkId: (
        ...args: Parameters<typeof mockGetAllNetworksFallbackNetworkId>
      ) => mockGetAllNetworksFallbackNetworkId(...args),
      getEnabledNetworksCompatibleWithWalletId: (
        ...args: Parameters<typeof mockGetEnabledNetworksCompatibleWithWalletId>
      ) => mockGetEnabledNetworksCompatibleWithWalletId(...args),
    },
    serviceBatchCreateAccount: {
      addDefaultNetworkAccounts: (
        ...args: Parameters<typeof mockAddDefaultNetworkAccountsService>
      ) => mockAddDefaultNetworkAccountsService(...args),
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
    mockGetAllHwQrWalletWithDevice.mockResolvedValue({});
    mockGetWalletDevice.mockResolvedValue(undefined);
    mockUpdateWalletsDeprecatedState.mockResolvedValue(true);
    mockRestoreTempCreatedWallet.mockResolvedValue(undefined);
    mockIsSoftwareWalletOnlyUser.mockResolvedValue(false);
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

  it('selects deprecated wallets but rejects unavailable wallets', async () => {
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const confirm = async (wallet: IWallet | undefined, walletId: string) => {
      mockGetWalletSafe.mockResolvedValueOnce(wallet);
      let confirmed = true;
      await act(async () => {
        confirmed = await result.current.confirmAccountSelect({
          num: 0,
          indexedAccount: {
            id: `${walletId}--0`,
            walletId,
          } as IIndexedAccount,
          othersWalletAccount: undefined,
        });
      });
      return confirmed;
    };

    expect(
      await confirm(
        { id: 'hw-deprecated', deprecated: true } as IWallet,
        'hw-deprecated',
      ),
    ).toBe(true);
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hw-deprecated',
      indexedAccountId: 'hw-deprecated--0',
    });
    expect(
      await confirm(
        { id: 'hw-mocked', isMocked: true } as IWallet,
        'hw-mocked',
      ),
    ).toBe(false);
    expect(await confirm(undefined, 'hw-missing')).toBe(false);
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

  describe('createQrWallet onboarding network selection', () => {
    const qrWallet = { id: 'qr-1' } as IWallet;
    const qrIndexedAccount = {
      id: 'qr-1--0',
      walletId: 'qr-1',
    } as IIndexedAccount;
    const qrDevice = {
      deviceId: 'qr-device-1',
    } as unknown as IDBCreateQRWalletParams['qrDevice'];

    function seedAllNetworksSelection(
      store: ReturnType<typeof createWrapper>['store'],
    ) {
      store.set(selectedAccountsAtom(), {
        0: {
          ...defaultSelectedAccount(),
          walletId: 'hd-1',
          indexedAccountId: 'hd-1--0',
          focusedWallet: 'hd-1',
          networkId: getNetworkIdsMap().onekeyall,
          deriveType: 'default',
        },
      });
    }

    beforeEach(() => {
      mockCreateQrWalletService.mockResolvedValue({
        wallet: qrWallet,
        indexedAccount: qrIndexedAccount,
        isOverrideWallet: false,
      });
      mockAddDefaultNetworkAccountsService.mockResolvedValue({
        addedAccounts: [
          { networkId: 'btc--0', deriveType: 'default' },
          { networkId: 'evm--1', deriveType: 'default' },
        ],
        failedAccounts: [],
      });
    });

    it('falls back to the first added network when All Networks has no compatible enabled networks', async () => {
      mockGetEnabledNetworksCompatibleWithWalletId.mockResolvedValue([]);

      const { store, Wrapper } = createWrapper();
      seedAllNetworksSelection(store);
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.createQrWallet({
          qrDevice,
          airGapAccounts: [],
          isOnboarding: true,
        });
      });

      expect(mockGetEnabledNetworksCompatibleWithWalletId).toHaveBeenCalledWith(
        {
          walletId: 'qr-1',
        },
      );
      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        indexedAccountId: 'qr-1--0',
        networkId: 'btc--0',
        deriveType: 'default',
      });
    });

    it('keeps All Networks when compatible enabled networks exist', async () => {
      mockGetEnabledNetworksCompatibleWithWalletId.mockResolvedValue([
        { id: 'evm--1' } as IServerNetwork,
      ]);

      const { store, Wrapper } = createWrapper();
      seedAllNetworksSelection(store);
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.createQrWallet({
          qrDevice,
          airGapAccounts: [],
          isOnboarding: true,
        });
      });

      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        indexedAccountId: 'qr-1--0',
        networkId: getNetworkIdsMap().onekeyall,
        deriveType: 'default',
      });
    });

    it('keeps All Networks when the compatibility check fails', async () => {
      mockGetEnabledNetworksCompatibleWithWalletId.mockRejectedValue(
        new Error('bg call failed'),
      );

      const { store, Wrapper } = createWrapper();
      seedAllNetworksSelection(store);
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.createQrWallet({
          qrDevice,
          airGapAccounts: [],
          isOnboarding: true,
        });
      });

      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        networkId: getNetworkIdsMap().onekeyall,
        deriveType: 'default',
      });
    });
  });

  describe('hidden hardware wallet reset finalization', () => {
    const currentDevice = {
      id: 'db-device-current',
      connectId: 'pro2-usb',
      deviceId: 'device-id-current',
    };
    const standardWallet = {
      id: 'hw-current',
      associatedDevice: currentDevice.id,
      deprecated: false,
      isMocked: true,
    } as IWallet;
    const standardIndexedAccount = {
      id: 'hw-current--0',
      walletId: standardWallet.id,
    } as IIndexedAccount;
    const hiddenWallet = {
      id: 'hw-current-hidden',
      associatedDevice: currentDevice.id,
      deprecated: false,
      passphraseState: 'hidden-state',
    } as IWallet;
    const hiddenIndexedAccount = {
      id: 'hw-current-hidden--0',
      walletId: hiddenWallet.id,
    } as IIndexedAccount;
    const createParams = {
      device: currentDevice,
      features: {
        passphrase_protection: true,
      },
      hideCheckingDeviceLoading: true,
    } as unknown as IDBCreateHwWalletParamsBase;

    beforeEach(() => {
      mockCreateHWWalletService.mockResolvedValue({
        wallet: standardWallet,
        device: currentDevice,
        indexedAccount: standardIndexedAccount,
        isOverrideWallet: false,
      });
      mockCreateHWHiddenWalletService.mockResolvedValue({
        wallet: hiddenWallet,
        indexedAccount: hiddenIndexedAccount,
        isOverrideWallet: false,
        isAttachPinMode: false,
      });
      mockAddDefaultNetworkAccountsService.mockResolvedValue({
        addedAccounts: [],
        failedAccounts: [],
      });
      mockGetWalletDevice.mockResolvedValue(currentDevice);
    });

    it('selects the new hidden wallet before committing reset isolation', async () => {
      mockGetAllHwQrWalletWithDevice.mockResolvedValue({
        oldHidden: {
          wallet: {
            id: 'hw-old-hidden',
            deprecated: false,
          },
          device: {
            connectId: currentDevice.connectId,
            deviceId: 'device-id-before-reset',
          },
        },
        currentStandard: {
          wallet: standardWallet,
          device: currentDevice,
        },
        currentHidden: {
          wallet: hiddenWallet,
          device: currentDevice,
        },
      });

      const { store, Wrapper } = createWrapper();
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.createHWWalletWithHidden(createParams);
      });

      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: hiddenWallet.id,
        focusedWallet: hiddenWallet.id,
        indexedAccountId: hiddenIndexedAccount.id,
      });
      expect(mockAddDefaultNetworkAccountsService).toHaveBeenCalledWith(
        expect.objectContaining({ walletId: hiddenWallet.id }),
      );
      expect(mockUpdateWalletsDeprecatedState).toHaveBeenCalledWith({
        willUpdateDeprecateMap: {
          'hw-old-hidden': true,
        },
      });
    });

    it('preserves the global passphrase guide for an explicitly selected hidden wallet', async () => {
      const passphraseError = new DeviceNotOpenedPassphrase();
      mockCreateHWHiddenWalletService.mockRejectedValueOnce(passphraseError);
      const hiddenParams = {
        ...createParams,
        deviceState: {
          status: {
            passphraseProtection: false,
          },
        },
      } as unknown as IDBCreateHwWalletParamsBase;

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await expect(
          result.current.createHWWalletWithHidden(hiddenParams),
        ).rejects.toBe(passphraseError);
      });

      expect(mockCreateHWWalletService).toHaveBeenCalledWith(
        expect.objectContaining({ isMockedStandardHwWallet: true }),
      );
      expect(mockCreateHWHiddenWalletService).toHaveBeenCalledTimes(1);
      expect(
        mockShowQrHiddenCreateGuideDialogIfErrorMatched,
      ).toHaveBeenCalledWith(passphraseError);
    });

    it('creates the hidden wallet for Attach PIN mode without a passphrase flag', async () => {
      const attachPinParams = {
        ...createParams,
        features: {},
        deviceState: {
          status: {
            passphraseProtection: null,
            unlockedAttachPin: true,
          },
        },
        isAttachPinMode: true,
      } as unknown as IDBCreateHwWalletParamsBase;

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.createHWWalletWithHidden(attachPinParams);
      });

      expect(mockCreateHWWalletService).toHaveBeenCalledWith(
        expect.objectContaining({ isMockedStandardHwWallet: true }),
      );
      expect(mockCreateHWHiddenWalletService).toHaveBeenCalledTimes(1);
    });

    it('marks the stale wallet deprecated after standard wallet creation', async () => {
      const resetCurrentDevice = {
        id: 'db-device-after-reset',
        connectId: 'runtime-connect-id',
        usbConnectId: 'PRO2-USB',
        deviceId: 'device-id-after-reset',
      };
      const newStandardWallet = {
        ...standardWallet,
        id: 'hw-after-reset',
        associatedDevice: resetCurrentDevice.id,
        isMocked: false,
      } as IWallet;
      mockCreateHWWalletService.mockResolvedValueOnce({
        wallet: newStandardWallet,
        device: resetCurrentDevice,
        indexedAccount: {
          ...standardIndexedAccount,
          id: 'hw-after-reset--0',
          walletId: newStandardWallet.id,
        },
        isOverrideWallet: false,
      });
      mockGetAllHwQrWalletWithDevice.mockResolvedValue({
        oldStandard: {
          wallet: {
            id: 'hw-before-reset',
            deprecated: false,
          },
          device: {
            connectId: 'legacy-primary-id',
            usbConnectId: 'pro2-usb',
            deviceId: 'device-id-before-reset',
          },
        },
        currentStandard: {
          wallet: newStandardWallet,
          device: resetCurrentDevice,
        },
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.createHWWalletWithoutHidden(createParams);
      });

      expect(mockUpdateWalletsDeprecatedState).toHaveBeenCalledWith({
        willUpdateDeprecateMap: {
          'hw-before-reset': true,
        },
      });
    });

    it('does not broadcast a redundant wallet state update', async () => {
      mockGetAllHwQrWalletWithDevice.mockResolvedValue({
        oldHidden: {
          wallet: {
            id: 'hw-old-hidden',
            deprecated: true,
          },
          device: {
            connectId: currentDevice.connectId,
            deviceId: 'device-id-before-reset',
          },
        },
        currentHidden: {
          wallet: hiddenWallet,
          device: currentDevice,
        },
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.updateHwWalletsDeprecatedStatus({
          connectId: currentDevice.connectId,
          deviceId: currentDevice.deviceId,
        });
      });

      expect(mockUpdateWalletsDeprecatedState).not.toHaveBeenCalled();
    });

    it.each([
      ['standard', 'old-seed'],
      ['hidden', 'old-seed'],
      ['standard', ''],
      ['hidden', ''],
    ])(
      'reconciles reset wallets by serial after %s creation with old deviceId %s',
      async (mode, oldDeviceId) => {
        const resetDevice = {
          ...currentDevice,
          connectId: 'new-android-ble',
          bleConnectId: 'new-android-ble',
          uuid: 'SERIAL',
        };
        mockCreateHWWalletService.mockResolvedValue({
          wallet: standardWallet,
          device: resetDevice,
          indexedAccount: standardIndexedAccount,
          isOverrideWallet: false,
        });
        const oldDevice = {
          connectId: '',
          deviceId: oldDeviceId,
          uuid: 'SERIAL',
        };
        mockGetAllHwQrWalletWithDevice.mockResolvedValue({
          old: { wallet: { id: 'hw-old' }, device: oldDevice },
          oldHidden: {
            wallet: { id: 'hw-old-hidden', passphraseState: 'hidden' },
            device: oldDevice,
          },
          current: {
            wallet: { ...standardWallet, deprecated: true },
            device: resetDevice,
          },
          other: {
            wallet: { id: 'hw-other' },
            device: {
              ...resetDevice,
              id: 'db-other',
              uuid: 'OTHER',
              deviceId: 'other-seed',
            },
          },
        });
        const { Wrapper } = createWrapper();
        const { result } = renderHook(
          () => useAccountSelectorActions().current,
          {
            wrapper: Wrapper,
          },
        );
        await act(async () => {
          if (mode === 'standard') {
            await result.current.createHWWalletWithoutHidden(createParams);
          } else {
            await result.current.createHWWalletWithHidden(createParams);
          }
        });
        expect(mockUpdateWalletsDeprecatedState).toHaveBeenCalledWith({
          willUpdateDeprecateMap: {
            'hw-old': true,
            'hw-old-hidden': true,
            [standardWallet.id]: false,
          },
        });
      },
    );
  });

  describe('confirmAccountSelect All Networks fallback', () => {
    const qrIndexedAccount = {
      id: 'qr-1--0',
      walletId: 'qr-1',
    } as IIndexedAccount;

    function seedSelection(
      store: ReturnType<typeof createWrapper>['store'],
      networkId: string,
    ) {
      store.set(selectedAccountsAtom(), {
        0: {
          ...defaultSelectedAccount(),
          walletId: 'hd-1',
          indexedAccountId: 'hd-1--0',
          focusedWallet: 'hd-1',
          networkId,
          deriveType: 'default',
        },
      });
    }

    it('falls back to the first compatible chain when All Networks is a dead end for the target wallet', async () => {
      mockGetAllNetworksFallbackNetworkId.mockResolvedValue('btc--0');

      const { store, Wrapper } = createWrapper();
      seedSelection(store, getNetworkIdsMap().onekeyall);
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.confirmAccountSelect({
          indexedAccount: qrIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
      });

      expect(mockGetAllNetworksFallbackNetworkId).toHaveBeenCalledWith({
        walletId: 'qr-1',
      });
      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        indexedAccountId: 'qr-1--0',
        networkId: 'btc--0',
      });
    });

    it('keeps All Networks when the target wallet has compatible enabled networks', async () => {
      mockGetAllNetworksFallbackNetworkId.mockResolvedValue(undefined);

      const { store, Wrapper } = createWrapper();
      seedSelection(store, getNetworkIdsMap().onekeyall);
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.confirmAccountSelect({
          indexedAccount: qrIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
      });

      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        indexedAccountId: 'qr-1--0',
        networkId: getNetworkIdsMap().onekeyall,
      });
    });

    it('keeps All Networks when the fallback check fails', async () => {
      mockGetAllNetworksFallbackNetworkId.mockRejectedValue(
        new Error('bg call failed'),
      );

      const { store, Wrapper } = createWrapper();
      seedSelection(store, getNetworkIdsMap().onekeyall);
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.confirmAccountSelect({
          indexedAccount: qrIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
      });

      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        indexedAccountId: 'qr-1--0',
        networkId: getNetworkIdsMap().onekeyall,
      });
    });

    it('does not run the fallback check for single-chain selections', async () => {
      const { store, Wrapper } = createWrapper();
      seedSelection(store, 'tron--0x2b6653dc');
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.confirmAccountSelect({
          indexedAccount: qrIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
      });

      expect(mockGetAllNetworksFallbackNetworkId).not.toHaveBeenCalled();
      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        indexedAccountId: 'qr-1--0',
        networkId: 'tron--0x2b6653dc',
      });
    });

    it('drops a stale fallback result when a newer selection completes first', async () => {
      const resolvers = new Map<string, (value: string | undefined) => void>();
      mockGetAllNetworksFallbackNetworkId.mockImplementation(
        ({ walletId }) =>
          new Promise<string | undefined>((resolve) => {
            resolvers.set(walletId, resolve);
          }),
      );

      const { store, Wrapper } = createWrapper();
      seedSelection(store, getNetworkIdsMap().onekeyall);
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        const staleSelect = result.current.confirmAccountSelect({
          indexedAccount: {
            id: 'hd-2--0',
            walletId: 'hd-2',
          } as IIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
        const latestSelect = result.current.confirmAccountSelect({
          indexedAccount: qrIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
        await Promise.resolve();
        // The later selection resolves first...
        resolvers.get('qr-1')?.('btc--0');
        await latestSelect;
        // ...then the earlier one resolves last and must be dropped.
        resolvers.get('hd-2')?.('evm--1');
        await staleSelect;
      });

      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        indexedAccountId: 'qr-1--0',
        networkId: 'btc--0',
      });
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

  it('preserves a deprecated wallet during init and auto-select', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const deprecatedWallet = { id: 'hd-1', deprecated: true } as IWallet;
    const indexedAccount = {
      id: 'hd-1--0',
      walletId: 'hd-1',
    } as IIndexedAccount;
    mockGetSelectedAccountsMap.mockResolvedValue({ 0: selectedAccount });
    mockGetWalletSafe.mockResolvedValue(deprecatedWallet);

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
      });
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: deprecatedWallet,
        indexedAccount,
        network: { id: selectedAccount.networkId } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['network']
        >,
      },
    });
    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.swap,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject(selectedAccount);
    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockGetAllHdHwQrWallets).not.toHaveBeenCalled();
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

  it('fills a missing Swap recipient account when restoring a partial recent-selection cache', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--1');
    mockGetSelectedAccountsMap.mockResolvedValue({
      0: selectedAccount,
    });
    mockMergeHomeDataToSwapMap.mockResolvedValue({
      0: selectedAccount,
      1: selectedAccount,
    });

    await getAccountSelectorActions().setRecentAccountSelectorSelectionCache({
      sceneName: EAccountSelectorSceneName.swap,
      selectedAccountsMap: {
        0: selectedAccount,
      },
      updateMeta: {
        0: {
          eventEmitDisabled: false,
          updatedAt: Date.now(),
        },
      },
    });

    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.swap,
      });
    });

    expect(store.get(selectedAccountsAtom())).toMatchObject({
      0: {
        indexedAccountId: selectedAccount.indexedAccountId,
      },
      1: {
        indexedAccountId: selectedAccount.indexedAccountId,
      },
    });
  });

  it('ignores an affected-version Swap recent cache with the wrong recipient account', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--1');
    const wrongRecipientAccount = createHdSelectedAccount('hd-1--0');
    mockGetSelectedAccountsMap.mockResolvedValue({
      0: selectedAccount,
      1: selectedAccount,
    });
    mockMergeHomeDataToSwapMap.mockResolvedValue({
      0: selectedAccount,
      1: selectedAccount,
    });
    mockColdStartCacheStorageData.set(
      EAppSyncStorageKeys.onekey_account_selector_recent_selection,
      {
        [EAccountSelectorSceneName.swap]: {
          version: 1,
          updatedAt: Date.now(),
          selectedAccountsMap: {
            0: selectedAccount,
            1: wrongRecipientAccount,
          },
          updateMeta: {
            0: {
              eventEmitDisabled: false,
              updatedAt: Date.now(),
            },
            1: {
              eventEmitDisabled: true,
              updatedAt: Date.now(),
            },
          },
        },
      },
    );

    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.swap,
      });
    });

    expect(store.get(selectedAccountsAtom())).toMatchObject({
      0: {
        indexedAccountId: selectedAccount.indexedAccountId,
      },
      1: {
        indexedAccountId: selectedAccount.indexedAccountId,
      },
    });
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

  it('selects another wallet when removal arrives before the active account refreshes', async () => {
    const removedWallet = {
      id: 'hd-keyless-1',
      name: 'Removed Keyless wallet',
    } as IWallet;
    const nextWallet = {
      id: 'hd-2',
      name: 'Next wallet',
    } as IWallet;
    const nextIndexedAccount = {
      id: 'hd-2--0',
      walletId: nextWallet.id,
    } as IIndexedAccount;

    mockGetAllHdHwQrWallets.mockResolvedValue({ wallets: [nextWallet] });
    mockIsWalletHasIndexedAccounts.mockImplementation(
      async ({ walletId }) => walletId === nextWallet.id,
    );
    mockGetIndexedAccountsOfWallet.mockImplementation(async ({ walletId }) => ({
      accounts: walletId === nextWallet.id ? [nextIndexedAccount] : [],
    }));
    mockGetWalletSafe.mockImplementation(async ({ walletId }) =>
      walletId === nextWallet.id ? nextWallet : undefined,
    );

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: removedWallet.id,
        indexedAccountId: 'hd-keyless-1--0',
        networkId: 'evm--1',
        deriveType: 'default',
        focusedWallet: removedWallet.id,
      },
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: removedWallet,
        indexedAccount: {
          id: 'hd-keyless-1--0',
          walletId: removedWallet.id,
        } as IIndexedAccount,
        account: {
          id: 'hd-keyless-1--evm-account',
          indexedAccountId: 'hd-keyless-1--0',
        } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['account']
        >,
        network: { id: 'evm--1' } as NonNullable<
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
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
        removedWalletId: removedWallet.id,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: nextWallet.id,
      indexedAccountId: nextIndexedAccount.id,
      focusedWallet: nextWallet.id,
    });
  });

  it('clears the removed keyless wallet when no fallback wallet exists', async () => {
    const removedWallet = {
      id: 'hd-keyless-1',
      name: 'Removed Keyless wallet',
      isKeyless: true,
    } as IWallet;

    mockGetAllHdHwQrWallets.mockResolvedValue({ wallets: [] });
    mockGetWalletSafe.mockResolvedValue(undefined);

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: removedWallet.id,
        indexedAccountId: 'hd-keyless-1--0',
        networkId: 'evm--1',
        deriveType: 'default',
        focusedWallet: removedWallet.id,
      },
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: removedWallet,
        indexedAccount: {
          id: 'hd-keyless-1--0',
          walletId: removedWallet.id,
        } as IIndexedAccount,
        account: {
          id: 'hd-keyless-1--evm-account',
          indexedAccountId: 'hd-keyless-1--0',
        } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['account']
        >,
        network: { id: 'evm--1' } as NonNullable<
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
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
        removedWalletId: removedWallet.id,
      });
    });

    const clearedSelectedAccount =
      store.get(selectedAccountsAtom())[0] ?? defaultSelectedAccount();
    await act(async () => {
      await result.current.reloadActiveAccountInfo({
        num: 0,
        selectedAccount: clearedSelectedAccount,
      });
    });

    expect(clearedSelectedAccount).toMatchObject({
      walletId: undefined,
      focusedWallet: undefined,
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
      networkId: 'evm--1',
    });
    expect(mockBuildActiveAccountInfoFromSelectedAccount).toHaveBeenCalled();
    expect(store.get(activeAccountsAtom())[0]).toMatchObject({
      ready: true,
      wallet: undefined,
      indexedAccount: undefined,
      account: undefined,
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
  });

  it('selects another wallet when parent removal cascades to the selected hidden wallet', async () => {
    const removedParentWalletId = 'hw-standard';
    const removedHiddenWallet = {
      id: 'hw-standard--hidden',
      name: 'Removed hidden wallet',
    } as IWallet;
    const nextWallet = {
      id: 'hd-2',
      name: 'Next wallet',
    } as IWallet;
    const nextIndexedAccount = {
      id: 'hd-2--0',
      walletId: nextWallet.id,
    } as IIndexedAccount;

    mockGetAllHdHwQrWallets.mockResolvedValue({ wallets: [nextWallet] });
    mockIsWalletHasIndexedAccounts.mockImplementation(
      async ({ walletId }) => walletId === nextWallet.id,
    );
    mockGetIndexedAccountsOfWallet.mockImplementation(async ({ walletId }) => ({
      accounts: walletId === nextWallet.id ? [nextIndexedAccount] : [],
    }));
    mockGetWalletSafe.mockImplementation(async ({ walletId }) =>
      walletId === nextWallet.id ? nextWallet : undefined,
    );

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: removedHiddenWallet.id,
        indexedAccountId: 'hw-standard--hidden--0',
        networkId: 'evm--1',
        deriveType: 'default',
        focusedWallet: removedHiddenWallet.id,
      },
    });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        wallet: removedHiddenWallet,
        indexedAccount: {
          id: 'hw-standard--hidden--0',
          walletId: removedHiddenWallet.id,
        } as IIndexedAccount,
        account: {
          id: 'hw-standard--hidden--evm-account',
          indexedAccountId: 'hw-standard--hidden--0',
        } as NonNullable<
          ReturnType<typeof defaultActiveAccountInfo>['account']
        >,
        network: { id: 'evm--1' } as NonNullable<
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
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
        removedWalletId: removedParentWalletId,
      });
    });

    expect(mockGetWalletSafe).toHaveBeenCalledWith({
      walletId: removedHiddenWallet.id,
    });
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: nextWallet.id,
      indexedAccountId: nextIndexedAccount.id,
      focusedWallet: nextWallet.id,
    });
  });

  it('repairs focus only when the removed wallet was focused', async () => {
    const currentWallet = { id: 'hd-1' } as IWallet;
    const selectedAccount = {
      ...createHdSelectedAccount('hd-1--0'),
      focusedWallet: 'hd-focused',
    };
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        ready: true,
        // The active account can lag behind a newer selectedAccount update.
        wallet: { id: 'hd-unrelated' } as IWallet,
        indexedAccount: {
          id: 'hd-1--0',
          walletId: currentWallet.id,
        } as IIndexedAccount,
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
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
        removedWalletId: 'hd-unrelated',
      });
    });
    expect(store.get(selectedAccountsAtom())[0]?.focusedWallet).toBe(
      'hd-focused',
    );
    expect(store.get(selectedAccountsAtom())[0]?.walletId).toBe(
      currentWallet.id,
    );

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
        removedWalletId: 'hd-focused',
      });
    });
    expect(store.get(selectedAccountsAtom())[0]?.focusedWallet).toBe(
      currentWallet.id,
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

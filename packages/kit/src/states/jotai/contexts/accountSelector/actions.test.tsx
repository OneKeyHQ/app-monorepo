/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import type {
  IDBAccount,
  IDBCreateQRWalletParams,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  type IAccountSelectorContextData,
  accountSelectorActiveAccountInitDoneAtom,
  accountSelectorContextDataAtom,
  accountSelectorStorageInitDoneAtom,
  accountSelectorStorageReadyAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
  useSelectedAccount,
} from './atoms';
import { isSameSelectedAccount } from './selectedAccountCompare';

import type { EStorageSaveOutcome } from './outcomes';

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
  selectionIntentEpoch?: number;
  selectedAccountUpdatedAt?: number;
};
type ISaveSelectedAccountIfWriteIntentCurrentParams =
  ISaveSelectedAccountParams & {
    expectedWriteIntentEpoch: number;
  };
type IClearUnavailableSelectedAccountParams = {
  expectedSelectedAccount: ISelectedAccount;
  selectedAccount: ISelectedAccount;
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  num: number;
  shouldSyncWithHomeSource: boolean;
  storageInitGeneration?: number;
};
type IClearUnavailableSelectedAccountResult = {
  homeMatched: boolean;
  homeSelectionIntentMatched: boolean;
  primaryMatched: boolean;
  primaryPersisted: boolean;
  storageInitGenerationMatched: boolean;
  syncedHome: boolean;
};
type IRecordSelectedAccountIntentParams = {
  num: number;
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  selectedAccount: ISelectedAccount;
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
  (params?: {
    nonce?: number;
    selectedAccount: ISelectedAccount;
  }) => Promise<IBuildActiveAccountInfoResult>
> = jest.fn();
const mockFixDeriveTypesForInitAccountSelectorMap: jest.MockedFunction<
  (
    params: IFixDeriveTypesForInitAccountSelectorMapParams,
  ) => Promise<ISelectedAccountsMap | undefined>
> = jest.fn();
const mockGetSelectedAccount: jest.MockedFunction<
  (params: IGetSelectedAccountParams) => Promise<ISelectedAccount | undefined>
> = jest.fn();
const mockGetAccountSelectorRawData: jest.MockedFunction<
  () => Promise<
    | {
        globalDeriveTypesMap?: {
          global?: Partial<Record<string, IAccountDeriveTypes>>;
        };
      }
    | undefined
  >
> = jest.fn();
const mockSaveSelectedAccount: jest.MockedFunction<
  (
    params: ISaveSelectedAccountParams,
  ) => Promise<{ persisted: boolean; staleSelectionIntent?: boolean }>
> = jest.fn();
const mockGetSelectedAccountWriteIntentEpoch: jest.MockedFunction<
  (params: IGetSelectedAccountParams) => Promise<number>
> = jest.fn();
const mockSaveSelectedAccountIfWriteIntentCurrent: jest.MockedFunction<
  (
    params: ISaveSelectedAccountIfWriteIntentCurrentParams,
  ) => Promise<{ persisted: boolean }>
> = jest.fn();
const mockClearUnavailableSelectedAccount: jest.MockedFunction<
  (
    params: IClearUnavailableSelectedAccountParams,
  ) => Promise<IClearUnavailableSelectedAccountResult>
> = jest.fn();
const mockBeginAccountSelectorStorageInit: jest.MockedFunction<
  (params: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
  }) => Promise<number>
> = jest.fn();
const mockRecordConnectionSelectionIntent: jest.MockedFunction<
  (params: {
    accountSelectorNum: number;
    origin: string;
    selectedAccount: ISelectedAccount;
  }) => Promise<number>
> = jest.fn();
const mockRecordSelectedAccountIntent: jest.MockedFunction<
  (params: IRecordSelectedAccountIntentParams) => Promise<number>
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
const mockGetIndexedAccountSafe: jest.MockedFunction<
  ({ id }: { id: string }) => Promise<IIndexedAccount | undefined>
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
const mockGetDBAccountSafe: jest.MockedFunction<
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
    isDev: false,
    isExtension: false,
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
      createQrWallet: (...args: Parameters<typeof mockCreateQrWalletService>) =>
        mockCreateQrWalletService(...args),
      clearAccountCache: () => mockClearAccountCache(),
      getAllHdHwQrWallets: () => mockGetAllHdHwQrWallets(),
      getIndexedAccountsOfWallet: ({ walletId }: { walletId: string }) =>
        mockGetIndexedAccountsOfWallet({ walletId }),
      getIndexedAccountSafe: ({ id }: { id: string }) =>
        mockGetIndexedAccountSafe({ id }),
      getSingletonAccountsOfWallet: ({
        walletId,
        activeNetworkId,
      }: {
        walletId: string;
        activeNetworkId?: string;
      }) => mockGetSingletonAccountsOfWallet({ walletId, activeNetworkId }),
      getDBAccount: ({ accountId }: { accountId: string }) =>
        mockGetDBAccount({ accountId }),
      getDBAccountSafe: ({ accountId }: { accountId: string }) =>
        mockGetDBAccountSafe({ accountId }),
      getWalletSafe: ({ walletId }: { walletId: string }) =>
        mockGetWalletSafe({ walletId }),
      isWalletHasIndexedAccounts: ({ walletId }: { walletId: string }) =>
        mockIsWalletHasIndexedAccounts({ walletId }),
      isTempWalletRemoved: ({ wallet }: { wallet: IWallet }) =>
        mockIsTempWalletRemoved({ wallet }),
    },
    serviceAccountSelector: {
      buildActiveAccountInfoFromSelectedAccount: (params: {
        nonce?: number;
        selectedAccount: ISelectedAccount;
      }) => mockBuildActiveAccountInfoFromSelectedAccount(params),
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
    serviceDApp: {
      recordConnectionSelectionIntent: (params: {
        accountSelectorNum: number;
        origin: string;
        selectedAccount: ISelectedAccount;
      }) => mockRecordConnectionSelectionIntent(params),
    },
    serviceNetwork: {
      isDeriveTypeAvailableForNetwork: () =>
        mockIsDeriveTypeAvailableForNetwork(),
    },
    simpleDb: {
      accountSelector: {
        beginAccountSelectorStorageInit: (params: {
          sceneName: EAccountSelectorSceneName;
          sceneUrl?: string;
        }) => mockBeginAccountSelectorStorageInit(params),
        clearUnavailableSelectedAccount: (
          params: IClearUnavailableSelectedAccountParams,
        ) => mockClearUnavailableSelectedAccount(params),
        getRawData: () => mockGetAccountSelectorRawData(),
        getSelectedAccount: (params: IGetSelectedAccountParams) =>
          mockGetSelectedAccount(params),
        getSelectedAccountWriteIntentEpoch: (
          params: IGetSelectedAccountParams,
        ) => mockGetSelectedAccountWriteIntentEpoch(params),
        getSelectedAccountsMap: () => mockGetSelectedAccountsMap(),
        recordSelectedAccountIntent: (
          params: IRecordSelectedAccountIntentParams,
        ) => mockRecordSelectedAccountIntent(params),
        saveSelectedAccount: (params: ISaveSelectedAccountParams) =>
          mockSaveSelectedAccount(params),
        saveSelectedAccountIfWriteIntentCurrent: (
          params: ISaveSelectedAccountIfWriteIntentCurrentParams,
        ) => mockSaveSelectedAccountIfWriteIntentCurrent(params),
      },
      dappConnection: {
        getAccountSelectorMap: () => mockGetDappAccountSelectorMap(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  // Every call stays a noop, but the dotted path of each called method is
  // recorded so tests can assert that a specific log fired. Read it via
  // jest.requireMock('@onekeyhq/shared/src/logger/logger').__loggerCallPaths.
  const loggerCallPaths: string[] = [];
  const buildNode = (path: string): unknown =>
    new Proxy(function noop() {}, {
      apply: () => {
        loggerCallPaths.push(path);
        return undefined;
      },
      get: (_target, prop) =>
        buildNode(path ? `${path}.${String(prop)}` : String(prop)),
    });

  return {
    __loggerCallPaths: loggerCallPaths,
    defaultLogger: buildNode(''),
  };
});

const { __loggerCallPaths: loggerCallPaths } = jest.requireMock(
  '@onekeyhq/shared/src/logger/logger',
) as { __loggerCallPaths: string[] };

function createWrapper(
  config?: EAccountSelectorSceneName | IAccountSelectorContextData,
) {
  const store = createStore();
  store.set(accountSelectorStorageReadyAtom(), true);
  store.set(accountSelectorStorageInitDoneAtom(), true);
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

// Extension keeps UI and background in separate JS runtimes and moves payloads
// between them as JSON, which silently drops every key whose value is undefined.
function bridgeThroughBackground<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('useAccountSelectorActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loggerCallPaths.length = 0;
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
    mockGetAccountSelectorRawData.mockResolvedValue(undefined);
    mockGetSelectedAccount.mockResolvedValue(undefined);
    mockGetSelectedAccountWriteIntentEpoch.mockResolvedValue(0);
    mockSaveSelectedAccount.mockResolvedValue({ persisted: true });
    mockSaveSelectedAccountIfWriteIntentCurrent.mockResolvedValue({
      persisted: true,
    });
    mockClearUnavailableSelectedAccount.mockResolvedValue({
      homeMatched: false,
      homeSelectionIntentMatched: true,
      primaryMatched: true,
      primaryPersisted: true,
      storageInitGenerationMatched: true,
      syncedHome: false,
    });
    mockBeginAccountSelectorStorageInit.mockResolvedValue(1);
    mockRecordConnectionSelectionIntent.mockResolvedValue(1);
    mockRecordSelectedAccountIntent.mockResolvedValue(1);
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
    mockGetDBAccountSafe.mockResolvedValue(undefined);
    mockGetIndexedAccountsOfWallet.mockResolvedValue({
      accounts: [
        { id: 'hd-1--0', walletId: 'hd-1' } as IIndexedAccount,
        { id: 'hd-1--1', walletId: 'hd-1' } as IIndexedAccount,
      ],
    });
    mockGetIndexedAccountSafe.mockImplementation(
      async ({ id }) =>
        ({
          id,
          walletId: 'hd-1',
        }) as IIndexedAccount,
    );
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

  it('keeps refresh as an intentional reference update', () => {
    const { store, Wrapper } = createWrapper();
    const previous = store.get(selectedAccountsAtom())[0];
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.refresh({ num: 0 });
    });

    const current = store.get(selectedAccountsAtom())[0];
    expect(current).toEqual(previous);
    expect(current).not.toBe(previous);
  });

  it('costs each refresh exactly one re-render for the refreshed num only', () => {
    // Render-side contract of the atom-side test above: refresh({num}) is a
    // reference-bump broadcast, so a subscriber of that num pays exactly one
    // re-render per call and receives an equal-but-not-identical selection,
    // while subscribers of other nums are not re-rendered at all.
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: defaultSelectedAccount(),
      1: defaultSelectedAccount(),
    });

    let num0RenderCount = 0;
    let num1RenderCount = 0;
    const num0Selections: ISelectedAccount[] = [];
    let actionsFacade:
      | ReturnType<typeof useAccountSelectorActions>['current']
      | undefined;

    function ActionsProbe() {
      actionsFacade = useAccountSelectorActions().current;
      return null;
    }
    function Num0Consumer() {
      num0RenderCount += 1;
      num0Selections.push(useSelectedAccount({ num: 0 }).selectedAccount);
      return null;
    }
    function Num1Consumer() {
      num1RenderCount += 1;
      useSelectedAccount({ num: 1 });
      return null;
    }

    render(
      <Wrapper>
        <ActionsProbe />
        <Num0Consumer />
        <Num1Consumer />
      </Wrapper>,
    );

    if (!actionsFacade) {
      throw new OneKeyLocalError('actions facade not captured');
    }
    const actions = actionsFacade;
    const initialNum0RenderCount = num0RenderCount;
    const initialNum1RenderCount = num1RenderCount;
    expect(initialNum0RenderCount).toBeGreaterThan(0);
    const selectionBeforeRefresh = num0Selections[num0Selections.length - 1];

    act(() => {
      actions.refresh({ num: 0 });
    });

    expect(num0RenderCount).toBe(initialNum0RenderCount + 1);
    const selectionAfterRefresh = num0Selections[num0Selections.length - 1];
    expect(selectionAfterRefresh).toEqual(selectionBeforeRefresh);
    expect(selectionAfterRefresh).not.toBe(selectionBeforeRefresh);
    expect(num1RenderCount).toBe(initialNum1RenderCount);

    act(() => {
      actions.refresh({ num: 0 });
    });

    expect(num0RenderCount).toBe(initialNum0RenderCount + 2);
    expect(num1RenderCount).toBe(initialNum1RenderCount);
  });

  it('drops a selection update when its final commit guard is stale', async () => {
    const { store, Wrapper } = createWrapper();
    const previous = store.get(selectedAccountsAtom())[0];
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let selectionOutcome: string | undefined;
    await act(async () => {
      selectionOutcome = (
        await result.current.updateSelectedAccount({
          num: 0,
          reason: 'stale-commit-guard-test',
          shouldCommit: () => false,
          builder: (current) => ({
            ...current,
            networkId: 'evm--1',
          }),
        })
      ).outcome;
    });

    expect(selectionOutcome).toBe('stale');
    expect(store.get(selectedAccountsAtom())[0]).toBe(previous);
  });

  it('records a discover selection intent before committing locally', async () => {
    const sceneUrl = 'https://selection-intent.test';
    const { store, Wrapper } = createWrapper({
      sceneName: EAccountSelectorSceneName.discover,
      sceneUrl,
    });
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.discover,
      sceneUrl,
    });
    const previous = store.get(selectedAccountsAtom())[0];
    let selectionObservedByIntent: ISelectedAccount | undefined;
    mockRecordConnectionSelectionIntent.mockImplementation(async () => {
      selectionObservedByIntent = store.get(selectedAccountsAtom())[0];
      return 1;
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const next = createHdSelectedAccount('hd-1--1');

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          num: 0,
          reason: 'discover-selection-intent-test',
          builder: () => next,
        })
      ).outcome;
    });

    expect(outcome).toBe('commit');
    expect(mockRecordConnectionSelectionIntent).toHaveBeenCalledWith({
      accountSelectorNum: 0,
      origin: sceneUrl,
      selectedAccount: next,
    });
    expect(selectionObservedByIntent).toBe(previous);
    expect(store.get(selectedAccountsAtom())[0]).toEqual(next);
  });

  it('does not record a dapp selection intent outside discover', async () => {
    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.home);
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const next = createHdSelectedAccount('hd-1--1');

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          num: 0,
          reason: 'home-selection-intent-test',
          builder: () => next,
        })
      ).outcome;
    });

    expect(outcome).toBe('commit');
    expect(mockRecordConnectionSelectionIntent).not.toHaveBeenCalled();
    expect(store.get(selectedAccountsAtom())[0]).toEqual(next);
  });

  it('does not commit a discover selection when recording intent fails', async () => {
    const sceneUrl = 'https://selection-intent-failure.test';
    const { store, Wrapper } = createWrapper({
      sceneName: EAccountSelectorSceneName.discover,
      sceneUrl,
    });
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.discover,
      sceneUrl,
    });
    const previous = store.get(selectedAccountsAtom())[0];
    mockRecordConnectionSelectionIntent.mockRejectedValue(
      new OneKeyLocalError('selection intent failed'),
    );
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.updateSelectedAccount({
          num: 0,
          reason: 'discover-selection-intent-failure-test',
          builder: () => createHdSelectedAccount('hd-1--1'),
        }),
      ).rejects.toThrow('selection intent failed');
    });

    expect(store.get(selectedAccountsAtom())[0]).toBe(previous);
  });

  it('only alerts on stale drops that are truly consecutive', async () => {
    // Counting drops that are merely frequent rather than consecutive would
    // report callers that each lost one race for their own valid reason.
    jest.replaceProperty(platformEnv, 'isDev', true);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: 'https://consecutive-stale-drop.test',
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const dropUpdate = () =>
      result.current.updateSelectedAccount({
        num: 0,
        reason: 'consecutive-stale-drop-test',
        shouldCommit: () => false,
        builder: (current) => ({ ...current, networkId: 'evm--1' }),
      });
    const noopUpdate = () =>
      result.current.updateSelectedAccount({
        num: 0,
        reason: 'consecutive-stale-drop-test',
        builder: (current) => ({ ...current }),
      });

    // A noop interrupts the run, so the two drops after it are only a run of 2.
    await act(async () => {
      expect((await dropUpdate()).outcome).toBe('stale');
      expect((await noopUpdate()).outcome).toBe('noop');
      expect((await dropUpdate()).outcome).toBe('stale');
      expect((await dropUpdate()).outcome).toBe('stale');
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // The alert is still armed: one more drop closes an unbroken run of 3.
    await act(async () => {
      expect((await dropUpdate()).outcome).toBe('stale');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/3 consecutive stale selection drops/),
    );
  });

  it('reports the alert without throwing into callers that cannot catch', async () => {
    // The alert runs inside the update mutex and most callers on the path have
    // no catch (useAutoSelectAccount, the event bus handlers), so a throw became
    // an unhandled rejection; confirmAccountSelect, the one caller that does
    // catch, turned it into a "save failed" toast naming a symptom. It reports.
    jest.replaceProperty(platformEnv, 'isDev', true);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: 'https://never-throws-stale-drop.test',
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const dropUpdate = () =>
      result.current.updateSelectedAccount({
        num: 0,
        reason: 'never-throw-stale-drop-test',
        shouldCommit: () => false,
        builder: (current) => ({ ...current, networkId: 'evm--1' }),
      });

    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        // Resolves every time - the run is well past the alert threshold.
        expect((await dropUpdate()).outcome).toBe('stale');
      }
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('counts stale drops per caller so unrelated callers cannot add up', async () => {
    // A slow cold start has several callers racing on the same scene and num.
    // Each may legitimately lose once; only a caller that keeps losing its own
    // update is worth an alert.
    jest.replaceProperty(platformEnv, 'isDev', true);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: 'https://per-caller-stale-drop.test',
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const dropUpdateFrom = (reason: string) =>
      result.current.updateSelectedAccount({
        num: 0,
        reason,
        shouldCommit: () => false,
        builder: (current) => ({ ...current, networkId: 'evm--1' }),
      });

    await act(async () => {
      expect((await dropUpdateFrom('autoSelectNextAccount')).outcome).toBe(
        'stale',
      );
      expect(
        (await dropUpdateFrom('syncHomeAndSwapSelectedAccount')).outcome,
      ).toBe('stale');
      expect((await dropUpdateFrom('autoDeriveGlobalSync')).outcome).toBe(
        'stale',
      );
      expect((await dropUpdateFrom('confirmAccountSelect')).outcome).toBe(
        'stale',
      );
    });

    // Four drops on one scene/num, but no caller lost more than once.
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('bounds the stale drop counter map rather than growing it per scene url', async () => {
    // The discover scene keys on the dapp origin and an entry whose run never
    // ends is never removed, so the map is capped instead of left unbounded.
    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.discover,
      sceneUrl: 'https://bounded-stale-drop.test',
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    // The map lives on the actions singleton, not on the hook's method facade.
    const counts = getAccountSelectorActions().consecutiveStaleDropCountMap;
    counts.clear();
    try {
      for (let i = 0; i < 1000; i += 1) {
        counts.set(`discover__https://dapp-${i}.test__0__some-caller`, 1);
      }
      expect(counts.size).toBe(1000);

      await act(async () => {
        const dropped = await result.current.updateSelectedAccount({
          num: 0,
          reason: 'bounded-stale-drop-test',
          shouldCommit: () => false,
          builder: (current) => ({ ...current, networkId: 'evm--1' }),
        });
        expect(dropped.outcome).toBe('stale');
      });

      // Cleared wholesale, then the run counted by this very drop is written
      // back - reaching the cap must not lose the run currently being tracked.
      expect(counts.size).toBe(1);
      expect([...counts.values()]).toEqual([1]);
    } finally {
      // The actions instance is a module-level singleton shared across tests.
      counts.clear();
    }
  });

  it('drops an event older than the committed revision without arming the stale alert', async () => {
    // A late cross-runtime event losing against an already-committed newer
    // selection is the sync protocol converging, not a caller losing a race,
    // so the drop must never feed the repeated-stale-drop alert.
    jest.replaceProperty(platformEnv, 'isDev', true);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--1'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        sourceRuntimeId: 'runtime-z',
        updatedAt: 2000,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const staleCounts =
      getAccountSelectorActions().consecutiveStaleDropCountMap;
    staleCounts.clear();

    await act(async () => {
      // Well past the alert threshold on purpose: repeated correct drops from
      // the same caller must stay silent.
      for (let i = 0; i < 4; i += 1) {
        const dropped = await result.current.updateSelectedAccount({
          eventUpdatedAt: 1000,
          num: 0,
          reason: 'older-event-drop-test',
          builder: () => createHdSelectedAccount('hd-1--0'),
          updateMeta: { eventEmitDisabled: true, updatedAt: 1000 },
        });
        expect(dropped.outcome).toBe('skip-older-event');
      }
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
    expect(staleCounts.size).toBe(0);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('applies an event newer than the committed revision and lands its revision', async () => {
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--0'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 1000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          eventUpdatedAt: 2000,
          num: 0,
          reason: 'newer-event-apply-test',
          builder: () => createHdSelectedAccount('hd-1--1'),
          updateMeta: {
            eventEmitDisabled: true,
            sourceRuntimeId: 'runtime-a',
            updatedAt: 2000,
          },
        })
      ).outcome;
    });

    expect(outcome).toBe('commit');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    // The event's source revision is committed verbatim - later events from
    // the peer runtime are only comparable against it, not our receive time.
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });

  it('converges an out-of-order event burst on the newest revision', async () => {
    // Two rapid switches on the peer runtime arrive out of order: B (newer)
    // lands first, A (older) trails. Unconditional apply would let A win with
    // a monotonic-floor-bumped revision; the exact-match CAS dropped whichever
    // event entered the mutex second regardless of age. Compare-if-newer must
    // keep B deterministically.
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--2'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 500 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const applyEvent = (indexedAccountId: string, eventUpdatedAt: number) =>
      result.current.updateSelectedAccount({
        eventUpdatedAt,
        num: 0,
        reason: 'out-of-order-burst-test',
        builder: () => createHdSelectedAccount(indexedAccountId),
        updateMeta: { eventEmitDisabled: true, updatedAt: eventUpdatedAt },
      });

    await act(async () => {
      expect((await applyEvent('hd-1--1', 2000)).outcome).toBe('commit');
      expect((await applyEvent('hd-1--0', 1000)).outcome).toBe(
        'skip-older-event',
      );
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });

  it('collapses an equal-revision event with the same value into a noop', async () => {
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--1'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 2000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          eventUpdatedAt: 2000,
          num: 0,
          reason: 'equal-revision-noop-test',
          builder: () => createHdSelectedAccount('hd-1--1'),
          updateMeta: { eventEmitDisabled: true, updatedAt: 2000 },
        })
      ).outcome;
    });

    expect(outcome).toBe('noop');
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });

  it('keeps the deterministic runtime-id winner on an equal-revision conflict', async () => {
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--1'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        sourceRuntimeId: 'runtime-z',
        updatedAt: 2000,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const staleCounts =
      getAccountSelectorActions().consecutiveStaleDropCountMap;
    staleCounts.clear();

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          eventUpdatedAt: 2000,
          num: 0,
          reason: 'equal-revision-conflict-test',
          builder: () => createHdSelectedAccount('hd-1--0'),
          updateMeta: {
            eventEmitDisabled: true,
            sourceRuntimeId: 'runtime-a',
            updatedAt: 2000,
          },
        })
      ).outcome;
    });

    expect(outcome).toBe('skip-equal-event-conflict');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
    expect(loggerCallPaths).toContain(
      'accountSelector.staleDrop.equalRevisionConflictKeptLocal',
    );
    expect(staleCounts.size).toBe(0);
  });

  it('converges two runtimes that committed different values at the same revision', async () => {
    const runtimeASelection = createHdSelectedAccount('hd-1--0');
    const runtimeBSelection = createHdSelectedAccount('hd-1--1');
    const runtimeA = createWrapper();
    const runtimeB = createWrapper();
    runtimeA.store.set(selectedAccountsAtom(), { 0: runtimeASelection });
    runtimeB.store.set(selectedAccountsAtom(), { 0: runtimeBSelection });
    runtimeA.store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        sourceRuntimeId: 'runtime-a',
        updatedAt: 2000,
      },
    });
    runtimeB.store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        sourceRuntimeId: 'runtime-b',
        updatedAt: 2000,
      },
    });
    const actionsA = renderHook(() => useAccountSelectorActions().current, {
      wrapper: runtimeA.Wrapper,
    });
    const actionsB = renderHook(() => useAccountSelectorActions().current, {
      wrapper: runtimeB.Wrapper,
    });

    await act(async () => {
      expect(
        (
          await actionsA.result.current.updateSelectedAccount({
            eventUpdatedAt: 2000,
            num: 0,
            reason: 'equal-revision-runtime-b-event',
            builder: () => runtimeBSelection,
            updateMeta: {
              eventEmitDisabled: true,
              sourceRuntimeId: 'runtime-b',
              updatedAt: 2000,
            },
          })
        ).outcome,
      ).toBe('commit');
      expect(
        (
          await actionsB.result.current.updateSelectedAccount({
            eventUpdatedAt: 2000,
            num: 0,
            reason: 'equal-revision-runtime-a-event',
            builder: () => runtimeASelection,
            updateMeta: {
              eventEmitDisabled: true,
              sourceRuntimeId: 'runtime-a',
              updatedAt: 2000,
            },
          })
        ).outcome,
      ).toBe('skip-equal-event-conflict');
    });

    expect(runtimeA.store.get(selectedAccountsAtom())[0]).toEqual(
      runtimeBSelection,
    );
    expect(runtimeB.store.get(selectedAccountsAtom())[0]).toEqual(
      runtimeBSelection,
    );
    expect(
      runtimeA.store.get(accountSelectorUpdateMetaAtom())[0],
    ).toMatchObject({
      sourceRuntimeId: 'runtime-b',
      updatedAt: 2000,
    });
  });

  it('drops an unversioned event against a committed revision without arming the stale alert', async () => {
    // eventUpdatedAt: null marks an event that carried no source revision (a
    // cold-start replay). It may never overwrite a slot that holds a real
    // committed revision, and like the other compare-if-newer skips it is the
    // protocol converging, so it must not feed the repeated-stale-drop alert
    // or the conflict log.
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--1'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 2000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const staleCounts =
      getAccountSelectorActions().consecutiveStaleDropCountMap;
    staleCounts.clear();

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          eventUpdatedAt: null,
          num: 0,
          reason: 'unversioned-event-drop-test',
          builder: () => createHdSelectedAccount('hd-1--0'),
          updateMeta: { eventEmitDisabled: true, updatedAt: undefined },
        })
      ).outcome;
    });

    expect(outcome).toBe('skip-unversioned-event');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
    expect(staleCounts.size).toBe(0);
    expect(loggerCallPaths).not.toContain(
      'accountSelector.staleDrop.equalRevisionConflictKeptLocal',
    );
  });

  it('collapses a duplicate delivery healed by the global derive correction into a noop', async () => {
    // The first delivery of this event changed networks, so its commit
    // corrected the deriveType from global storage; a sibling instance
    // re-delivers the SAME event still carrying the emitter's original
    // deriveType. Equal revision, different value - but semantically the same
    // selection once the correction is applied, so it must land on noop
    // instead of being misreported as a cross-runtime conflict.
    const committed = createHdSelectedAccount('hd-1--1'); // deriveType 'default'
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: committed });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: true,
        sourceRuntimeId: 'runtime-z',
        updatedAt: 2000,
      },
    });
    // The global derive type the first delivery committed.
    mockGetGlobalDeriveType.mockResolvedValue('default');
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          eventUpdatedAt: 2000,
          num: 0,
          reason: 'duplicate-delivery-derive-heal-test',
          builder: () => ({
            ...createHdSelectedAccount('hd-1--1'),
            deriveType: 'ledgerLive',
          }),
          updateMeta: {
            eventEmitDisabled: true,
            sourceRuntimeId: 'runtime-a',
            updatedAt: 2000,
          },
        })
      ).outcome;
    });

    expect(outcome).toBe('noop');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      deriveType: 'default',
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
    expect(loggerCallPaths).not.toContain(
      'accountSelector.staleDrop.equalRevisionConflictKeptLocal',
    );
  });

  it('still reports a conflict when the derive correction does not explain the difference', async () => {
    // Same shape as the healed-duplicate case above, but the global derive
    // type disagrees with the committed value: the difference is a genuine
    // same-millisecond divergence and must keep the conflict verdict.
    const committed = createHdSelectedAccount('hd-1--1'); // deriveType 'default'
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: committed });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: true,
        sourceRuntimeId: 'runtime-z',
        updatedAt: 2000,
      },
    });
    mockGetGlobalDeriveType.mockResolvedValue('ledgerLegacy');
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          eventUpdatedAt: 2000,
          num: 0,
          reason: 'duplicate-delivery-derive-conflict-test',
          builder: () => ({
            ...createHdSelectedAccount('hd-1--1'),
            deriveType: 'ledgerLive',
          }),
          updateMeta: {
            eventEmitDisabled: true,
            sourceRuntimeId: 'runtime-a',
            updatedAt: 2000,
          },
        })
      ).outcome;
    });

    expect(outcome).toBe('skip-equal-event-conflict');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      deriveType: 'default',
    });
    expect(loggerCallPaths).toContain(
      'accountSelector.staleDrop.equalRevisionConflictKeptLocal',
    );
  });

  it('syncs account, available network, and derive type in one atom update', async () => {
    const sceneUrl = 'https://example.test';
    const sourceSelectedAccount: ISelectedAccount = {
      ...defaultSelectedAccount(),
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      networkId: getNetworkIdsMap().onekeyall,
      deriveType: 'default',
      focusedWallet: 'hd-1',
    };
    mockGetSelectedAccount.mockResolvedValue(sourceSelectedAccount);
    mockGetAccountSelectorRawData.mockResolvedValue({
      globalDeriveTypesMap: {
        global: {
          evm: 'default',
        },
      },
    });

    const { store, Wrapper } = createWrapper({
      sceneName: EAccountSelectorSceneName.discover,
      sceneUrl,
    });
    const atomUpdates: ISelectedAccountsMap[] = [];
    const unsubscribe = store.sub(selectedAccountsAtom(), () => {
      atomUpdates.push(store.get(selectedAccountsAtom()));
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    try {
      await act(async () => {
        await result.current.syncFromScene({
          from: {
            sceneName: EAccountSelectorSceneName.home,
            sceneNum: 0,
          },
          num: 0,
          targetSceneName: EAccountSelectorSceneName.discover,
          withNetworkSync: true,
          availableNetworks: {
            networkIds: [getNetworkIdsMap().onekeyall, 'evm--1', 'evm--137'],
          },
        });
      });
    } finally {
      unsubscribe();
    }

    expect(store.get(selectedAccountsAtom())[0]).toEqual({
      ...sourceSelectedAccount,
      networkId: 'evm--1',
      deriveType: 'default',
    });
    expect(atomUpdates).toHaveLength(1);
  });

  it('preserves the target network and derive type when network sync is disabled', async () => {
    const sourceSelectedAccount: ISelectedAccount = {
      ...defaultSelectedAccount(),
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      networkId: 'evm--1',
      deriveType: 'default',
      focusedWallet: 'hd-1',
    };
    mockGetSelectedAccount.mockResolvedValue(sourceSelectedAccount);

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        networkId: 'btc--0',
        deriveType: 'BIP86',
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.syncFromScene({
        from: {
          sceneName: EAccountSelectorSceneName.swap,
          sceneNum: 0,
        },
        num: 0,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toEqual({
      ...sourceSelectedAccount,
      networkId: 'btc--0',
      deriveType: 'BIP86',
    });
  });

  it('invokes the selection builder exactly once per update', async () => {
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const builder = jest.fn((current: ISelectedAccount) => ({
      ...current,
      networkId: 'evm--1',
    }));

    await act(async () => {
      await result.current.updateSelectedAccount({
        num: 0,
        reason: 'builder-invocation-count-test',
        builder,
      });
    });

    // syncFromScene resolves the scene sync inside its builder and reports the
    // derive/network resolution through closure variables. A second invocation
    // would overwrite those with a resolution that was never committed, so the
    // single-call contract is load-bearing rather than incidental.
    expect(builder).toHaveBeenCalledTimes(1);
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      networkId: 'evm--1',
    });
  });

  it('applies a scene sync that raced with a concurrent selection commit', async () => {
    const sourceSelectedAccount: ISelectedAccount = {
      ...defaultSelectedAccount(),
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      networkId: 'evm--1',
      deriveType: 'default',
      focusedWallet: 'hd-1',
    };
    const sourceDeferred = createDeferred<ISelectedAccount | undefined>();
    mockGetSelectedAccount.mockReturnValueOnce(sourceDeferred.promise);

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        networkId: 'btc--0',
        deriveType: 'BIP86',
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      const syncPromise = result.current.syncFromScene({
        from: {
          sceneName: EAccountSelectorSceneName.swap,
          sceneNum: 0,
        },
        num: 0,
      });
      await waitFor(() => {
        expect(mockGetSelectedAccount).toHaveBeenCalled();
      });
      // A commit lands while the sync is still waiting on storage reads.
      await result.current.updateSelectedAccount({
        num: 0,
        reason: 'concurrent-commit-test',
        builder: (v) => ({
          ...v,
          networkId: 'evm--137',
          deriveType: 'default',
        }),
      });
      sourceDeferred.resolve(sourceSelectedAccount);
      await syncPromise;
    });

    // The sync must still apply, and must resolve against the committed value:
    // resolving against a snapshot taken before the awaits would have written
    // btc--0 back over the concurrent commit, or dropped the sync entirely.
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      networkId: 'evm--137',
      deriveType: 'default',
    });
  });

  it('applies a derive type resolved for the still-current network after an account switch', async () => {
    const { store, Wrapper } = createWrapper();
    // Resolution starts for this account on btc--0.
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--0',
        networkId: 'btc--0',
      },
    });
    const resolvedForNetworkId = 'btc--0';
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    // The user switches account while the derive type is still being resolved.
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--1',
        networkId: 'btc--0',
      },
    });

    await act(async () => {
      await result.current.updateSelectedAccountDeriveType({
        num: 0,
        deriveType: 'BIP86',
        expectedNetworkId: resolvedForNetworkId,
        reason: 'autoDeriveFallback',
      });
    });

    // The derive type belongs to the network, not the account, so the switch
    // must not discard it — the effect that resolved it does not re-run on an
    // account change, and the account would be left without a derive type.
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
      networkId: 'btc--0',
      deriveType: 'BIP86',
    });
  });

  it('does not apply a derive type resolved for a network the user has left', async () => {
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--0',
        networkId: 'btc--0',
      },
    });
    const resolvedForNetworkId = 'btc--0';
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    // The user leaves the network the derive type was resolved for.
    store.set(selectedAccountsAtom(), {
      0: {
        ...defaultSelectedAccount(),
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--0',
        networkId: 'evm--1',
        deriveType: 'default',
      },
    });

    await act(async () => {
      await result.current.updateSelectedAccountDeriveType({
        num: 0,
        deriveType: 'BIP86',
        expectedNetworkId: resolvedForNetworkId,
        reason: 'autoDeriveFallback',
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      networkId: 'evm--1',
      deriveType: 'default',
    });
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

  it('does not publish an unchanged active account after reload', async () => {
    const activeAccount = {
      ...defaultActiveAccountInfo(),
      ready: true,
    };
    mockBuildActiveAccountInfoFromSelectedAccount.mockResolvedValue({
      activeAccount,
    });

    const { store, Wrapper } = createWrapper();
    store.set(activeAccountsAtom(), { 0: activeAccount });
    store.set(accountSelectorActiveAccountInitDoneAtom(), { 0: true });
    const activeAccountsListener = jest.fn();
    const activeAccountInitDoneListener = jest.fn();
    const unsubscribe = store.sub(activeAccountsAtom(), activeAccountsListener);
    const unsubscribeInitDone = store.sub(
      accountSelectorActiveAccountInitDoneAtom(),
      activeAccountInitDoneListener,
    );
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.reloadActiveAccountInfo({
        num: 0,
        selectedAccount: defaultSelectedAccount(),
      });
    });

    expect(activeAccountsListener).not.toHaveBeenCalled();
    expect(activeAccountInitDoneListener).not.toHaveBeenCalled();
    unsubscribe();
    unsubscribeInitDone();
  });

  it('clears a stale active account after its selected account is removed', async () => {
    const clearedSelection = {
      ...defaultSelectedAccount(),
      networkId: 'evm--1',
      deriveType: 'default' as const,
    };
    const staleActiveAccount = {
      ...defaultActiveAccountInfo(),
      ready: true,
      wallet: { id: 'hd-1' } as IWallet,
      indexedAccount: {
        id: 'hd-1--0',
        walletId: 'hd-1',
      } as IIndexedAccount,
    };
    const clearedActiveAccount = {
      ...defaultActiveAccountInfo(),
      ready: true,
      network: { id: 'evm--1' } as IServerNetwork,
    };
    mockBuildActiveAccountInfoFromSelectedAccount.mockResolvedValue({
      activeAccount: clearedActiveAccount,
    });

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(selectedAccountsAtom(), { 0: clearedSelection });
    store.set(activeAccountsAtom(), { 0: staleActiveAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let reloadOutcome: string | undefined;
    await act(async () => {
      reloadOutcome = (
        await result.current.reloadActiveAccountInfo({
          forceIncompleteSelectionReload: true,
          num: 0,
          selectedAccount: clearedSelection,
        })
      ).outcome;
    });

    expect(reloadOutcome).toBe('commit');
    expect(mockBuildActiveAccountInfoFromSelectedAccount).toHaveBeenCalledTimes(
      1,
    );
    expect(store.get(activeAccountsAtom())[0]).toBe(clearedActiveAccount);
  });

  it('keeps the stale active account when only perf metadata marks the selection as cleared', async () => {
    // Guards the perfDebug contract: diagnostics metadata must never drive
    // control flow, so a perf-attributed reason alone (without the formal
    // forceIncompleteSelectionReload payload flag) must not bypass the
    // incomplete-selection guard.
    const clearedSelection = {
      ...defaultSelectedAccount(),
      networkId: 'evm--1',
      deriveType: 'default' as const,
    };
    const staleActiveAccount = {
      ...defaultActiveAccountInfo(),
      ready: true,
      wallet: { id: 'hd-1' } as IWallet,
      indexedAccount: {
        id: 'hd-1--0',
        walletId: 'hd-1',
      } as IIndexedAccount,
    };

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(selectedAccountsAtom(), { 0: clearedSelection });
    store.set(activeAccountsAtom(), { 0: staleActiveAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let reloadOutcome: string | undefined;
    await act(async () => {
      reloadOutcome = (
        await result.current.reloadActiveAccountInfo({
          num: 0,
          selectedAccount: clearedSelection,
          perfContext: {
            selectionReason: 'removeAccountSelectionClear',
            selectionTransitionId: 1,
          },
        })
      ).outcome;
    });

    expect(reloadOutcome).toBe('skip-incomplete');
    expect(
      mockBuildActiveAccountInfoFromSelectedAccount,
    ).not.toHaveBeenCalled();
    expect(store.get(activeAccountsAtom())[0]).toBe(staleActiveAccount);
  });

  it('skips an active-account build when the queued selection is already stale', async () => {
    const currentSelection = createHdSelectedAccount('hd-1--1');
    const staleSelection = createHdSelectedAccount('hd-1--0');
    const currentActiveAccount = {
      ...defaultActiveAccountInfo(),
      ready: true,
    };
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: currentSelection });
    store.set(activeAccountsAtom(), { 0: currentActiveAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let reloadOutcome: string | undefined;
    await act(async () => {
      reloadOutcome = (
        await result.current.reloadActiveAccountInfo({
          num: 0,
          selectedAccount: staleSelection,
        })
      ).outcome;
    });

    expect(reloadOutcome).toBe('stale-before-build');
    expect(
      mockBuildActiveAccountInfoFromSelectedAccount,
    ).not.toHaveBeenCalled();
    expect(store.get(activeAccountsAtom())[0]).toBe(currentActiveAccount);
  });

  it('still commits a reload when only focusedWallet moved under it', async () => {
    // focusedWallet decides which wallet the selector panel highlights and is
    // not an input to the active account, so nothing re-schedules a reload when
    // it changes. Judging staleness on it stranded the active account on the
    // previous selection: reopening the selector writes focusedWallet from the
    // (still stale) active account, the in-flight reload is dropped, and
    // re-picking the same account is a noop that schedules nothing.
    const selection = createHdSelectedAccount('hd-1--0');
    const selectionWithOtherFocus = {
      ...selection,
      focusedWallet: 'hd-2',
    };
    const builtActiveAccount = {
      ...defaultActiveAccountInfo(),
      ready: true,
    };
    mockBuildActiveAccountInfoFromSelectedAccount.mockResolvedValue({
      activeAccount: builtActiveAccount,
    });
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectionWithOtherFocus });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let reloadOutcome: string | undefined;
    await act(async () => {
      reloadOutcome = (
        await result.current.reloadActiveAccountInfo({
          num: 0,
          selectedAccount: selection,
        })
      ).outcome;
    });

    expect(reloadOutcome).toBe('commit');
    expect(mockBuildActiveAccountInfoFromSelectedAccount).toHaveBeenCalledTimes(
      1,
    );
    expect(store.get(activeAccountsAtom())[0]).toBe(builtActiveAccount);
  });

  it('marks the init gate done even when the reload is dropped as stale', async () => {
    // initFromStorage clears this map for every num. If a stale reload left the
    // gate closed, only num 0 was restored by the init fallback and swap
    // (num 1) or discover stayed on a skeleton until some later reload
    // happened to commit.
    const currentSelection = createHdSelectedAccount('hd-1--1');
    const staleSelection = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 1: currentSelection });
    store.set(accountSelectorActiveAccountInitDoneAtom(), {});
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let reloadOutcome: string | undefined;
    await act(async () => {
      reloadOutcome = (
        await result.current.reloadActiveAccountInfo({
          num: 1,
          selectedAccount: staleSelection,
        })
      ).outcome;
    });

    expect(reloadOutcome).toBe('stale-before-build');
    expect(store.get(accountSelectorActiveAccountInitDoneAtom())[1]).toBe(true);
  });

  it('skips a superseded active-account reload after waiting for the mutex', async () => {
    const firstBuild = createDeferred<IBuildActiveAccountInfoResult>();
    const activeAccount = {
      ...defaultActiveAccountInfo(),
      ready: true,
    };
    mockBuildActiveAccountInfoFromSelectedAccount
      .mockReturnValueOnce(firstBuild.promise)
      .mockResolvedValue({ activeAccount });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    let secondRequestIsLatest = true;
    let firstReload: Promise<unknown> | undefined;
    let secondReload: Promise<unknown> | undefined;
    let latestReload: Promise<unknown> | undefined;

    await act(async () => {
      firstReload = result.current.reloadActiveAccountInfo({
        num: 0,
        selectedAccount: defaultSelectedAccount(),
      });
      await Promise.resolve();
      secondReload = result.current.reloadActiveAccountInfo({
        num: 0,
        selectedAccount: defaultSelectedAccount(),
        shouldReload: () => secondRequestIsLatest,
      });
      latestReload = result.current.reloadActiveAccountInfo({
        num: 0,
        selectedAccount: defaultSelectedAccount(),
        shouldReload: () => true,
      });
      secondRequestIsLatest = false;
      await Promise.resolve();
    });

    expect(mockBuildActiveAccountInfoFromSelectedAccount).toHaveBeenCalledTimes(
      1,
    );

    let secondOutcome: string | undefined;
    await act(async () => {
      firstBuild.resolve({ activeAccount });
      await firstReload;
      secondOutcome = ((await secondReload) as { outcome: string }).outcome;
      await latestReload;
    });

    expect(secondOutcome).toBe('stale-schedule-before-build');
    expect(mockBuildActiveAccountInfoFromSelectedAccount).toHaveBeenCalledTimes(
      2,
    );
  });

  it('does not let an older storage init overwrite a newer wallet-clear init', async () => {
    const olderSelection = createHdSelectedAccount('hd-1--0');
    const olderInit = createDeferred<ISelectedAccountsMap | undefined>();
    const walletClearInit = createDeferred<ISelectedAccountsMap | undefined>();
    mockGetSelectedAccountsMap
      .mockReturnValueOnce(olderInit.promise)
      .mockReturnValueOnce(walletClearInit.promise);

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let olderInitPromise: Promise<void> | undefined;
    let walletClearInitPromise: Promise<void> | undefined;
    await act(async () => {
      olderInitPromise = result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
        trigger: 'mount',
      });
      await Promise.resolve();
      walletClearInitPromise = result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
        trigger: 'wallet-clear',
      });
      await Promise.resolve();
    });

    await act(async () => {
      walletClearInit.resolve(undefined);
      await walletClearInitPromise;
    });
    await act(async () => {
      olderInit.resolve({ 0: olderSelection });
      await olderInitPromise;
    });

    expect(store.get(selectedAccountsAtom())[0]).toEqual(
      defaultSelectedAccount(),
    );
    expect(store.get(accountSelectorStorageInitDoneAtom())).toBe(true);
  });

  it('does not let a storage reload overwrite a selection made while normalization is pending', async () => {
    const storedSelection = createHdSelectedAccount('hd-1--0');
    const freshSelection = {
      ...createHdSelectedAccount('hd-2--0'),
      focusedWallet: 'hd-2',
      walletId: 'hd-2',
    };
    const normalization = createDeferred<ISelectedAccountsMap | undefined>();
    mockGetSelectedAccountsMap.mockResolvedValue({ 0: storedSelection });
    mockFixDeriveTypesForInitAccountSelectorMap.mockReturnValueOnce(
      normalization.promise,
    );
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    let initPromise!: Promise<void>;

    await act(async () => {
      initPromise = result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
        trigger: 'warm-reload',
      });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(mockFixDeriveTypesForInitAccountSelectorMap).toHaveBeenCalledTimes(
        1,
      ),
    );
    await act(async () => {
      await result.current.updateSelectedAccount({
        num: 0,
        reason: 'fresh-selection-during-storage-reload',
        builder: () => freshSelection,
      });
    });
    await act(async () => {
      normalization.resolve({ 0: storedSelection });
      await initPromise;
    });

    expect(store.get(selectedAccountsAtom())[0]).toEqual(freshSelection);
    expect(store.get(accountSelectorStorageInitDoneAtom())).toBe(true);
  });

  it('does not let unavailable-wallet cleanup overwrite a newer persisted selection after waiting for the storage mutex', async () => {
    const unavailableSelection = createHdSelectedAccount('hd-1--0');
    const newerSelection = {
      ...createHdSelectedAccount('hd-2--0'),
      focusedWallet: 'hd-2',
      walletId: 'hd-2',
    };
    const mockedWallet = {
      id: 'hd-1',
      isMocked: true,
    } as IWallet;
    const unavailableWalletLookup = createDeferred<IWallet | undefined>();
    const newerWriteReached = createDeferred<void>();
    const releaseNewerWrite = createDeferred<void>();
    let persistedSelection: ISelectedAccount = unavailableSelection;

    mockGetSelectedAccountsMap.mockResolvedValue({
      0: unavailableSelection,
    });
    let unavailableLookupStarted = false;
    mockGetWalletSafe.mockImplementation(async ({ walletId }) => {
      if (walletId === 'hd-2') {
        return { id: 'hd-2' } as IWallet;
      }
      if (!unavailableLookupStarted) {
        unavailableLookupStarted = true;
        return unavailableWalletLookup.promise;
      }
      return mockedWallet;
    });
    mockGetSelectedAccount.mockImplementation(async () => persistedSelection);
    mockSaveSelectedAccount.mockImplementation(async ({ selectedAccount }) => {
      if (
        selectedAccount.indexedAccountId === newerSelection.indexedAccountId
      ) {
        newerWriteReached.resolve(undefined);
        await releaseNewerWrite.promise;
      }
      persistedSelection = selectedAccount;
      return { persisted: true };
    });
    mockClearUnavailableSelectedAccount.mockImplementation(
      async ({ expectedSelectedAccount, selectedAccount }) => {
        const primaryAlreadyCleared = isSameSelectedAccount(
          persistedSelection,
          selectedAccount,
        );
        const primaryMatched =
          primaryAlreadyCleared ||
          isSameSelectedAccount(persistedSelection, expectedSelectedAccount);
        if (primaryMatched && !primaryAlreadyCleared) {
          persistedSelection = selectedAccount;
        }
        return {
          homeMatched: false,
          homeSelectionIntentMatched: true,
          primaryMatched,
          primaryPersisted: primaryMatched && !primaryAlreadyCleared,
          storageInitGenerationMatched: true,
          syncedHome: false,
        };
      },
    );

    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    let initPromise: Promise<void> | undefined;
    let newerSavePromise: Promise<EStorageSaveOutcome> | undefined;

    await act(async () => {
      initPromise = result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(mockGetWalletSafe).toHaveBeenCalled());

    await act(async () => {
      await result.current.updateSelectedAccount({
        num: 0,
        reason: 'newer-selection-during-storage-init',
        builder: () => newerSelection,
      });
    });
    const newerSelectionUpdatedAt = store.get(
      accountSelectorUpdateMetaAtom(),
    )[0]?.updatedAt;
    await act(async () => {
      newerSavePromise = result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount: newerSelection,
        selectedAccountUpdatedAt: newerSelectionUpdatedAt,
        trigger: 'newer-selection-during-storage-init',
      });
      await newerWriteReached.promise;
    });

    await act(async () => {
      unavailableWalletLookup.resolve(mockedWallet);
      // Let the old cleanup pass its generation guard and queue behind the
      // newer save that currently owns the UI-runtime storage mutex.
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      releaseNewerWrite.resolve(undefined);
      await newerSavePromise;
      await initPromise;
    });

    expect(persistedSelection).toEqual(newerSelection);
    expect(store.get(selectedAccountsAtom())[0]).toEqual(newerSelection);
    expect(mockClearUnavailableSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSelectedAccount: unavailableSelection,
        selectedAccount: expect.objectContaining({
          indexedAccountId: undefined,
          walletId: undefined,
        }),
      }),
    );
  });

  it('does not let cleanup from an older background init clear the same selection after the wallet recovers', async () => {
    const unavailableSelection = createHdSelectedAccount('hd-1--0');
    const mockedWallet = {
      id: 'hd-1',
      isMocked: true,
    } as IWallet;
    const recoveredWallet = { id: 'hd-1' } as IWallet;
    const cleanupReached = createDeferred<void>();
    const releaseCleanup = createDeferred<void>();
    let backgroundInitGeneration = 0;
    let persistedSelection = unavailableSelection;

    mockBeginAccountSelectorStorageInit.mockImplementation(async () => {
      backgroundInitGeneration += 1;
      return backgroundInitGeneration;
    });
    mockGetSelectedAccountsMap.mockResolvedValue({
      0: unavailableSelection,
    });
    mockGetWalletSafe
      .mockResolvedValueOnce(mockedWallet)
      .mockResolvedValue(recoveredWallet);
    mockGetSelectedAccount.mockImplementation(async () => persistedSelection);
    mockClearUnavailableSelectedAccount.mockImplementation(
      async ({ selectedAccount, storageInitGeneration }) => {
        cleanupReached.resolve(undefined);
        await releaseCleanup.promise;
        const generationMatched =
          storageInitGeneration === undefined ||
          storageInitGeneration === backgroundInitGeneration;
        if (generationMatched) {
          persistedSelection = selectedAccount;
        }
        return {
          homeMatched: false,
          homeSelectionIntentMatched: true,
          primaryMatched: generationMatched,
          primaryPersisted: generationMatched,
          storageInitGenerationMatched: generationMatched,
          syncedHome: false,
        };
      },
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    let olderInit: Promise<void> | undefined;

    await act(async () => {
      olderInit = result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
        trigger: 'older-unavailable-wallet-init',
      });
      await cleanupReached.promise;
    });
    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
        trigger: 'newer-recovered-wallet-init',
      });
    });
    await act(async () => {
      releaseCleanup.resolve(undefined);
      await olderInit;
    });

    expect(backgroundInitGeneration).toBe(2);
    expect(persistedSelection).toEqual(unavailableSelection);
    expect(mockClearUnavailableSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSelectedAccount: unavailableSelection,
        storageInitGeneration: 1,
      }),
    );
  });

  it('aborts storage init instead of applying a cleared map after the background CAS rejects', async () => {
    const unavailableSelection = createHdSelectedAccount('hd-1--0');
    const currentSelection = {
      ...createHdSelectedAccount('hd-2--0'),
      focusedWallet: 'hd-2',
      walletId: 'hd-2',
    };
    mockGetSelectedAccountsMap.mockResolvedValue({
      0: unavailableSelection,
    });
    mockGetWalletSafe.mockImplementation(async ({ walletId }) =>
      walletId === 'hd-1'
        ? ({ id: walletId, isMocked: true } as IWallet)
        : ({ id: walletId } as IWallet),
    );
    mockClearUnavailableSelectedAccount.mockResolvedValue({
      homeMatched: false,
      homeSelectionIntentMatched: false,
      primaryMatched: false,
      primaryPersisted: false,
      storageInitGenerationMatched: false,
      syncedHome: false,
    });

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: currentSelection });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
        trigger: 'background-cas-reject-test',
      });
    });

    expect(mockClearUnavailableSelectedAccount).toHaveBeenCalled();
    expect(store.get(accountSelectorUpdateMetaAtom())[0]).toBeUndefined();
    expect(store.get(selectedAccountsAtom())[0]).toEqual(currentSelection);
  });

  it('records a same-account user intent before noop persistence and aborts the older cleanup', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const mockedWallet = {
      id: 'hd-1',
      isMocked: true,
    } as IWallet;
    const recoveredWallet = { id: 'hd-1' } as IWallet;
    const cleanupReached = createDeferred<void>();
    const releaseCleanup = createDeferred<void>();
    let backgroundInitGeneration = 0;
    let persistedSelection = selectedAccount;

    mockBeginAccountSelectorStorageInit.mockImplementation(async () => {
      backgroundInitGeneration += 1;
      return backgroundInitGeneration;
    });
    mockRecordSelectedAccountIntent.mockImplementation(async () => {
      backgroundInitGeneration += 1;
      return 1;
    });
    mockGetSelectedAccountsMap.mockResolvedValue({ 0: selectedAccount });
    mockGetSelectedAccount.mockImplementation(async () => persistedSelection);
    mockGetWalletSafe
      .mockResolvedValueOnce(mockedWallet)
      .mockResolvedValue(recoveredWallet);
    mockClearUnavailableSelectedAccount.mockImplementation(
      async ({ selectedAccount: clearedSelection, storageInitGeneration }) => {
        cleanupReached.resolve(undefined);
        await releaseCleanup.promise;
        const generationMatched =
          storageInitGeneration === backgroundInitGeneration;
        if (generationMatched) {
          persistedSelection = clearedSelection;
        }
        return {
          homeMatched: false,
          homeSelectionIntentMatched: true,
          primaryMatched: generationMatched,
          primaryPersisted: generationMatched,
          storageInitGenerationMatched: generationMatched,
          syncedHome: false,
        };
      },
    );

    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorContextDataAtom(), {
      sceneName: EAccountSelectorSceneName.home,
    });
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    let initPromise: Promise<void> | undefined;
    let confirmPromise: Promise<boolean> | undefined;

    await act(async () => {
      initPromise = result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
        trigger: 'same-account-intent-old-init',
      });
      await cleanupReached.promise;
    });
    await act(async () => {
      confirmPromise = result.current.confirmAccountSelect({
        indexedAccount: {
          id: 'hd-1--0',
          walletId: 'hd-1',
        } as IIndexedAccount,
        othersWalletAccount: undefined,
        num: 0,
      });
      await waitFor(() => {
        expect(mockRecordSelectedAccountIntent).toHaveBeenCalled();
      });
    });
    await act(async () => {
      releaseCleanup.resolve(undefined);
      await expect(confirmPromise).resolves.toBe(true);
      await initPromise;
    });

    expect(mockRecordSelectedAccountIntent).toHaveBeenCalledTimes(1);
    expect(mockRecordSelectedAccountIntent).toHaveBeenCalledWith({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: undefined,
      selectedAccount,
    });
    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(store.get(accountSelectorUpdateMetaAtom())[0]).toBeUndefined();
    expect(persistedSelection).toEqual(selectedAccount);
    expect(store.get(selectedAccountsAtom())[0]).toEqual(selectedAccount);
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

    it('waits for explicit storage persistence before confirming', async () => {
      const saveDeferred = createDeferred<{ persisted: boolean }>();
      mockSaveSelectedAccount.mockReturnValueOnce(saveDeferred.promise);

      const { store, Wrapper } = createWrapper();
      store.set(accountSelectorContextDataAtom(), {
        sceneName: EAccountSelectorSceneName.home,
      });
      seedSelection(store, 'tron--0x2b6653dc');
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });
      let confirmed = false;
      let confirmPromise: Promise<boolean> | undefined;

      await act(async () => {
        confirmPromise = result.current.confirmAccountSelect({
          indexedAccount: qrIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
        void confirmPromise.then((value) => {
          confirmed = value;
        });
        await waitFor(() => {
          expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
        });
      });

      expect(confirmed).toBe(false);

      await act(async () => {
        saveDeferred.resolve({ persisted: true });
        await confirmPromise;
      });

      expect(confirmed).toBe(true);
    });

    it('rejects when the selection cannot be persisted', async () => {
      // The contract every call site is written against: a superseded selection
      // resolves false, but a persistence failure rejects so the caller can tell
      // the user their pick was not saved instead of closing the selector on a
      // selection that only exists in memory. Callers must keep catching this.
      mockSaveSelectedAccount.mockRejectedValueOnce(
        new Error('storage unavailable'),
      );

      const { store, Wrapper } = createWrapper();
      store.set(accountSelectorContextDataAtom(), {
        sceneName: EAccountSelectorSceneName.home,
      });
      seedSelection(store, 'tron--0x2b6653dc');
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        await expect(
          result.current.confirmAccountSelect({
            indexedAccount: qrIndexedAccount,
            othersWalletAccount: undefined,
            num: 0,
          }),
        ).rejects.toThrow('storage unavailable');
      });
    });

    it('rejects an A confirm without side effects when a newer B intent arrives before its save', async () => {
      const intentRecorded = createDeferred<void>();
      const releaseRecentCacheFlush = createDeferred<void>();
      let latestIntentEpoch = 0;
      mockRecordSelectedAccountIntent.mockImplementation(async () => {
        latestIntentEpoch = 1;
        intentRecorded.resolve(undefined);
        return latestIntentEpoch;
      });
      mockFlushColdStartCacheNow.mockImplementationOnce(async () => {
        await releaseRecentCacheFlush.promise;
      });
      mockGetSelectedAccount.mockResolvedValue(undefined);
      mockSaveSelectedAccount.mockImplementation(async (params) => ({
        persisted: false,
        staleSelectionIntent: params.selectionIntentEpoch !== latestIntentEpoch,
      }));

      const { store, Wrapper } = createWrapper();
      store.set(accountSelectorContextDataAtom(), {
        sceneName: EAccountSelectorSceneName.home,
      });
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });
      let confirmPromise: Promise<boolean> | undefined;

      await act(async () => {
        confirmPromise = result.current.confirmAccountSelect({
          indexedAccount: {
            id: 'hd-1--0',
            walletId: 'hd-1',
          } as IIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
        await intentRecorded.promise;
      });
      latestIntentEpoch = 2;
      await act(async () => {
        releaseRecentCacheFlush.resolve(undefined);
        await expect(confirmPromise).rejects.toThrow(/selection intent/i);
      });

      expect(mockSaveSelectedAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedAccount: expect.objectContaining({
            indexedAccountId: 'hd-1--0',
          }),
          selectionIntentEpoch: 1,
        }),
      );
      expect(mockSaveGlobalDeriveType).not.toHaveBeenCalled();
      expect(mockShouldSyncWithHomeSource).not.toHaveBeenCalled();
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

    it('does not reuse a completed request id while an older request is pending', async () => {
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
      let thirdSelect: Promise<boolean> | undefined;

      await act(async () => {
        const firstSelect = result.current.confirmAccountSelect({
          indexedAccount: {
            id: 'hd-2--0',
            walletId: 'hd-2',
          } as IIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
        const secondSelect = result.current.confirmAccountSelect({
          indexedAccount: qrIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });

        await Promise.resolve();
        resolvers.get('qr-1')?.('btc--0');
        await secondSelect;

        thirdSelect = result.current.confirmAccountSelect({
          indexedAccount: {
            id: 'hd-3--0',
            walletId: 'hd-3',
          } as IIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
          forceSelectToNetworkId: getNetworkIdsMap().onekeyall,
        });

        resolvers.get('hd-2')?.('evm--1');
        await firstSelect;
      });

      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'qr-1',
        indexedAccountId: 'qr-1--0',
        networkId: 'btc--0',
      });

      await act(async () => {
        resolvers.get('hd-3')?.('sol--101');
        await thirdSelect;
      });

      expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
        walletId: 'hd-3',
        indexedAccountId: 'hd-3--0',
        networkId: 'sol--101',
      });
    });

    it('supersedes a selection started before the scene identity arrived', async () => {
      // AccountSelectorEffects publishes the scene identity after mount, so a
      // selection can start without it. Both requests belong to the same store
      // and must share one bucket, otherwise the earlier one still sees itself
      // as current and overwrites the user's later choice.
      const resolvers = new Map<string, (value: string | undefined) => void>();
      mockGetAllNetworksFallbackNetworkId.mockImplementation(
        ({ walletId }) =>
          new Promise<string | undefined>((resolve) => {
            resolvers.set(walletId, resolve);
          }),
      );

      const { store, Wrapper } = createWrapper();
      seedSelection(store, getNetworkIdsMap().onekeyall);
      expect(store.get(accountSelectorContextDataAtom())).toBeUndefined();
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });

      await act(async () => {
        const beforeSceneReady = result.current.confirmAccountSelect({
          indexedAccount: {
            id: 'hd-2--0',
            walletId: 'hd-2',
          } as IIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
        await waitFor(() => expect(resolvers.has('hd-2')).toBe(true));

        store.set(accountSelectorContextDataAtom(), {
          sceneName: EAccountSelectorSceneName.home,
        });
        const afterSceneReady = result.current.confirmAccountSelect({
          indexedAccount: qrIndexedAccount,
          othersWalletAccount: undefined,
          num: 0,
        });
        await waitFor(() => expect(resolvers.has('qr-1')).toBe(true));

        resolvers.get('qr-1')?.('btc--0');
        expect(await afterSceneReady).toBe(true);
        resolvers.get('hd-2')?.('evm--1');
        expect(await beforeSceneReady).toBe(false);
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

  it('rechecks a pending storage save after account pair normalization', async () => {
    const pendingSelection = createHdSelectedAccount('hd-1--0');
    const fixedSelectionDeferred = createDeferred<ISelectedAccount>();
    mockFixOthersWalletAccountNetworkPair.mockReturnValueOnce(
      fixedSelectionDeferred.promise,
    );

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: pendingSelection });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let savePromise: Promise<EStorageSaveOutcome> | undefined;
    await act(async () => {
      savePromise = result.current.saveToStorage({
        selectedAccount: pendingSelection,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: 1000,
      });
      await Promise.resolve();
    });
    expect(mockFixOthersWalletAccountNetworkPair).toHaveBeenCalled();

    await act(async () => {
      store.set(selectedAccountsAtom(), {
        0: createHdSelectedAccount('hd-1--1'),
      });
      fixedSelectionDeferred.resolve(pendingSelection);
      await savePromise;
    });

    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).not.toHaveBeenCalled();
  });

  it('coalesces concurrent storage saves for the same selection revision', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const fixedSelectionDeferred = createDeferred<ISelectedAccount>();
    mockFixOthersWalletAccountNetworkPair.mockReturnValueOnce(
      fixedSelectionDeferred.promise,
    );
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 1000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let firstSave: Promise<EStorageSaveOutcome> | undefined;
    let secondSave: Promise<EStorageSaveOutcome> | undefined;
    await act(async () => {
      firstSave = result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1000,
        trigger: 'confirm-explicit',
      });
      secondSave = result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1000,
        trigger: 'selection-effect',
      });
      await Promise.resolve();
    });

    expect(mockFixOthersWalletAccountNetworkPair).toHaveBeenCalledTimes(1);

    await act(async () => {
      fixedSelectionDeferred.resolve(selectedAccount);
      await Promise.all([firstSave, secondSave]);
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
  });

  it('coalesces sequential storage saves for the same selection revision', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 1000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1000,
        trigger: 'confirm-explicit',
      });
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1000,
        trigger: 'selection-effect',
      });
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
    expect(mockSaveGlobalDeriveType).toHaveBeenCalledTimes(1);
  });

  it('replays a dropped change event when the same selection is saved again', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const otherAccount = createHdSelectedAccount('hd-1--1');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 1000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);

    const writeDeferred = createDeferred<{ persisted: boolean }>();
    mockSaveSelectedAccount.mockReturnValueOnce(writeDeferred.promise);
    let droppedSave: Promise<EStorageSaveOutcome> | undefined;
    await act(async () => {
      droppedSave = result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1000,
        trigger: 'confirm-explicit',
      });
      await Promise.resolve();
    });
    await act(async () => {
      // the selection moves away while the record is being written
      store.set(selectedAccountsAtom(), { 0: otherAccount });
      store.set(accountSelectorUpdateMetaAtom(), {
        0: { eventEmitDisabled: false, updatedAt: 1001 },
      });
      writeDeferred.resolve({ persisted: true });
      await droppedSave;
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      expect.anything(),
    );

    // the selection comes back, so the record is already on disk
    mockGetSelectedAccount.mockResolvedValue(selectedAccount);
    await act(async () => {
      store.set(selectedAccountsAtom(), { 0: selectedAccount });
      store.set(accountSelectorUpdateMetaAtom(), {
        0: { eventEmitDisabled: false, updatedAt: 1002 },
      });
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1002,
        trigger: 'selection-effect',
      });
    });

    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      expect.objectContaining({ selectedAccount }),
    );
    expect(mockSaveGlobalDeriveType).toHaveBeenCalledTimes(1);
  });

  it.each(['global-derive', 'home-sync', 'event'] as const)(
    'replays every side effect after a persisted primary loses the %s stage',
    async (failureStage) => {
      const selectedAccount = createHdSelectedAccount('hd-1--0');
      const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
      store.set(selectedAccountsAtom(), { 0: selectedAccount });
      store.set(accountSelectorUpdateMetaAtom(), {
        0: { eventEmitDisabled: false, updatedAt: 1000 },
      });
      const { result } = renderHook(() => useAccountSelectorActions().current, {
        wrapper: Wrapper,
      });
      const failure = new OneKeyLocalError(`${failureStage} failed`);
      const emitSpy = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
      let primaryPersisted = false;
      let homeFailurePending = failureStage === 'home-sync';

      mockShouldSyncWithHomeSource.mockResolvedValue(true);
      mockGetSelectedAccount.mockImplementation(async ({ sceneName }) => {
        if (sceneName === EAccountSelectorSceneName.swap) {
          return primaryPersisted ? selectedAccount : undefined;
        }
        return defaultSelectedAccount();
      });
      mockSaveSelectedAccount.mockImplementation(async ({ sceneName }) => {
        if (sceneName === EAccountSelectorSceneName.swap) {
          primaryPersisted = true;
          return { persisted: true };
        }
        return { persisted: true };
      });
      mockSaveSelectedAccountIfWriteIntentCurrent.mockImplementation(
        async () => {
          if (homeFailurePending) {
            homeFailurePending = false;
            throw failure;
          }
          return { persisted: true };
        },
      );
      if (failureStage === 'global-derive') {
        mockSaveGlobalDeriveType.mockRejectedValueOnce(failure);
      }
      if (failureStage === 'event') {
        emitSpy.mockImplementationOnce(() => {
          throw failure;
        });
      }

      await act(async () => {
        await expect(
          result.current.saveToStorage({
            num: 0,
            sceneName: EAccountSelectorSceneName.swap,
            selectedAccount,
            selectedAccountUpdatedAt: 1000,
            trigger: 'confirm-explicit',
          }),
        ).rejects.toThrow(failure);
      });

      await act(async () => {
        store.set(accountSelectorUpdateMetaAtom(), {
          0: { eventEmitDisabled: false, updatedAt: 1001 },
        });
        await result.current.saveToStorage({
          num: 0,
          sceneName: EAccountSelectorSceneName.swap,
          selectedAccount,
          selectedAccountUpdatedAt: 1001,
          trigger: 'selection-effect',
        });
      });

      const primaryWrites = mockSaveSelectedAccount.mock.calls.filter(
        ([params]) => params.sceneName === EAccountSelectorSceneName.swap,
      );
      expect(primaryWrites).toHaveLength(1);
      expect(mockSaveGlobalDeriveType).toHaveBeenCalledTimes(2);
      expect(emitSpy).toHaveBeenCalledWith(
        EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        expect.objectContaining({ selectedAccount }),
      );

      const deriveCallsAfterRecovery =
        mockSaveGlobalDeriveType.mock.calls.length;
      const eventCallsAfterRecovery = emitSpy.mock.calls.length;
      await act(async () => {
        store.set(accountSelectorUpdateMetaAtom(), {
          0: { eventEmitDisabled: false, updatedAt: 1002 },
        });
        await result.current.saveToStorage({
          num: 0,
          sceneName: EAccountSelectorSceneName.swap,
          selectedAccount,
          selectedAccountUpdatedAt: 1002,
          trigger: 'selection-effect',
        });
      });
      expect(mockSaveGlobalDeriveType).toHaveBeenCalledTimes(
        deriveCallsAfterRecovery,
      );
      expect(emitSpy).toHaveBeenCalledTimes(eventCallsAfterRecovery);
    },
  );

  it('keeps short circuiting a saved selection that lost no side effects', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 1000 },
    });
    mockGetSelectedAccount.mockResolvedValue(selectedAccount);
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);

    await act(async () => {
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1000,
        trigger: 'selection-effect',
      });
    });

    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      expect.anything(),
    );
  });

  it('replays side effects for an already-saved selection on extension', async () => {
    // The extension popup can be reclaimed by the browser between the primary
    // write and its side effects, and the pending-side-effect record is
    // memory-only there, so the skip optimization must never fire.
    jest.replaceProperty(platformEnv, 'isExtension', true);
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 1000 },
    });
    mockGetSelectedAccount.mockResolvedValue(selectedAccount);
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);

    await act(async () => {
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1000,
        trigger: 'selection-effect',
      });
    });

    // The primary record is already on disk, so no second write, but the side
    // effects (global derive save, change event) must still run.
    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      expect.objectContaining({ selectedAccount }),
    );
  });

  it('suppresses the change event of an unversioned extension replay with nothing to broadcast', async () => {
    // Extension cold start: the meta atom holds no revision (initFromStorage
    // applies storage as 'untracked' and the recent cache is a no-op there),
    // so the auto-save cannot short-circuit and the replay runs for the plain
    // disk value. Already saved + no revision = no delta to broadcast:
    // re-announcing the snapshot as an unversioned event could overwrite a
    // peer that holds no revision yet. Only the event is suppressed - the
    // derive/home-sync replay is the killed-popup recovery channel and must
    // still run.
    jest.replaceProperty(platformEnv, 'isExtension', true);
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {});
    mockGetSelectedAccount.mockResolvedValue(selectedAccount);
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);

    await act(async () => {
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: undefined,
        trigger: 'selection-effect',
      });
    });

    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      expect.anything(),
    );
  });

  it('still emits an unversioned event whose primary write carried a delta', async () => {
    // An unversioned save that actually wrote the primary (e.g. an init
    // repair changed the record) is a real delta and must reach the peers.
    // Receivers guard themselves: the unversioned event applies only where no
    // committed revision exists.
    jest.replaceProperty(platformEnv, 'isExtension', true);
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {});
    mockGetSelectedAccount.mockResolvedValue(
      createHdSelectedAccount('hd-1--1'),
    );
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);

    await act(async () => {
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: undefined,
        trigger: 'selection-effect',
      });
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      expect.objectContaining({ selectedAccount }),
    );
  });

  it('short circuits a saved selection that background returned without its undefined keys', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 1000 },
    });
    mockGetSelectedAccount.mockResolvedValue(
      bridgeThroughBackground(selectedAccount),
    );
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);

    await act(async () => {
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount,
        selectedAccountUpdatedAt: 1000,
        trigger: 'selection-effect',
      });
    });

    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      expect.anything(),
    );
  });

  it('does not restore a recent selection cache that already matches the bridged storage map', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    mockGetSelectedAccountsMap.mockResolvedValue(
      bridgeThroughBackground({ 0: selectedAccount }),
    );
    await getAccountSelectorActions().setRecentAccountSelectorSelectionCache({
      sceneName: EAccountSelectorSceneName.home,
      selectedAccountsMap: { 0: selectedAccount },
      updateMeta: {
        0: {
          eventEmitDisabled: false,
          updatedAt: Date.now(),
        },
      },
    });

    const { store, Wrapper } = createWrapper();
    const selectedAccountsMapInMemory = { 0: selectedAccount };
    store.set(selectedAccountsAtom(), selectedAccountsMapInMemory);
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.initFromStorage({
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())).toBe(selectedAccountsMapInMemory);
    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
  });

  it('does not apply a global derive type resolved for a stale selection', async () => {
    const globalDeriveDeferred = createDeferred<string>();
    mockGetGlobalDeriveType.mockReturnValueOnce(globalDeriveDeferred.promise);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: {
        ...createHdSelectedAccount('hd-1--0'),
        networkId: 'evm--1',
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let syncPromise: Promise<unknown> | undefined;
    await act(async () => {
      syncPromise = result.current.syncLocalDeriveTypeFromGlobal({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
      await Promise.resolve();
    });

    await act(async () => {
      store.set(selectedAccountsAtom(), {
        0: {
          ...createHdSelectedAccount('hd-1--0'),
          networkId: 'btc--0',
        },
      });
      globalDeriveDeferred.resolve('ledger_live');
      await syncPromise;
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      deriveType: 'default',
      networkId: 'btc--0',
    });
  });

  it('does not overwrite a newer derive type on the same account and network', async () => {
    const globalDeriveDeferred = createDeferred<string>();
    mockGetGlobalDeriveType.mockReturnValueOnce(globalDeriveDeferred.promise);
    const initialSelection = {
      ...createHdSelectedAccount('hd-1--0'),
      networkId: 'evm--1',
      deriveType: 'default' as const,
    };
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: initialSelection });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let syncPromise: Promise<unknown> | undefined;
    await act(async () => {
      syncPromise = result.current.syncLocalDeriveTypeFromGlobal({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
      await Promise.resolve();
    });

    await act(async () => {
      store.set(selectedAccountsAtom(), {
        0: { ...initialSelection, deriveType: 'ledgerLive' },
      });
      globalDeriveDeferred.resolve('BIP44');
      await syncPromise;
    });

    expect(store.get(selectedAccountsAtom())[0]?.deriveType).toBe('ledgerLive');
  });

  it('applies a global derive type when only focusedWallet moved under the sync', async () => {
    // Opening the account selector panel writes focusedWallet and nothing
    // else. The sync's decision is derived from (networkId, deriveType) only,
    // so that unrelated write must not drop the sync as stale.
    const globalDeriveDeferred = createDeferred<string>();
    mockGetGlobalDeriveType.mockReturnValueOnce(globalDeriveDeferred.promise);
    const initialSelection = {
      ...createHdSelectedAccount('hd-1--0'),
      networkId: 'evm--1',
    };
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: initialSelection });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let syncPromise: Promise<unknown> | undefined;
    await act(async () => {
      syncPromise = result.current.syncLocalDeriveTypeFromGlobal({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
      await Promise.resolve();
    });

    await act(async () => {
      store.set(selectedAccountsAtom(), {
        0: { ...initialSelection, focusedWallet: 'hd-2' },
      });
      globalDeriveDeferred.resolve('ledger_live');
      await syncPromise;
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      deriveType: 'ledger_live',
      focusedWallet: 'hd-2',
      networkId: 'evm--1',
    });
  });

  it('drops a sync for a changed network but a re-sync against it succeeds', async () => {
    // The stale drop is deliberately not retried by the sync itself: the
    // network change that caused it re-runs useAutoSelectDeriveType's main
    // effect, which issues a fresh sync against the new network. This locks
    // the handover: the same call, made again after the change, must succeed.
    const globalDeriveDeferred = createDeferred<string>();
    mockGetGlobalDeriveType.mockReturnValueOnce(globalDeriveDeferred.promise);
    const initialSelection = {
      ...createHdSelectedAccount('hd-1--0'),
      networkId: 'evm--1',
    };
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: initialSelection });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let syncPromise: Promise<unknown> | undefined;
    await act(async () => {
      syncPromise = result.current.syncLocalDeriveTypeFromGlobal({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
      await Promise.resolve();
    });

    await act(async () => {
      store.set(selectedAccountsAtom(), {
        0: { ...initialSelection, networkId: 'btc--0' },
      });
      globalDeriveDeferred.resolve('ledger_live');
      await syncPromise;
    });

    // The first sync was resolved for evm--1 and must not land on btc--0.
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      deriveType: 'default',
      networkId: 'btc--0',
    });

    mockGetGlobalDeriveType.mockResolvedValueOnce('BIP86');
    await act(async () => {
      await result.current.syncLocalDeriveTypeFromGlobal({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      deriveType: 'BIP86',
      networkId: 'btc--0',
    });
  });

  it('does not let auto-select overwrite a selection changed while resolving a wallet', async () => {
    const walletDeferred = createDeferred<IWallet | undefined>();
    mockGetWalletSafe.mockReturnValueOnce(walletDeferred.promise);
    const initialSelection = createHdSelectedAccount('hd-1--0');
    const latestSelection = createHdSelectedAccount('hd-1--1');
    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorStorageReadyAtom(), true);
    store.set(selectedAccountsAtom(), { 0: initialSelection });
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        network: { id: initialSelection.networkId } as IServerNetwork,
        ready: true,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let autoSelectPromise: Promise<unknown> | undefined;
    await act(async () => {
      autoSelectPromise = result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockGetWalletSafe).toHaveBeenCalled();

    await act(async () => {
      store.set(selectedAccountsAtom(), { 0: latestSelection });
      walletDeferred.resolve({ id: 'hd-1' } as IWallet);
      await autoSelectPromise;
    });

    expect(store.get(selectedAccountsAtom())[0]).toEqual(latestSelection);
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

    let firstOutcome: string | undefined;
    await act(async () => {
      firstOutcome = await result.current.saveToStorage({
        selectedAccount,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: 2000,
        trigger: 'selection-effect',
      });
    });

    expect(firstOutcome).toBe('skip-incompatible');
    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();
    expect(mockSaveGlobalDeriveType).not.toHaveBeenCalled();

    mockGetDBAccount.mockResolvedValue({
      ...currentBtcAccount,
      impl: 'evm',
      networks: ['evm--42161'],
    });
    await act(async () => {
      await result.current.saveToStorage({
        selectedAccount,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: 2000,
        trigger: 'selection-effect',
      });
    });
    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
  });

  it('does not let automated warm-start saves run before process-local init', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const { store, Wrapper } = createWrapper();
    store.set(accountSelectorStorageInitDoneAtom(), false);
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await expect(
      result.current.saveToStorage({
        selectedAccount,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: 2000,
        trigger: 'selection-effect',
      }),
    ).resolves.toBe('skip-init-pending');
    expect(mockSaveSelectedAccount).not.toHaveBeenCalled();

    store.set(accountSelectorStorageInitDoneAtom(), true);
    await expect(
      result.current.saveToStorage({
        selectedAccount,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
        selectedAccountUpdatedAt: 2000,
        trigger: 'selection-effect',
      }),
    ).resolves.toBe('persisted');
    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
  });

  it('skips Home sync when a newer Home write intent owns the scope', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const newerHome = createHdSelectedAccount('hd-1--1');
    mockShouldSyncWithHomeSource.mockResolvedValue(true);
    mockGetSelectedAccountWriteIntentEpoch.mockResolvedValue(7);
    mockGetSelectedAccount.mockImplementation(async ({ sceneName }) =>
      sceneName === EAccountSelectorSceneName.home ? newerHome : undefined,
    );
    mockSaveSelectedAccountIfWriteIntentCurrent.mockResolvedValue({
      persisted: false,
    });

    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await result.current.saveToStorage({
      selectedAccount,
      sceneName: EAccountSelectorSceneName.swap,
      num: 0,
      selectedAccountUpdatedAt: 2000,
    });

    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
    expect(mockSaveSelectedAccountIfWriteIntentCurrent).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedWriteIntentEpoch: 7,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      }),
    );
  });

  it('captures the Home write epoch lazily for a newly enabled sync source', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--0');
    const homeSelectedAccount = createHdSelectedAccount('hd-1--1');
    mockShouldSyncWithHomeSource.mockResolvedValue(true);
    mockGetSelectedAccountWriteIntentEpoch.mockResolvedValue(9);
    mockGetSelectedAccount.mockImplementation(async ({ sceneName }) =>
      sceneName === EAccountSelectorSceneName.home
        ? homeSelectedAccount
        : undefined,
    );

    const { store, Wrapper } = createWrapper(
      EAccountSelectorSceneName.discover,
    );
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await result.current.saveToStorage({
      selectedAccount,
      sceneName: EAccountSelectorSceneName.discover,
      num: 0,
      selectedAccountUpdatedAt: 2000,
    });

    expect(mockGetSelectedAccountWriteIntentEpoch).toHaveBeenCalledWith({
      sceneName: EAccountSelectorSceneName.home,
      num: 0,
    });
    expect(mockSaveSelectedAccountIfWriteIntentCurrent).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedWriteIntentEpoch: 9,
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      }),
    );
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

  it('keeps the local value when a home-swap event ties on revision with a different value', async () => {
    // Same-millisecond commits on both sides cannot be ordered, so neither
    // side may overwrite the other: each keeps its own value and the conflict
    // is logged (symmetric judgment - the peer drops our event the same way).
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

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.syncHomeAndSwapSelectedAccount({
          eventPayload: {
            selectedAccount: createHdSelectedAccount('hd-1--0'),
            selectedAccountUpdatedAt: 2000,
            sceneName: EAccountSelectorSceneName.swap,
            num: 0,
          },
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
        })
      ).outcome;
    });

    expect(outcome).toBe('skip-equal-event-conflict');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(loggerCallPaths).toContain(
      'accountSelector.staleDrop.equalRevisionConflictKeptLocal',
    );
  });

  it('drops a home-swap event without a source revision when a revision is committed', async () => {
    // An unversioned event is a cold-start replay of a disk snapshot, not a
    // user action. The legacy always-apply semantics let it overwrite a live
    // selection; now it may only fill a slot with no committed revision.
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

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.syncHomeAndSwapSelectedAccount({
          eventPayload: {
            selectedAccount: createHdSelectedAccount('hd-1--0'),
            selectedAccountUpdatedAt: undefined,
            sceneName: EAccountSelectorSceneName.swap,
            num: 0,
          },
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
        })
      ).outcome;
    });

    expect(outcome).toBe('skip-unversioned-event');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });

  it('applies an unversioned home-swap event to a cold slot and lets a real revision win later', async () => {
    // The A1 stuck-rollback regression: an extension popup cold start used to
    // broadcast the disk snapshot without a revision, receivers applied it
    // unconditionally and stamped their receive time as its revision, and the
    // genuine update that followed (emitted at T1 < now) lost the
    // compare-if-newer forever. The unversioned apply must leave the slot
    // unversioned so the later versioned event still wins - restoring the
    // `?? Date.now()` fallback at the call site makes this test fail.
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(true);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--2'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {});
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const syncEvent = (
      indexedAccountId: string,
      selectedAccountUpdatedAt: number | undefined,
    ) =>
      result.current.syncHomeAndSwapSelectedAccount({
        eventPayload: {
          selectedAccount: createHdSelectedAccount(indexedAccountId),
          selectedAccountUpdatedAt,
          sceneName: EAccountSelectorSceneName.swap,
          num: 0,
        },
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      });

    await act(async () => {
      expect((await syncEvent('hd-1--0', undefined)).outcome).toBe('commit');
    });

    // Applied, but without minting a revision: the slot stays unversioned.
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--0',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(
      undefined,
    );
    expect(
      store.get(accountSelectorUpdateMetaAtom())[0]?.eventEmitDisabled,
    ).toBe(true);

    await act(async () => {
      // A real revision far in the past relative to the receive time above -
      // exactly the event the stamped Date.now() used to outrank.
      expect((await syncEvent('hd-1--1', 1000)).outcome).toBe('commit');
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(1000);
  });

  it('lets the Effects-path sync land after a listener apply that forwards the event revision', async () => {
    // One home account switch fans out to two appliers on the swap store: the
    // swap page listener (syncSwapSelectedAccountFromHome in useSwapGlobal)
    // and the AccountSelectorEffects path (syncHomeAndSwapSelectedAccount,
    // the only one that runs fixOthersWalletAccountNetworkPair). The listener
    // used to mint Date.now() as its commit revision, which outranked the
    // event's real revision and dropped the Effects-path delivery as
    // skip-older-event; forwarding the event revision makes the second
    // delivery tie and converge as a noop instead. Restoring a Date.now()
    // revision at the swap listener call site makes this test fail.
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(true);

    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--0'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        updatedAt: 1000,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const homeSelectedAccount = createHdSelectedAccount('hd-1--1');
    const homeCommitUpdatedAt = 2000;

    // The swap page listener path: apply the event's selection under the
    // event's own source revision (the fixed call shape of
    // syncSwapSelectedAccountFromHome).
    await act(async () => {
      const listenerResult = await result.current.updateSelectedAccount({
        eventUpdatedAt: homeCommitUpdatedAt,
        num: 0,
        reason: 'syncSwapSelectedAccountFromHome',
        updateMeta: {
          eventEmitDisabled: true,
          updatedAt: homeCommitUpdatedAt,
        },
        builder: () => homeSelectedAccount,
      });
      expect(listenerResult.outcome).toBe('commit');
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(
      homeCommitUpdatedAt,
    );

    // The Effects path delivering the SAME home change afterwards: no longer
    // older than the listener's commit, so it is not dropped.
    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.syncHomeAndSwapSelectedAccount({
          eventPayload: {
            selectedAccount: homeSelectedAccount,
            selectedAccountUpdatedAt: homeCommitUpdatedAt,
            sceneName: EAccountSelectorSceneName.home,
            num: 0,
          },
          sceneName: EAccountSelectorSceneName.swap,
          num: 0,
        })
      ).outcome;
    });

    expect(outcome).toBe('noop');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(
      homeCommitUpdatedAt,
    );
  });

  it('skips the equal-value initial home sync against an inflated legacy cached revision', async () => {
    // Migration seam: builds before the revision fix let the swap listener
    // (syncSwapSelectedAccountFromHome) mint Date.now() at sync-completion
    // time as its commit revision - AHEAD of the smaller home commit revision
    // that produced the very same selection - and persisted that inflated
    // value into the cold-start cache. After upgrading, the restored swap
    // slot outranks the initial re-sync of the identical selection, which
    // must converge as skip-older-event and touch nothing: the data already
    // matches, so the one skip is harmless. The verdict fires before the
    // builder runs, so the equal value still reports skip-older-event, not
    // noop; a change that reorders the guards or rewrites the slot or its
    // revision here makes this test fail.
    const inflatedCachedRevision = 5000;
    const homeRealRevision = 3000;

    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    // Equivalent of restoring a legacy persisted slot from the cold-start
    // cache: the selection and its self-minted revision land as atom values.
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--0'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: true,
        updatedAt: inflatedCachedRevision,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          eventUpdatedAt: homeRealRevision,
          num: 0,
          reason: 'syncSwapSelectedAccountFromHome',
          updateMeta: {
            eventEmitDisabled: true,
            updatedAt: homeRealRevision,
          },
          // The same selection the cached slot already holds.
          builder: () => createHdSelectedAccount('hd-1--0'),
        })
      ).outcome;
    });

    expect(outcome).toBe('skip-older-event');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--0',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(
      inflatedCachedRevision,
    );
  });

  it('lets a later real home change outrank an inflated legacy cached revision', async () => {
    // The key invariant behind the harmless skip above: a legacy inflated
    // revision may cost at most that one equal-value skip - it must never
    // suppress a FUTURE legitimate home change. A switch that happens after
    // the cached Date.now() carries an even larger revision and must land,
    // value and revision both. If a commit ever re-minted a receive-time
    // revision (pushing the committed value permanently ahead of real
    // events), swap would stay pinned to the stale selection and this fails.
    const inflatedCachedRevision = 5000;

    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--0'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: true,
        updatedAt: inflatedCachedRevision,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const syncFromHome = (indexedAccountId: string, eventUpdatedAt: number) =>
      result.current.updateSelectedAccount({
        eventUpdatedAt,
        num: 0,
        reason: 'syncSwapSelectedAccountFromHome',
        updateMeta: {
          eventEmitDisabled: true,
          updatedAt: eventUpdatedAt,
        },
        builder: () => createHdSelectedAccount(indexedAccountId),
      });

    await act(async () => {
      // The one equal-value skip paid for the inflated cache entry.
      expect((await syncFromHome('hd-1--0', 3000)).outcome).toBe(
        'skip-older-event',
      );
      // A real home switch afterwards: newer than the inflated revision, so
      // it must not be dropped.
      expect((await syncFromHome('hd-1--1', 6000)).outcome).toBe('commit');
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(6000);
  });

  it('commits the snapshot-path sync unconditionally when the home store is unavailable', async () => {
    // When the home store does not exist in this runtime,
    // syncSwapSelectedAccountFromLatestHome can only read the simpleDb
    // snapshot and passes eventUpdatedAt: undefined - the local-caller
    // contract: apply unconditionally and mint a fresh monotonic revision,
    // even over an inflated legacy cached revision. Demoting undefined to
    // the null fill-only semantics (or to any compare-if-newer number below
    // the cache) would skip this initial sync and leave swap out of step
    // with home after a cold start into the swap tab - then this test fails.
    const inflatedCachedRevision = 5000;

    const { store, Wrapper } = createWrapper(EAccountSelectorSceneName.swap);
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--0'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: true,
        updatedAt: inflatedCachedRevision,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.updateSelectedAccount({
          eventUpdatedAt: undefined,
          num: 0,
          reason: 'syncSwapSelectedAccountFromLatestHome',
          updateMeta: {
            eventEmitDisabled: true,
            // The snapshot carries no revision (`?? undefined` at the call
            // site), so the commit mints one from the wall clock instead.
            updatedAt: undefined,
          },
          builder: () => createHdSelectedAccount('hd-1--2'),
        })
      ).outcome;
    });

    expect(outcome).toBe('commit');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--2',
    });
    // getNextSelectionUpdatedAt: with no requested revision the commit takes
    // max(Date.now(), committed + 1), always strictly above the old value.
    expect(
      store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt,
    ).toBeGreaterThan(inflatedCachedRevision);
  });

  it('applies a same-scene event from a peer runtime and emits no echo', async () => {
    // Two extension windows on the same scene (popup home vs expanded home)
    // never converged while the same-scene branch skipped unconditionally.
    // A remote same-scene event now applies through compare-if-newer - no
    // home-merge, no sync policy: the event's selection IS the target value.
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--0'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 1000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
    const peerSelection = createHdSelectedAccount('hd-1--1');

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.syncHomeAndSwapSelectedAccount({
          eventPayload: {
            $$isRemoteEvent: true,
            selectedAccount: peerSelection,
            selectedAccountUpdatedAt: 2000,
            sceneName: EAccountSelectorSceneName.home,
            num: 0,
          },
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
        })
      ).outcome;
    });

    expect(outcome).toBe('commit');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    // The source revision is committed verbatim and the echo is disarmed.
    expect(store.get(accountSelectorUpdateMetaAtom())[0]).toMatchObject({
      eventEmitDisabled: true,
      updatedAt: 2000,
    });
    // Same-scene needs no cross-scene policy decision.
    expect(mockShouldSyncHomeAndSwapSelectedAccount).not.toHaveBeenCalled();

    // No ping-pong: the auto-save that follows the applied selection persists
    // it but must not broadcast a new event (eventEmitDisabled came from the
    // sync above).
    await act(async () => {
      await result.current.saveToStorage({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        selectedAccount: peerSelection,
        selectedAccountUpdatedAt: 2000,
        trigger: 'selection-effect',
      });
    });
    expect(mockSaveSelectedAccount).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      expect.anything(),
    );
  });

  it('drops an older same-scene event from a peer runtime', async () => {
    // Last-writer-wins symmetry for the same-scene path: a stale broadcast
    // from the peer window must not roll back a newer local commit.
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--1'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 2000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.syncHomeAndSwapSelectedAccount({
          eventPayload: {
            $$isRemoteEvent: true,
            selectedAccount: createHdSelectedAccount('hd-1--0'),
            selectedAccountUpdatedAt: 1000,
            sceneName: EAccountSelectorSceneName.home,
            num: 0,
          },
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
        })
      ).outcome;
    });

    expect(outcome).toBe('skip-older-event');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });

  it('keeps skipping the local echo of a same-scene event without touching the store', async () => {
    // Every emit fires the local listeners too, and all mirrors of one scene
    // share one jotai store in a runtime - a local echo can carry nothing the
    // store does not already hold, so it skips before the update mutex even
    // when its payload looks different (e.g. a fix-adjusted emitted value).
    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--1'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 2000 },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (
        await result.current.syncHomeAndSwapSelectedAccount({
          eventPayload: {
            selectedAccount: createHdSelectedAccount('hd-1--0'),
            selectedAccountUpdatedAt: 2000,
            sceneName: EAccountSelectorSceneName.home,
            num: 0,
          },
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
        })
      ).outcome;
    });

    expect(outcome).toBe('skip-same-scene');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
    expect(loggerCallPaths).not.toContain(
      'accountSelector.staleDrop.equalRevisionConflictKeptLocal',
    );
  });

  it('applies a newer home-swap event that raced with a concurrent local commit', async () => {
    // The exact-match CAS read its expected revision before the async
    // merge/fix work; a local commit landing during that work made the CAS
    // drop the sync even though the event was NEWER, and nothing retried it.
    // The compare-if-newer verdict is taken inside the update mutex, so the
    // newer event must survive the same race.
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(true);
    const fixDeferred = createDeferred<void>();
    mockFixOthersWalletAccountNetworkPair.mockImplementationOnce(
      async ({ selectedAccount }) => {
        await fixDeferred.promise;
        return selectedAccount;
      },
    );

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), {
      0: createHdSelectedAccount('hd-1--0'),
    });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: {
        eventEmitDisabled: false,
        updatedAt: 500,
      },
    });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    let syncOutcome: string | undefined;
    await act(async () => {
      const syncPromise = result.current.syncHomeAndSwapSelectedAccount({
        eventPayload: {
          selectedAccount: createHdSelectedAccount('hd-1--1'),
          selectedAccountUpdatedAt: 2000,
          sceneName: EAccountSelectorSceneName.swap,
          num: 0,
        },
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      });
      // The sync has read its pre-check revision (500) and is now blocked in
      // the account/network fix; a local commit lands under it.
      await waitFor(() => {
        expect(mockFixOthersWalletAccountNetworkPair).toHaveBeenCalled();
      });
      await result.current.updateSelectedAccount({
        num: 0,
        reason: 'concurrent-local-commit-test',
        builder: () => createHdSelectedAccount('hd-1--2'),
        updateMeta: { eventEmitDisabled: false, updatedAt: 1500 },
      });
      fixDeferred.resolve(undefined);
      syncOutcome = (await syncPromise).outcome;
    });

    expect(syncOutcome).toBe('commit');
    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      indexedAccountId: 'hd-1--1',
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
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

  it('clears a removed account in addressInput without selecting a fallback', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--1');
    mockGetIndexedAccountSafe.mockResolvedValue(undefined);
    const staleActiveAccount = {
      ...defaultActiveAccountInfo(),
      ready: true,
      wallet: { id: 'hd-1' } as IWallet,
      indexedAccount: {
        id: 'hd-1--1',
        walletId: 'hd-1',
      } as IIndexedAccount,
    };
    const { store, Wrapper } = createWrapper(
      EAccountSelectorSceneName.addressInput,
    );
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(activeAccountsAtom(), { 0: staleActiveAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.addressInput,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeAccount,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toMatchObject({
      focusedWallet: undefined,
      indexedAccountId: undefined,
      othersWalletAccountId: undefined,
      walletId: undefined,
    });
    // The stale active account must be rebuilt from the cleared selection
    // even with perf diagnostics disabled (production wiring).
    expect(mockBuildActiveAccountInfoFromSelectedAccount).toHaveBeenCalledTimes(
      1,
    );
    expect(mockBuildActiveAccountInfoFromSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedAccount: expect.objectContaining({
          indexedAccountId: undefined,
          othersWalletAccountId: undefined,
          walletId: undefined,
        }),
      }),
    );
    expect(store.get(activeAccountsAtom())[0]).toMatchObject({
      account: undefined,
      indexedAccount: undefined,
      ready: true,
      wallet: undefined,
    });
    expect(mockGetAllHdHwQrWallets).not.toHaveBeenCalled();
  });

  it('keeps an existing account in addressInput after an unrelated removal', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--1');
    const { store, Wrapper } = createWrapper(
      EAccountSelectorSceneName.addressInput,
    );
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.addressInput,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeAccount,
      });
    });

    expect(store.get(selectedAccountsAtom())[0]).toEqual(selectedAccount);
    expect(mockGetAllHdHwQrWallets).not.toHaveBeenCalled();
  });

  it('does not clear an others account when the existence lookup fails transiently', async () => {
    const selectedAccount: ISelectedAccount = {
      ...defaultSelectedAccount(),
      focusedWallet: 'imported-1',
      networkId: 'tron--0x2b6653dc',
      othersWalletAccountId: 'imported--tron--account-1',
      walletId: 'imported-1',
    };
    mockGetDBAccountSafe.mockRejectedValueOnce(
      new OneKeyLocalError('db temporarily unavailable'),
    );
    const { store, Wrapper } = createWrapper(
      EAccountSelectorSceneName.addressInput,
    );
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.autoSelectNextAccount({
          num: 0,
          sceneName: EAccountSelectorSceneName.addressInput,
          triggerBy: EAccountSelectorAutoSelectTriggerBy.removeAccount,
        }),
      ).rejects.toThrow('db temporarily unavailable');
    });

    expect(store.get(selectedAccountsAtom())[0]).toEqual(selectedAccount);
    expect(
      mockBuildActiveAccountInfoFromSelectedAccount,
    ).not.toHaveBeenCalled();
  });

  it('does not clear a newer account selected while removal lookup is pending', async () => {
    const removedSelection = createHdSelectedAccount('hd-1--1');
    const newerSelection = createHdSelectedAccount('hd-2--0');
    newerSelection.walletId = 'hd-2';
    newerSelection.focusedWallet = 'hd-2';
    const lookup = createDeferred<IIndexedAccount | undefined>();
    mockGetIndexedAccountSafe.mockReturnValueOnce(lookup.promise);
    const { store, Wrapper } = createWrapper(
      EAccountSelectorSceneName.addressInput,
    );
    store.set(selectedAccountsAtom(), { 0: removedSelection });
    const { result } = renderHook(() => useAccountSelectorActions().current, {
      wrapper: Wrapper,
    });
    let removalPromise!: ReturnType<
      typeof result.current.autoSelectNextAccount
    >;

    await act(async () => {
      removalPromise = result.current.autoSelectNextAccount({
        num: 0,
        sceneName: EAccountSelectorSceneName.addressInput,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeAccount,
      });
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.updateSelectedAccount({
        num: 0,
        reason: 'user-selected-while-removal-lookup-pending',
        builder: () => newerSelection,
      });
    });
    await act(async () => {
      lookup.resolve(undefined);
      await removalPromise;
    });

    expect(store.get(selectedAccountsAtom())[0]).toEqual(newerSelection);
    expect(
      mockBuildActiveAccountInfoFromSelectedAccount,
    ).not.toHaveBeenCalled();
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

  it('credits a caller settle window instead of waiting again in auto-select', async () => {
    const selectedAccount = createHdSelectedAccount('hd-1--1');
    mockGetWalletSafe.mockResolvedValue(undefined);
    mockIsWalletHasIndexedAccounts.mockResolvedValue(false);

    const { store, Wrapper } = createWrapper();
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorStorageReadyAtom(), true);
    store.set(activeAccountsAtom(), {
      0: {
        ...defaultActiveAccountInfo(),
        network: { id: selectedAccount.networkId } as IServerNetwork,
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
        settledForMs: 600,
        source: 'wallet-update',
      });
    });

    expect(timerUtils.wait).not.toHaveBeenCalled();
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
    expect(mockClearUnavailableSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSelectedAccount: staleSelection,
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

    expect(mockClearUnavailableSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSelectedAccount: staleHomeSelection,
        sceneName: EAccountSelectorSceneName.swap,
        num: 0,
        selectedAccount: expect.objectContaining({
          walletId: undefined,
          focusedWallet: undefined,
          indexedAccountId: undefined,
          othersWalletAccountId: undefined,
          networkId: 'evm--1',
        }),
        shouldSyncWithHomeSource: true,
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

    expect(mockClearUnavailableSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSelectedAccount: standardWalletSelection,
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
    expect(mockClearUnavailableSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSelectedAccount: expect.objectContaining({
          walletId: removedWallet.id,
          indexedAccountId: 'hd-keyless-1--0',
        }),
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

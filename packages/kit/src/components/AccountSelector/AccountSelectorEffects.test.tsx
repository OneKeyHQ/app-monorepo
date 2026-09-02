/** @jest-environment jsdom */

import { act, render, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorJotaiProvider,
  accountSelectorStorageInitDoneAtom,
  accountSelectorStorageReadyAtom,
  accountSelectorUpdateMetaAtom,
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from '../../states/jotai/contexts/accountSelector/atoms';

import { AccountSelectorEffects } from './AccountSelectorEffects';

const mockGetGlobalDeriveType: jest.MockedFunction<
  () => Promise<string | undefined>
> = jest.fn();
const mockShouldUseGlobalDeriveType: jest.MockedFunction<
  () => Promise<boolean>
> = jest.fn();
const mockIsDeriveTypeAvailableForNetwork: jest.MockedFunction<
  () => Promise<boolean>
> = jest.fn();
const mockIsInTransferImportOrBackupRestoreFlow: jest.MockedFunction<
  () => Promise<boolean>
> = jest.fn();
const mockShouldSyncHomeAndSwapSelectedAccount: jest.MockedFunction<
  () => Promise<boolean>
> = jest.fn();
const mockBuildActiveAccountInfoFromSelectedAccount: jest.MockedFunction<
  (params: unknown) => Promise<unknown>
> = jest.fn();
const mockGetDBAccount: jest.MockedFunction<
  (params: unknown) => Promise<unknown>
> = jest.fn();
const mockFixOthersWalletAccountNetworkPair: jest.MockedFunction<
  (params: { selectedAccount: unknown }) => Promise<unknown>
> = jest.fn();
const mockSaveGlobalDeriveType: jest.MockedFunction<() => Promise<void>> =
  jest.fn();
const mockShouldSyncWithHomeSource: jest.MockedFunction<
  () => Promise<boolean>
> = jest.fn();
const mockSimpleDbGetSelectedAccount: jest.MockedFunction<
  () => Promise<unknown>
> = jest.fn();
const mockSimpleDbSaveSelectedAccount: jest.MockedFunction<
  (params: unknown) => Promise<{ persisted: boolean }>
> = jest.fn();

// Import-time surface of actions.tsx, mirrored from actions.test.tsx: these
// modules never run in this test but must not load their real dependencies.
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
    isExtensionBackgroundServiceWorker: false,
    isJest: true,
    isNative: false,
    isWeb: false,
    isWebDappMode: false,
  },
}));

jest.mock('@onekeyhq/shared/src/storage/instance/webColdStartStorage', () => ({
  flushColdStartCacheNow: jest.fn(async () => undefined),
}));

jest.mock('@onekeyhq/shared/src/storage/instance/syncStorageInstance', () => ({
  coldStartCacheStorage: {
    delete: jest.fn(),
    getObject: jest.fn(),
    setObject: jest.fn(),
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/qrHiddenCreateGuideDialog',
  () => ({
    __esModule: true,
    default: jest.fn(),
  }),
);

// The only mocked internal of AccountSelectorEffects: this hook reaches
// usePromiseResult -> useRouteIsFocused -> @react-navigation focus context and
// '@onekeyhq/components' runtime hooks that the repo-wide componentsMock does
// not provide. The auto-select hooks that consume it stay real and are gated
// inert by storageReady=false.
jest.mock('./hooks/useAccountSelectorAvailableNetworks', () => ({
  useAccountSelectorAvailableNetworks: jest.fn(() => ({
    networkIds: [],
    defaultNetworkId: undefined,
  })),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getDBAccount: (params: unknown) => mockGetDBAccount(params),
    },
    serviceAccountSelector: {
      buildActiveAccountInfoFromSelectedAccount: (params: unknown) =>
        mockBuildActiveAccountInfoFromSelectedAccount(params),
      fixOthersWalletAccountNetworkPair: (params: {
        selectedAccount: unknown;
      }) => mockFixOthersWalletAccountNetworkPair(params),
      getGlobalDeriveType: () => mockGetGlobalDeriveType(),
      saveGlobalDeriveType: () => mockSaveGlobalDeriveType(),
      shouldSyncHomeAndSwapSelectedAccount: () =>
        mockShouldSyncHomeAndSwapSelectedAccount(),
      shouldSyncWithHomeSource: () => mockShouldSyncWithHomeSource(),
      shouldUseGlobalDeriveType: () => mockShouldUseGlobalDeriveType(),
    },
    serviceDApp: {
      recordConnectionSelectionIntent: async () => 1,
    },
    serviceNetwork: {
      isDeriveTypeAvailableForNetwork: () =>
        mockIsDeriveTypeAvailableForNetwork(),
    },
    servicePrimeTransfer: {
      isInTransferImportOrBackupRestoreFlow: () =>
        mockIsInTransferImportOrBackupRestoreFlow(),
    },
    simpleDb: {
      accountSelector: {
        getSelectedAccount: () => mockSimpleDbGetSelectedAccount(),
        saveSelectedAccount: (params: unknown) =>
          mockSimpleDbSaveSelectedAccount(params),
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

describe('AccountSelectorEffects cross-num event fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGlobalDeriveType.mockResolvedValue('default');
    mockShouldUseGlobalDeriveType.mockResolvedValue(true);
    mockIsDeriveTypeAvailableForNetwork.mockResolvedValue(true);
    mockIsInTransferImportOrBackupRestoreFlow.mockResolvedValue(false);
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(false);
  });

  it('applies a DAppNetworkUpdate for an unmounted num through the mounted sibling', async () => {
    const sceneName = EAccountSelectorSceneName.home;
    const sceneUrl = '';
    const store = createStore();
    // Not ready on purpose: the DAppNetworkUpdate handler must not depend on
    // storage readiness, while the storage/auto-select side effects stay inert.
    store.set(accountSelectorStorageReadyAtom(), false);
    store.set(selectedAccountsAtom(), { 0: defaultSelectedAccount() });

    render(
      <AccountSelectorJotaiProvider
        store={store}
        config={{ sceneName, sceneUrl }}
      >
        <AccountSelectorEffects num={0} />
      </AccountSelectorJotaiProvider>,
    );
    // Settle mount-time effects before counting selection writes.
    await act(async () => {});

    let selectionWriteCount = 0;
    const unsubscribe = store.sub(selectedAccountsAtom(), () => {
      selectionWriteCount += 1;
    });

    try {
      // Only a num-0 effects instance is mounted (the registry shrink covered
      // in jotaiContextStore.test.ts is what makes this state reachable). The
      // event addressed to num 1 must still land: any mounted instance in the
      // scene acts as the fallback handler for its siblings.
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.DAppNetworkUpdate, {
          networkId: 'evm--1',
          num: 1,
          sceneName,
          sceneUrl,
        });
      });
      await waitFor(() => {
        expect(store.get(selectedAccountsAtom())[1]?.networkId).toBe('evm--1');
      });

      expect(selectionWriteCount).toBe(1);
      expect(store.get(selectedAccountsAtom())[0]?.networkId).toBeUndefined();

      // An event addressed to the mounted num commits exactly once too.
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.DAppNetworkUpdate, {
          networkId: 'evm--1',
          num: 0,
          sceneName,
          sceneUrl,
        });
      });
      await waitFor(() => {
        expect(store.get(selectedAccountsAtom())[0]?.networkId).toBe('evm--1');
      });

      expect(selectionWriteCount).toBe(2);
    } finally {
      unsubscribe();
    }
  });

  it('collapses duplicate handling into a noop when sibling instances share one event', async () => {
    const sceneName = EAccountSelectorSceneName.home;
    const sceneUrl = '';
    const store = createStore();
    store.set(accountSelectorStorageReadyAtom(), false);
    store.set(selectedAccountsAtom(), {
      0: defaultSelectedAccount(),
      1: defaultSelectedAccount(),
    });

    render(
      <AccountSelectorJotaiProvider
        store={store}
        config={{ sceneName, sceneUrl }}
      >
        <AccountSelectorEffects num={0} />
        <AccountSelectorEffects num={1} />
      </AccountSelectorJotaiProvider>,
    );
    await act(async () => {});

    let selectionWriteCount = 0;
    const unsubscribe = store.sub(selectedAccountsAtom(), () => {
      selectionWriteCount += 1;
    });

    try {
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.DAppNetworkUpdate, {
          networkId: 'evm--1',
          num: 1,
          sceneName,
          sceneUrl,
        });
      });
      await waitFor(() => {
        expect(store.get(selectedAccountsAtom())[1]?.networkId).toBe('evm--1');
      });
      // Let the second instance's serialized update finish before counting.
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      // Both mounted instances handled the event; the duplicate application
      // must collapse into an equal-value noop instead of a second atom write.
      expect(selectionWriteCount).toBe(1);
      expect(store.get(selectedAccountsAtom())[0]?.networkId).toBeUndefined();
    } finally {
      unsubscribe();
    }
  });
});

describe('AccountSelectorEffects discover remote event sync', () => {
  const sceneName = EAccountSelectorSceneName.discover;
  const sceneUrl = 'https://dapp.burst-order.test';

  const buildRemoteSelectedAccountUpdate = ({
    indexedAccountId,
    selectedAccountUpdatedAt,
  }: {
    indexedAccountId: string;
    selectedAccountUpdatedAt: number | undefined;
  }) => ({
    // Simulates the ext background bridge: a real remote payload keeps this
    // flag only when re-emitted with isRemote, so emitToSelf below is used
    // instead of emit (which strips it from locally originated payloads).
    $$isRemoteEvent: true,
    num: 0,
    sceneName,
    sceneUrl,
    selectedAccount: {
      ...defaultSelectedAccount(),
      walletId: 'hd-1',
      indexedAccountId,
      networkId: 'tron--0x2b6653dc',
      deriveType: 'default' as const,
      focusedWallet: 'hd-1',
    },
    selectedAccountUpdatedAt,
  });

  const mountDiscoverEffects = () => {
    const store = createStore();
    store.set(accountSelectorStorageReadyAtom(), false);
    store.set(selectedAccountsAtom(), { 0: defaultSelectedAccount() });
    render(
      <AccountSelectorJotaiProvider
        store={store}
        config={{ sceneName, sceneUrl }}
      >
        <AccountSelectorEffects num={0} />
      </AccountSelectorJotaiProvider>,
    );
    return store;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGlobalDeriveType.mockResolvedValue('default');
    mockShouldUseGlobalDeriveType.mockResolvedValue(true);
    mockIsDeriveTypeAvailableForNetwork.mockResolvedValue(true);
    mockIsInTransferImportOrBackupRestoreFlow.mockResolvedValue(false);
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(false);
  });

  it('converges a remote event burst arriving in emit order on the newest revision', async () => {
    // The core race of the compare-if-newer fix: two rapid switches on the
    // peer runtime, both handlers read the pre-mutex revision before either
    // commits. The exact-match CAS dropped whichever event entered the update
    // mutex second - here the NEWER one - and nothing retried it, leaving
    // this runtime on the older selection until the next event.
    const store = mountDiscoverEffects();
    await act(async () => {});

    await act(async () => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteSelectedAccountUpdate({
          indexedAccountId: 'hd-1--0',
          selectedAccountUpdatedAt: 1000,
        }),
        isRemote: true,
      });
      // Emitted before the first handler committed, so both handlers hold the
      // same pre-mutex snapshot - the burst shape that broke the CAS.
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteSelectedAccountUpdate({
          indexedAccountId: 'hd-1--1',
          selectedAccountUpdatedAt: 2000,
        }),
        isRemote: true,
      });
    });

    await waitFor(() => {
      expect(store.get(selectedAccountsAtom())[0]?.indexedAccountId).toBe(
        'hd-1--1',
      );
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });

  it('drops the older event of a burst arriving out of emit order', async () => {
    // Reversed arrival: the newer event lands first. Unconditional apply (the
    // pre-guard behavior) would let the older trailing event overwrite it with
    // a monotonic-floor-bumped revision; it must be dropped instead.
    const store = mountDiscoverEffects();
    await act(async () => {});

    await act(async () => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteSelectedAccountUpdate({
          indexedAccountId: 'hd-1--1',
          selectedAccountUpdatedAt: 2000,
        }),
        isRemote: true,
      });
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteSelectedAccountUpdate({
          indexedAccountId: 'hd-1--0',
          selectedAccountUpdatedAt: 1000,
        }),
        isRemote: true,
      });
    });

    await waitFor(() => {
      expect(store.get(selectedAccountsAtom())[0]?.indexedAccountId).toBe(
        'hd-1--1',
      );
    });
    // The older event must not have overwritten the committed revision either.
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });

  it('drops a remote event without a revision once a revision is committed', async () => {
    // An unversioned remote event is a cold-start replay of a peer's disk
    // snapshot. It must never overwrite a slot that already holds a committed
    // revision - the legacy always-apply semantics rolled the selection back
    // and (with the receive-time stamp) kept it stuck.
    const store = mountDiscoverEffects();
    await act(async () => {});
    await act(async () => {
      store.set(selectedAccountsAtom(), {
        0: buildRemoteSelectedAccountUpdate({
          indexedAccountId: 'hd-1--1',
          selectedAccountUpdatedAt: 2000,
        }).selectedAccount,
      });
      store.set(accountSelectorUpdateMetaAtom(), {
        0: { eventEmitDisabled: false, updatedAt: 2000 },
      });
    });

    await act(async () => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteSelectedAccountUpdate({
          indexedAccountId: 'hd-1--0',
          selectedAccountUpdatedAt: undefined,
        }),
        isRemote: true,
      });
    });
    // Let the serialized handler chain finish before asserting the negative.
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    expect(store.get(selectedAccountsAtom())[0]?.indexedAccountId).toBe(
      'hd-1--1',
    );
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });

  it('fills a cold slot from an unversioned event and lets a later revision win', async () => {
    // The A1 stuck-rollback regression at the effects layer: the unversioned
    // apply must leave the slot unversioned, so the genuine update emitted at
    // T1 < now still wins afterwards. Restoring the `?? Date.now()` fallback
    // in syncSceneData makes the second event lose and this test fail.
    const store = mountDiscoverEffects();
    await act(async () => {});

    await act(async () => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteSelectedAccountUpdate({
          indexedAccountId: 'hd-1--0',
          selectedAccountUpdatedAt: undefined,
        }),
        isRemote: true,
      });
    });
    await waitFor(() => {
      expect(store.get(selectedAccountsAtom())[0]?.indexedAccountId).toBe(
        'hd-1--0',
      );
    });
    // Applied without minting a revision.
    expect(
      store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt,
    ).toBeUndefined();

    await act(async () => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteSelectedAccountUpdate({
          indexedAccountId: 'hd-1--1',
          selectedAccountUpdatedAt: 1000,
        }),
        isRemote: true,
      });
    });
    await waitFor(() => {
      expect(store.get(selectedAccountsAtom())[0]?.indexedAccountId).toBe(
        'hd-1--1',
      );
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(1000);
  });
});

describe('AccountSelectorEffects same-scene remote event sync', () => {
  const sceneName = EAccountSelectorSceneName.home;

  const buildRemoteHomeSelectedAccountUpdate = ({
    indexedAccountId,
    selectedAccountUpdatedAt,
  }: {
    indexedAccountId: string;
    selectedAccountUpdatedAt: number;
  }) => ({
    $$isRemoteEvent: true,
    num: 0,
    sceneName,
    selectedAccount: {
      ...defaultSelectedAccount(),
      walletId: 'hd-1',
      indexedAccountId,
      networkId: 'tron--0x2b6653dc',
      deriveType: 'default' as const,
      focusedWallet: 'hd-1',
    },
    selectedAccountUpdatedAt,
  });

  const mountHomeEffects = () => {
    const store = createStore();
    store.set(accountSelectorStorageReadyAtom(), false);
    store.set(selectedAccountsAtom(), { 0: defaultSelectedAccount() });
    render(
      <AccountSelectorJotaiProvider store={store} config={{ sceneName }}>
        <AccountSelectorEffects num={0} />
      </AccountSelectorJotaiProvider>,
    );
    return store;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGlobalDeriveType.mockResolvedValue('default');
    mockShouldUseGlobalDeriveType.mockResolvedValue(true);
    mockIsDeriveTypeAvailableForNetwork.mockResolvedValue(true);
    mockIsInTransferImportOrBackupRestoreFlow.mockResolvedValue(false);
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(false);
  });

  it('converges onto a peer runtime event for the very scene this instance renders', async () => {
    // Extension popup and expanded tab both mount the home scene in separate
    // JS runtimes. The same-scene branch used to skip these events outright,
    // so the two windows never converged; now the peer's event applies
    // through compare-if-newer with its source revision, and the committed
    // eventEmitDisabled flag keeps the follow-up auto-save from echoing.
    const store = mountHomeEffects();
    await act(async () => {});
    await act(async () => {
      store.set(accountSelectorUpdateMetaAtom(), {
        0: { eventEmitDisabled: false, updatedAt: 1000 },
      });
    });

    await act(async () => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteHomeSelectedAccountUpdate({
          indexedAccountId: 'hd-1--1',
          selectedAccountUpdatedAt: 2000,
        }),
        isRemote: true,
      });
    });

    await waitFor(() => {
      expect(store.get(selectedAccountsAtom())[0]?.indexedAccountId).toBe(
        'hd-1--1',
      );
    });
    expect(store.get(accountSelectorUpdateMetaAtom())[0]).toMatchObject({
      eventEmitDisabled: true,
      updatedAt: 2000,
    });
  });

  it('keeps a newer local commit against a stale same-scene peer event', async () => {
    const store = mountHomeEffects();
    await act(async () => {});
    await act(async () => {
      store.set(selectedAccountsAtom(), {
        0: buildRemoteHomeSelectedAccountUpdate({
          indexedAccountId: 'hd-1--1',
          selectedAccountUpdatedAt: 2000,
        }).selectedAccount,
      });
      store.set(accountSelectorUpdateMetaAtom(), {
        0: { eventEmitDisabled: false, updatedAt: 2000 },
      });
    });

    await act(async () => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        payload: buildRemoteHomeSelectedAccountUpdate({
          indexedAccountId: 'hd-1--0',
          selectedAccountUpdatedAt: 1000,
        }),
        isRemote: true,
      });
    });
    // Let the serialized handler chain finish before asserting the negative.
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    expect(store.get(selectedAccountsAtom())[0]?.indexedAccountId).toBe(
      'hd-1--1',
    );
    expect(store.get(accountSelectorUpdateMetaAtom())[0]?.updatedAt).toBe(2000);
  });
});

describe('AccountSelectorEffects unmount selection flush', () => {
  const sceneName = EAccountSelectorSceneName.home;

  const buildHdSelectedAccount = () => ({
    ...defaultSelectedAccount(),
    walletId: 'hd-1',
    indexedAccountId: 'hd-1--0',
    networkId: 'tron--0x2b6653dc',
    deriveType: 'default' as const,
    focusedWallet: 'hd-1',
  });

  const mountReadyHomeEffects = () => {
    const store = createStore();
    store.set(accountSelectorStorageReadyAtom(), true);
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(selectedAccountsAtom(), { 0: defaultSelectedAccount() });
    const rendered = render(
      <AccountSelectorJotaiProvider store={store} config={{ sceneName }}>
        <AccountSelectorEffects num={0} />
      </AccountSelectorJotaiProvider>,
    );
    return { store, rendered };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGlobalDeriveType.mockResolvedValue('default');
    mockShouldUseGlobalDeriveType.mockResolvedValue(true);
    mockIsDeriveTypeAvailableForNetwork.mockResolvedValue(true);
    mockIsInTransferImportOrBackupRestoreFlow.mockResolvedValue(false);
    mockShouldSyncHomeAndSwapSelectedAccount.mockResolvedValue(false);
    // ready:false active account keeps the auto-select hooks inert even
    // though storage is ready in these tests.
    mockBuildActiveAccountInfoFromSelectedAccount.mockResolvedValue({
      activeAccount: defaultActiveAccountInfo(),
    });
    mockGetDBAccount.mockResolvedValue(undefined);
    mockFixOthersWalletAccountNetworkPair.mockImplementation(
      async ({ selectedAccount }) => selectedAccount,
    );
    mockSaveGlobalDeriveType.mockResolvedValue(undefined);
    mockShouldSyncWithHomeSource.mockResolvedValue(false);
    mockSimpleDbGetSelectedAccount.mockResolvedValue(undefined);
    mockSimpleDbSaveSelectedAccount.mockResolvedValue({ persisted: true });
  });

  it('waits for this process storage init before auto-saving a warm cached selection', async () => {
    const store = createStore();
    store.set(accountSelectorStorageReadyAtom(), true);
    store.set(accountSelectorStorageInitDoneAtom(), false);
    store.set(selectedAccountsAtom(), { 0: buildHdSelectedAccount() });
    render(
      <AccountSelectorJotaiProvider store={store} config={{ sceneName }}>
        <AccountSelectorEffects num={0} />
      </AccountSelectorJotaiProvider>,
    );
    await act(async () => {});

    expect(mockSimpleDbSaveSelectedAccount).not.toHaveBeenCalled();

    await act(async () => {
      store.set(accountSelectorStorageInitDoneAtom(), true);
    });
    await waitFor(() => {
      expect(mockSimpleDbSaveSelectedAccount).toHaveBeenCalledTimes(1);
    });
  });

  it('retries the same revision after an incompatible pair becomes valid', async () => {
    const selectedAccount = {
      ...defaultSelectedAccount(),
      deriveType: 'default' as const,
      focusedWallet: 'imported',
      networkId: 'evm--1',
      othersWalletAccountId: 'imported--btc',
      walletId: 'imported',
    };
    mockGetDBAccount.mockResolvedValue({
      createAtNetwork: 'btc--0',
      id: selectedAccount.othersWalletAccountId,
      impl: 'btc',
      networks: ['btc--0'],
    });
    const store = createStore();
    store.set(accountSelectorStorageReadyAtom(), true);
    store.set(accountSelectorStorageInitDoneAtom(), true);
    store.set(selectedAccountsAtom(), { 0: selectedAccount });
    store.set(accountSelectorUpdateMetaAtom(), {
      0: { eventEmitDisabled: false, updatedAt: 2000 },
    });
    render(
      <AccountSelectorJotaiProvider store={store} config={{ sceneName }}>
        <AccountSelectorEffects num={0} />
      </AccountSelectorJotaiProvider>,
    );
    await act(async () => {});
    expect(mockSimpleDbSaveSelectedAccount).not.toHaveBeenCalled();

    mockGetDBAccount.mockResolvedValue({
      createAtNetwork: 'evm--1',
      id: selectedAccount.othersWalletAccountId,
      impl: 'evm',
      networks: ['evm--1'],
    });
    await act(async () => {
      store.set(accountSelectorStorageInitDoneAtom(), false);
    });
    await act(async () => {
      store.set(accountSelectorStorageInitDoneAtom(), true);
    });
    await waitFor(() => {
      expect(mockSimpleDbSaveSelectedAccount).toHaveBeenCalledTimes(1);
    });
  });

  it('flushes an unsaved selection exactly once on unmount', async () => {
    // The mirror-shrink window: a sibling writes this num's selection and the
    // registry shrink unmounts the effects instance in the same React batch,
    // so the auto-save effect never runs for the write. The unmount flush must
    // read the store (not a render closure) and persist it exactly once.
    const { store, rendered } = mountReadyHomeEffects();
    await act(async () => {});
    expect(mockSimpleDbSaveSelectedAccount).not.toHaveBeenCalled();

    const selectedAccount = buildHdSelectedAccount();
    await act(async () => {
      store.set(selectedAccountsAtom(), { 0: selectedAccount });
      rendered.unmount();
    });
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    expect(mockSimpleDbSaveSelectedAccount).toHaveBeenCalledTimes(1);
    expect(mockSimpleDbSaveSelectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        num: 0,
        sceneName,
        selectedAccount: expect.objectContaining({
          indexedAccountId: 'hd-1--0',
        }),
        trigger: 'unmount-flush',
      }),
    );
  });

  it('does not flush again when the selection was already auto-saved', async () => {
    const { store, rendered } = mountReadyHomeEffects();
    await act(async () => {});

    const selectedAccount = buildHdSelectedAccount();
    await act(async () => {
      store.set(selectedAccountsAtom(), { 0: selectedAccount });
    });
    await waitFor(() => {
      expect(mockSimpleDbSaveSelectedAccount).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      rendered.unmount();
    });
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    // The unmount flush recognizes the selection as already saved and stays
    // quiet; a second write here would race confirmAccountSelect-style saves.
    expect(mockSimpleDbSaveSelectedAccount).toHaveBeenCalledTimes(1);
  });
});

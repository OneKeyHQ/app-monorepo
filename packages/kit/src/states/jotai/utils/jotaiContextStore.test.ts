/** @jest-environment jsdom */

import type { ReactNode } from 'react';
import { Component, createElement } from 'react';

import { render, waitFor } from '@testing-library/react';
import { type Atom, type WritableAtom, createStore } from 'jotai';

import {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IJotaiContextStoreData,
  IJotaiContextStoreRegistrationUpdate,
  IJotaiContextStoreRegistrationUpdateResult,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiSetAtom } from '@onekeyhq/kit-bg/src/states/jotai/types';
import {
  contextAtomBase,
  contextAtomSnapshotRegistry,
  hydrateContextColdStartCacheForProvider,
  purgeOldColdStartRuntimeKeys,
  writeContextAtomColdStartCacheValues,
} from '@onekeyhq/kit-bg/src/states/jotai/utils';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { normalizeSwapColdStartCacheSnapshot } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  swapAllNetworkTokenListMapAtom,
  swapProSelectTokenAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectedTokensColdStartContextAtom,
  swapTokenMapAtom,
  swapTypeSwitchAtom,
} from '../contexts/swap/atoms';
import {
  SWAP_TOKEN_SELECTOR_SCOPE,
  getSwapTokenSelectorStore,
} from '../contexts/swap/tokenSelectorData';

import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from './jotaiContextStore';
import {
  JotaiContextRootProvidersAutoMount,
  JotaiContextStoreMirrorTracker,
} from './JotaiContextStoreMirrorTracker';
import { useJotaiContextRootStore } from './useJotaiContextRootStore';

const mockUpdateJotaiContextStoreRegistration = jest.fn<
  Promise<IJotaiContextStoreRegistrationUpdateResult>,
  [IJotaiContextStoreRegistrationUpdate]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    updateJotaiContextStoreRegistration: (
      update: IJotaiContextStoreRegistrationUpdate,
    ) => mockUpdateJotaiContextStoreRegistration(update),
  },
}));

jest.mock(
  '../../../components/AccountSelector/AccountSelectorRootProvider',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    // Surfaces the enabledNumStr the real RootProvider would receive; that
    // string is exactly the list of nums it mounts one AccountSelectorEffects
    // instance for.
    return {
      AccountSelectorRootProvider: ({
        enabledNumStr,
      }: {
        enabledNumStr: string;
      }) =>
        React.createElement(
          'div',
          { 'data-testid': 'account-selector-root-provider' },
          enabledNumStr,
        ),
    };
  },
);
jest.mock(
  '../../../views/Discovery/components/DiscoveryBrowserRootProvider',
  () => ({
    DiscoveryBrowserRootProvider: () => null,
  }),
);
jest.mock('../../../views/Earn/EarnProvider', () => ({
  EarnProvider: () => null,
}));
jest.mock(
  '../../../views/Home/components/HomeTokenListProvider/HomeTokenListRootProvider',
  () => ({
    HomeTokenListRootProvider: () => null,
  }),
);
jest.mock(
  '../../../views/Home/components/HomeTokenListProvider/UrlAccountHomeTokenListProvider',
  () => ({
    UrlAccountHomeTokenListProvider: () => null,
  }),
);
jest.mock('../../../views/Market/MarketWatchListProvider', () => ({
  MarketWatchListProvider: () => null,
}));
jest.mock('../../../views/Market/MarketWatchListProviderV2', () => ({
  MarketWatchListProviderV2: () => null,
}));
jest.mock('../../../views/Perp/PerpsProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    PerpsRootProvider: jest.fn(() =>
      React.createElement('div', { 'data-testid': 'perps-root-provider' }),
    ),
  };
});
jest.mock(
  '../../../views/Send/components/SendConfirmProvider/SendConfirmRootProvider',
  () => ({
    SendConfirmRootProvider: () => null,
  }),
);
jest.mock(
  '../../../views/SignatureConfirm/components/SignatureConfirmProvider/SignatureConfirmRootProvider',
  () => ({
    SignatureConfirmRootProvider: () => null,
  }),
);
jest.mock('../../../views/Swap/pages/SwapRootProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    SwapModalRootProvider: jest.fn(() => null),
    SwapRootProvider: jest.fn(() =>
      React.createElement('div', { 'data-testid': 'swap-root-provider' }),
    ),
  };
});
jest.mock(
  '../../../views/UniversalSearch/pages/UniversalSearchProvider',
  () => ({
    UniversalSearchProvider: () => null,
  }),
);

function clearJotaiContextTrackerMap() {
  const map = getJotaiContextTrackerMap();
  Object.keys(map).forEach((key) => {
    delete map[key];
  });
}

type IGlobalColdStartSnapshot = typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
};

class TestErrorBoundary extends Component<
  { children?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    const { children } = this.props;
    const { hasError } = this.state;
    if (hasError) {
      return null;
    }
    return children;
  }
}

function RootStoreConsumer({ data }: { data: IJotaiContextStoreData }) {
  useJotaiContextRootStore(data);
  return null;
}

function ThrowingRootStoreConsumer({
  data,
}: {
  data: IJotaiContextStoreData;
}): ReactNode {
  useJotaiContextRootStore(data);
  throw new OneKeyLocalError('abort root render');
}

const mockReadContextAtomSnapshotRaw = jest.fn<string | undefined, []>();

jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => ({
  readContextAtomSnapshotRaw: () => mockReadContextAtomSnapshotRaw(),
  writeContextAtomSnapshotRaw: () => undefined,
}));

describe('jotaiContextStore reset flow', () => {
  const data = {
    storeName: EJotaiContextStoreNames.swap,
  };
  const storeId = buildJotaiContextStoreId(data);

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(jest.fn());
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
    jest.clearAllMocks();
    mockReadContextAtomSnapshotRaw.mockReset();
    mockUpdateJotaiContextStoreRegistration.mockResolvedValue({
      map: {},
      mapChanged: false,
      registrationCount: 0,
    });
    const globalCache = globalThis as IGlobalColdStartSnapshot;
    delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
    platformEnv.isNative = false;
    platformEnv.isDesktop = false;
    platformEnv.isExtension = false;
    platformEnv.isExtensionUi = false;
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
    purgeOldColdStartRuntimeKeys(
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom,
    );
    purgeOldColdStartRuntimeKeys(
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom,
    );
  });

  afterEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
    const globalCache = globalThis as IGlobalColdStartSnapshot;
    delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
    jest.restoreAllMocks();
  });

  it('keeps the store after root reset is requested until mirror cleanup completes', () => {
    const store = jotaiContextStore.getOrCreateStore(data);

    jotaiContextStore.requestStoreReset(data, store);

    expect(jotaiContextStore.getStore(data)).toBe(store);

    jotaiContextStore.completeStoreResetIfRequestedById(storeId);

    expect(jotaiContextStore.getStore(data)).toBeUndefined();
  });

  it('does not remove the store when a root remount cancels the reset request', () => {
    const store = jotaiContextStore.getOrCreateStore(data);

    jotaiContextStore.requestStoreReset(data, store);
    jotaiContextStore.cancelStoreReset(data, store);
    jotaiContextStore.completeStoreResetIfRequestedById(storeId);

    expect(jotaiContextStore.getStore(data)).toBe(store);
  });

  it('does not cancel a root reset request when a mirror reuses the same store', () => {
    const store = jotaiContextStore.getOrCreateStore(data);

    jotaiContextStore.requestStoreReset(data, store);

    expect(jotaiContextStore.getOrCreateStore(data)).toBe(store);

    jotaiContextStore.completeStoreResetIfRequestedById(storeId);

    expect(jotaiContextStore.getStore(data)).toBeUndefined();
  });

  it('does not cancel a root reset request from an aborted root render', () => {
    const store = jotaiContextStore.getOrCreateStore(data);

    jotaiContextStore.requestStoreReset(data, store);

    render(
      createElement(
        TestErrorBoundary,
        undefined,
        createElement(ThrowingRootStoreConsumer, { data }),
      ),
    );
    jotaiContextStore.completeStoreResetIfRequestedById(storeId);

    expect(jotaiContextStore.getStore(data)).toBeUndefined();
  });

  it('cancels a root reset request after the root mount is committed', () => {
    const store = jotaiContextStore.getOrCreateStore(data);

    jotaiContextStore.requestStoreReset(data, store);

    render(createElement(RootStoreConsumer, { data }));
    jotaiContextStore.completeStoreResetIfRequestedById(storeId);

    expect(jotaiContextStore.getStore(data)).toBe(store);
  });

  it('does not remove a newer store with the same storeId from a stale reset request', () => {
    const oldStore = jotaiContextStore.getOrCreateStore(data);

    jotaiContextStore.requestStoreReset(data, oldStore);
    const newStore = jotaiContextStore.createStore(data);

    jotaiContextStore.completeStoreResetIfRequestedById(storeId);

    expect(jotaiContextStore.getStore(data)).toBe(newStore);
  });

  it('rebuilds account selector mirror metadata when enabled numbers shrink', () => {
    const buildAccountSelectorData = (
      enabledNum: number[],
    ): IJotaiContextStoreData => ({
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
        enabledNum,
      },
    });
    const accountSelectorData = buildAccountSelectorData([0, 1]);
    const accountSelectorStoreId =
      buildJotaiContextStoreId(accountSelectorData);
    const { rerender, unmount } = render(
      createElement(JotaiContextStoreMirrorTracker, accountSelectorData),
    );

    expect(
      getJotaiContextTrackerMap()[accountSelectorStoreId]?.accountSelectorInfo
        ?.enabledNum,
    ).toEqual([0, 1]);

    rerender(
      createElement(
        JotaiContextStoreMirrorTracker,
        buildAccountSelectorData([0]),
      ),
    );

    expect(
      getJotaiContextTrackerMap()[accountSelectorStoreId]?.accountSelectorInfo
        ?.enabledNum,
    ).toEqual([0]);

    unmount();

    expect(getJotaiContextTrackerMap()[accountSelectorStoreId]).toBeUndefined();
  });

  it('removes enabled numbers owned only by an unmounted mirror', () => {
    const buildAccountSelectorData = (
      enabledNum: number[],
    ): IJotaiContextStoreData => ({
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
        enabledNum,
      },
    });
    const num0Data = buildAccountSelectorData([0]);
    const num1Data = buildAccountSelectorData([1]);
    const accountSelectorStoreId = buildJotaiContextStoreId(num0Data);
    const renderTrackers = (showNum1: boolean) =>
      createElement(
        'div',
        undefined,
        createElement(JotaiContextStoreMirrorTracker, {
          ...num0Data,
          key: 'num0',
        }),
        showNum1
          ? createElement(JotaiContextStoreMirrorTracker, {
              ...num1Data,
              key: 'num1',
            })
          : undefined,
      );

    const { rerender, unmount } = render(renderTrackers(true));

    expect(getJotaiContextTrackerMap()[accountSelectorStoreId]).toMatchObject({
      count: 2,
      accountSelectorInfo: { enabledNum: [0, 1] },
    });

    rerender(renderTrackers(false));

    expect(getJotaiContextTrackerMap()[accountSelectorStoreId]).toMatchObject({
      count: 1,
      accountSelectorInfo: { enabledNum: [0] },
    });

    unmount();
    expect(getJotaiContextTrackerMap()[accountSelectorStoreId]).toBeUndefined();
  });

  it('registers extension mirrors through the background-owned registry', async () => {
    platformEnv.isExtension = true;
    platformEnv.isExtensionUi = true;
    mockUpdateJotaiContextStoreRegistration
      .mockResolvedValueOnce({
        map: {},
        mapChanged: true,
        registrationCount: 1,
      })
      .mockResolvedValueOnce({
        map: {},
        mapChanged: true,
        registrationCount: 0,
      });
    const extensionData: IJotaiContextStoreData = {
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: EAccountSelectorSceneName.swap,
        enabledNum: [0, 1],
      },
    };

    const { unmount } = render(
      createElement(JotaiContextStoreMirrorTracker, extensionData),
    );
    await waitFor(() =>
      expect(mockUpdateJotaiContextStoreRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reconcile-runtime',
          registrations: expect.arrayContaining([
            expect.objectContaining({ data: extensionData }),
          ]),
          storeId: buildJotaiContextStoreId(extensionData),
        }),
      ),
    );
    unmount();
    await waitFor(() =>
      expect(mockUpdateJotaiContextStoreRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reconcile-runtime',
          registrations: [],
        }),
      ),
    );
  });

  it('builds queued extension snapshots from the latest registrations', async () => {
    platformEnv.isExtension = true;
    platformEnv.isExtensionUi = true;
    let releaseFirstUpdate:
      | ((result: IJotaiContextStoreRegistrationUpdateResult) => void)
      | undefined;
    const firstUpdate = new Promise<IJotaiContextStoreRegistrationUpdateResult>(
      (resolve) => {
        releaseFirstUpdate = resolve;
      },
    );
    mockUpdateJotaiContextStoreRegistration
      .mockImplementationOnce(() => firstUpdate)
      .mockResolvedValue({
        map: {},
        mapChanged: false,
        registrationCount: 1,
      });
    const buildExtensionData = (enabledNum: number[]) => ({
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: EAccountSelectorSceneName.swap,
        enabledNum,
      },
    });

    const { rerender, unmount } = render(
      createElement(JotaiContextStoreMirrorTracker, buildExtensionData([0])),
    );
    await waitFor(() =>
      expect(mockUpdateJotaiContextStoreRegistration).toHaveBeenCalledTimes(1),
    );

    rerender(
      createElement(JotaiContextStoreMirrorTracker, buildExtensionData([0, 1])),
    );
    releaseFirstUpdate?.({
      map: {},
      mapChanged: true,
      registrationCount: 1,
    });

    await waitFor(() =>
      expect(mockUpdateJotaiContextStoreRegistration).toHaveBeenCalledTimes(3),
    );
    expect(
      mockUpdateJotaiContextStoreRegistration.mock.calls.slice(1, 3),
    ).toEqual([
      [
        expect.objectContaining({
          registrations: [
            expect.objectContaining({
              data: expect.objectContaining({
                accountSelectorInfo: expect.objectContaining({
                  enabledNum: [0, 1],
                }),
              }),
            }),
          ],
        }),
      ],
      [
        expect.objectContaining({
          registrations: [
            expect.objectContaining({
              data: expect.objectContaining({
                accountSelectorInfo: expect.objectContaining({
                  enabledNum: [0, 1],
                }),
              }),
            }),
          ],
        }),
      ],
    ]);

    unmount();
    await waitFor(() =>
      expect(mockUpdateJotaiContextStoreRegistration).toHaveBeenCalledTimes(4),
    );
  });

  it('drops the per-num effects host once no mounted mirror enables that num', async () => {
    // End-to-end over the registry seam: mirrors feed enabledNum refcounts,
    // JotaiContextRootProvidersAutoMount consumes the registry, and the
    // renderer hands AccountSelectorRootProvider the enabledNumStr it mounts
    // one AccountSelectorEffects per num for. A shrink must reach that string.
    const buildAccountSelectorData = (
      enabledNum: number[],
    ): IJotaiContextStoreData => ({
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
        enabledNum,
      },
    });
    const renderTree = (showWideMirror: boolean) =>
      createElement(
        'div',
        undefined,
        createElement(JotaiContextRootProvidersAutoMount),
        createElement(JotaiContextStoreMirrorTracker, {
          ...buildAccountSelectorData([0]),
          key: 'narrow',
        }),
        showWideMirror
          ? createElement(JotaiContextStoreMirrorTracker, {
              ...buildAccountSelectorData([0, 1]),
              key: 'wide',
            })
          : undefined,
      );

    const { queryAllByTestId, rerender } = render(renderTree(true));

    await waitFor(() => {
      const hosts = queryAllByTestId('account-selector-root-provider');
      expect(hosts).toHaveLength(1);
      expect(hosts[0].textContent).toBe('0,1');
    });

    rerender(renderTree(false));

    // num 1 was owned only by the unmounted mirror: its effects host is
    // dropped while num 0, still counted by the remaining mirror, stays.
    await waitFor(() => {
      const hosts = queryAllByTestId('account-selector-root-provider');
      expect(hosts).toHaveLength(1);
      expect(hosts[0].textContent).toBe('0');
    });
  });

  it('does not mount duplicate root providers for active stores already owned by cold-start roots', async () => {
    const globalCache = globalThis as IGlobalColdStartSnapshot;
    globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [`store:${EJotaiContextStoreNames.swap}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom}`]:
        { networkId: 'evm--1' },
      [`store:${EJotaiContextStoreNames.perps}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveTradeInstrumentAtom}`]:
        { coin: 'BTC' },
    };
    platformEnv.isNative = true;

    const swapData: IJotaiContextStoreData = {
      storeName: EJotaiContextStoreNames.swap,
    };
    const perpsData: IJotaiContextStoreData = {
      storeName: EJotaiContextStoreNames.perps,
    };
    const swapStoreId = buildJotaiContextStoreId(swapData);
    const perpsStoreId = buildJotaiContextStoreId(perpsData);
    const { queryAllByTestId } = render(
      createElement(
        'div',
        undefined,
        createElement(JotaiContextRootProvidersAutoMount),
        createElement(JotaiContextStoreMirrorTracker, swapData),
        createElement(JotaiContextStoreMirrorTracker, perpsData),
      ),
    );

    await waitFor(() => {
      expect(getJotaiContextTrackerMap()[swapStoreId]?.count).toBe(1);
      expect(getJotaiContextTrackerMap()[perpsStoreId]?.count).toBe(1);
    });

    await waitFor(() => {
      expect(queryAllByTestId('swap-root-provider')).toHaveLength(1);
      expect(queryAllByTestId('perps-root-provider')).toHaveLength(1);
    });
  });

  it('mounts the perps cold-start root when only the L2 book cache snapshot exists', async () => {
    const globalCache = globalThis as IGlobalColdStartSnapshot;
    globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [`store:${EJotaiContextStoreNames.perps}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsL2BookColdCacheAtom}`]:
        {
          'perpsL2Book:v1:ETH:latest': {
            data: { coin: 'ETH', levels: [[], []], time: 1 },
            updatedAt: 1,
          },
        },
    };
    platformEnv.isNative = true;

    const { queryAllByTestId } = render(
      createElement(JotaiContextRootProvidersAutoMount),
    );

    await waitFor(() => {
      expect(queryAllByTestId('perps-root-provider')).toHaveLength(1);
    });
  });

  it('hydrates the saved Swap Pro token synchronously for the cold-start root', () => {
    const selectedToken = {
      networkId: 'evm--1',
      contractAddress: '0xtoken',
      symbol: 'TOKEN',
      decimals: 18,
      logoURI: 'https://example.com/token.png',
      balanceParsed: '123',
      fiatValue: '456',
      accountAddress: '0xprevious-owner',
    };
    const globalCache = globalThis as IGlobalColdStartSnapshot;
    globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [`store:${EJotaiContextStoreNames.swap}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProSelectTokenAtom}`]:
        selectedToken,
    };
    platformEnv.isNative = true;

    const store = jotaiContextStore.prepareStoreForImmediateUse({
      storeName: EJotaiContextStoreNames.swap,
    });

    expect(store.get(swapProSelectTokenAtom())).toEqual({
      networkId: 'evm--1',
      contractAddress: '0xtoken',
      symbol: 'TOKEN',
      decimals: 18,
      logoURI: 'https://example.com/token.png',
    });
  });

  it('hydrates a late-created provider from durable storage after the boot snapshot is cleared', () => {
    const coldStartCacheKey =
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapBalanceDisplayCacheAtom;
    const originalRegistryEntry =
      contextAtomSnapshotRegistry.get(coldStartCacheKey);
    const coldStartScopeKey = `store:${EJotaiContextStoreNames.swapModal}`;
    const scopedKey = `${coldStartScopeKey}::${coldStartCacheKey}`;
    const cachedValue = {
      version: 1,
      entries: [{ accountAddress: '0xaccount', balance: '1' }],
    };
    const coldStartAtom = contextAtomBase<typeof cachedValue>({
      initialValue: { version: 1, entries: [] },
      coldStartCache: true,
      coldStartCacheKey,
      useColdStartScopeKey: () => coldStartScopeKey,
      useContextAtom: <Value2, Args extends unknown[], Result>(
        _atomInstance: WritableAtom<Value2, Args, Result>,
      ) =>
        [
          cachedValue as Awaited<Value2>,
          jest.fn() as unknown as IJotaiSetAtom<Args, Result>,
        ] as [Awaited<Value2>, IJotaiSetAtom<Args, Result>],
    });
    mockReadContextAtomSnapshotRaw.mockReturnValue(
      JSON.stringify({ [scopedKey]: cachedValue }),
    );

    try {
      const store = jotaiContextStore.prepareStoreForImmediateUse({
        storeName: EJotaiContextStoreNames.swapModal,
      });

      expect(store.get(coldStartAtom.atom())).toEqual(cachedValue);
    } finally {
      if (originalRegistryEntry) {
        contextAtomSnapshotRegistry.set(
          coldStartCacheKey,
          originalRegistryEntry,
        );
      } else {
        contextAtomSnapshotRegistry.delete(coldStartCacheKey);
      }
    }
  });

  describe.each(['desktop', 'web'])(
    '%s partial cold-start snapshot',
    (target) => {
      const scopeKey = `store:${EJotaiContextStoreNames.swapModal}`;
      const selectorKey = `${scopeKey}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`;
      const queryKey = JSON.stringify({ networkId: 'evm--1', keywords: '' });
      const cachedSelector = {
        version: 1,
        updatedAt: 1,
        tokenCatch: {
          [queryKey]: {
            data: [
              {
                networkId: 'evm--1',
                contractAddress: '',
                symbol: 'ETH',
                decimals: 18,
              },
            ],
            updatedAt: 1,
            identityVersion: 0,
            persisted: true,
          },
        },
      };
      const originalWeb = platformEnv.isWeb;

      beforeEach(() => {
        platformEnv.isDesktop = target === 'desktop';
        platformEnv.isWeb = target === 'web';
        mockReadContextAtomSnapshotRaw.mockReturnValue(
          JSON.stringify({ [selectorKey]: cachedSelector }),
        );
      });

      afterEach(() => {
        platformEnv.isWeb = originalWeb;
        purgeOldColdStartRuntimeKeys(selectorKey);
      });

      it('restores a legacy selector snapshot into the shared owner without hydrating form stores', () => {
        (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__ =
          {
            'store:unrelated::ctx:value': { updatedAt: 2 },
          };
        const forms = [
          EJotaiContextStoreNames.swap,
          EJotaiContextStoreNames.swapModal,
          EJotaiContextStoreNames.marketSwap,
          EJotaiContextStoreNames.marketSwapReview,
        ].map((storeName) =>
          jotaiContextStore.prepareStoreForImmediateUse({ storeName }),
        );
        for (const form of forms) {
          expect(form.get(swapTokenMapAtom()).tokenCatch).toBeUndefined();
        }
        const store = getSwapTokenSelectorStore();

        expect(store.get(swapTokenMapAtom())).toEqual(cachedSelector);
        expect(getSwapTokenSelectorStore()).toBe(store);
        forms[0].set(swapTypeSwitchAtom(), ESwapTabSwitchType.BRIDGE);
        expect(forms[1].get(swapTypeSwitchAtom())).toBe(
          ESwapTabSwitchType.SWAP,
        );
        expect(forms[2].get(swapTypeSwitchAtom())).toBe(
          ESwapTabSwitchType.SWAP,
        );
        expect(forms[3].get(swapTypeSwitchAtom())).toBe(
          ESwapTabSwitchType.SWAP,
        );
      });

      it('does not restore execution state removed by owner normalization from the unnormalized disk snapshot', () => {
        const swapScopeKey = `store:${EJotaiContextStoreNames.swap}`;
        const executionKeys = [
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
        ].map((key) => `${swapScopeKey}::${key}`);
        const storedSnapshot = {
          [`store:accountSelector@home::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom}`]:
            {
              0: {
                ready: true,
                wallet: { id: 'current-wallet' },
                indexedAccount: { id: 'current-account' },
                network: { id: 'evm--1' },
              },
            },
          [executionKeys[0]]: { networkId: 'evm--1', symbol: 'ETH' },
          [executionKeys[1]]: { networkId: 'evm--42161', symbol: 'ETH' },
          [executionKeys[2]]: {
            accountKey: 'previous-wallet|previous-account|',
            networkId: 'evm--1',
            swapType: ESwapTabSwitchType.BRIDGE,
            updatedAt: 1,
          },
          [executionKeys[3]]: ESwapTabSwitchType.BRIDGE,
        };
        const normalizedSnapshot = normalizeSwapColdStartCacheSnapshot({
          ...storedSnapshot,
        });
        executionKeys.forEach((key) => {
          expect(Object.hasOwn(normalizedSnapshot, key)).toBe(false);
          purgeOldColdStartRuntimeKeys(key);
        });
        (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__ =
          normalizedSnapshot;
        mockReadContextAtomSnapshotRaw.mockReturnValue(
          JSON.stringify(storedSnapshot),
        );

        try {
          const store = jotaiContextStore.prepareStoreForImmediateUse({
            storeName: EJotaiContextStoreNames.swap,
          });

          expect(store.get(swapSelectFromTokenAtom())).toBeUndefined();
          expect(store.get(swapSelectToTokenAtom())).toBeUndefined();
          expect(
            store.get(swapSelectedTokensColdStartContextAtom()),
          ).toBeUndefined();
          expect(store.get(swapTypeSwitchAtom())).toBe(ESwapTabSwitchType.SWAP);
        } finally {
          executionKeys.forEach((key) => purgeOldColdStartRuntimeKeys(key));
        }
      });

      it('respects an explicitly cleared global entry instead of reviving stored data', () => {
        (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__ =
          {
            [selectorKey]: undefined,
          };
        const store = getSwapTokenSelectorStore();

        expect(store.get(swapTokenMapAtom()).tokenCatch).toEqual({});
      });

      it('prefers a newer global selector value over the stored snapshot', () => {
        const latestSelector = {
          ...cachedSelector,
          updatedAt: 2,
          tokenCatch: {
            [queryKey]: {
              ...cachedSelector.tokenCatch[queryKey],
              data: [],
              updatedAt: 2,
            },
          },
        };
        (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__ =
          {
            [selectorKey]: latestSelector,
          };
        const store = getSwapTokenSelectorStore();

        expect(store.get(swapTokenMapAtom())).toEqual(latestSelector);
      });

      it('restores canonical token and holdings snapshots before any form provider mounts', () => {
        const canonicalSelector = {
          ...cachedSelector,
          updatedAt: 2,
          tokenCatch: {
            [queryKey]: {
              ...cachedSelector.tokenCatch[queryKey],
              data: [],
              updatedAt: 2,
            },
          },
        };
        const holdings = {
          'wallet__account__Swap__USD':
            cachedSelector.tokenCatch[queryKey].data,
        };
        mockReadContextAtomSnapshotRaw.mockReturnValue(
          JSON.stringify({
            [selectorKey]: cachedSelector,
            [`${SWAP_TOKEN_SELECTOR_SCOPE}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`]:
              canonicalSelector,
            [`${SWAP_TOKEN_SELECTOR_SCOPE}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom}`]:
              holdings,
          }),
        );
        const store = getSwapTokenSelectorStore();

        expect(store.get(swapTokenMapAtom())).toEqual(canonicalSelector);
        expect(store.get(swapAllNetworkTokenListMapAtom())).toEqual(holdings);
        expect(
          jotaiContextStore.getStore({
            storeName: EJotaiContextStoreNames.swap,
          }),
        ).toBeUndefined();
        expect(
          jotaiContextStore.getStore({
            storeName: EJotaiContextStoreNames.swapModal,
          }),
        ).toBeUndefined();
      });

      it('does not revive a legacy snapshot when the canonical owner was explicitly cleared', () => {
        (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__ =
          {
            [`${SWAP_TOKEN_SELECTOR_SCOPE}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`]:
              undefined,
          };

        expect(
          getSwapTokenSelectorStore().get(swapTokenMapAtom()).tokenCatch,
        ).toEqual({});
      });

      it.each([true, false])(
        'does not revive a runtime clear when the global snapshot is partial=%s',
        async (partialGlobal) => {
          const globalCache = globalThis as IGlobalColdStartSnapshot;
          if (partialGlobal) {
            globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
              'store:unrelated::ctx:value': { updatedAt: 2 },
            };
          }
          await writeContextAtomColdStartCacheValues({
            entries: [
              {
                coldStartScopeKey: scopeKey,
                coldStartCacheKey:
                  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom,
                value: undefined,
              },
            ],
          });
          expect(
            Object.hasOwn(
              globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ ?? {},
              selectorKey,
            ),
          ).toBe(false);

          const store = getSwapTokenSelectorStore();

          expect(store.get(swapTokenMapAtom()).tokenCatch).toEqual({});
        },
      );
    },
  );

  it.each(['native', 'extension'])(
    'does not add storage fallback for a partial global snapshot on %s',
    (target) => {
      const originalWeb = platformEnv.isWeb;
      platformEnv.isWeb = false;
      platformEnv.isNative = target === 'native';
      platformEnv.isExtension = target === 'extension';
      (globalThis as IGlobalColdStartSnapshot).__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
        'store:unrelated::ctx:value': {},
      };
      try {
        const store = jotaiContextStore.prepareStoreForImmediateUse({
          storeName: EJotaiContextStoreNames.swapModal,
        });

        expect(store.get(swapTokenMapAtom()).tokenCatch).toBeUndefined();
        expect(mockReadContextAtomSnapshotRaw).not.toHaveBeenCalled();
      } finally {
        platformEnv.isWeb = originalWeb;
      }
    },
  );

  it('removes runtime snapshot values when a cold-start atom is cleared through the normal setter path', () => {
    const coldStartScopeKey = 'test:runtime-snapshot';
    const scopedKey = `${coldStartScopeKey}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom}`;
    let currentAtomValue: Record<string, string> | undefined = {
      symbol: 'AAPL',
    };
    const globalCache = globalThis as IGlobalColdStartSnapshot;
    globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [scopedKey]: currentAtomValue,
    };
    const setAtom = jest.fn() as unknown as IJotaiSetAtom<unknown[], unknown>;
    const coldStartAtom = contextAtomBase<Record<string, string> | undefined>({
      initialValue: undefined,
      coldStartCache: true,
      coldStartCacheKey:
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
      useColdStartScopeKey: () => coldStartScopeKey,
      useContextAtom: <Value2, Args extends unknown[], Result>() => [
        currentAtomValue as Awaited<Value2>,
        setAtom as unknown as IJotaiSetAtom<Args, Result>,
      ],
    });
    function ColdStartAtomConsumer() {
      coldStartAtom.use();
      return null;
    }

    const { rerender } = render(createElement(ColdStartAtomConsumer));

    expect(globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__?.[scopedKey]).toEqual({
      symbol: 'AAPL',
    });

    currentAtomValue = undefined;
    rerender(createElement(ColdStartAtomConsumer));

    expect(
      globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__?.[scopedKey],
    ).toBeUndefined();
  });

  it('does not hydrate discover account selector state from generic scoped snapshots', () => {
    const coldStartCacheKey =
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom;
    const originalRegistryEntry =
      contextAtomSnapshotRegistry.get(coldStartCacheKey);
    const coldStartScopeKey = `store:accountSelector@${EAccountSelectorSceneName.discover}--https://1inch.com`;
    const scopedKey = `${coldStartScopeKey}::${coldStartCacheKey}`;
    const initialValue = {
      0: {
        walletId: 'hd-current',
      },
    };
    const staleSnapshotValue = {
      0: {
        walletId: 'hd-stale',
      },
    };
    const globalCache = globalThis as IGlobalColdStartSnapshot;
    globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [scopedKey]: staleSnapshotValue,
    };
    const coldStartAtom = contextAtomBase<typeof initialValue>({
      initialValue,
      coldStartCache: true,
      coldStartCacheKey,
      useColdStartScopeKey: () => coldStartScopeKey,
      useContextAtom: <Value2, Args extends unknown[], Result>(
        _atomInstance: WritableAtom<Value2, Args, Result>,
      ) =>
        [
          initialValue as Awaited<Value2>,
          jest.fn() as unknown as IJotaiSetAtom<Args, Result>,
        ] as [Awaited<Value2>, IJotaiSetAtom<Args, Result>],
    });
    const store = createStore();
    const hydrationStore = {
      get: (atomInstance: unknown) => store.get(atomInstance as Atom<unknown>),
      set: (atomInstance: unknown, value: unknown) => {
        store.set(
          atomInstance as WritableAtom<unknown, [unknown], unknown>,
          value,
        );
      },
    };
    const atomInstance = coldStartAtom.atom();

    try {
      hydrateContextColdStartCacheForProvider({
        store: hydrationStore,
        coldStartScopeKey,
      });

      expect(store.get(atomInstance)).toEqual(initialValue);
    } finally {
      if (originalRegistryEntry) {
        contextAtomSnapshotRegistry.set(
          coldStartCacheKey,
          originalRegistryEntry,
        );
      } else {
        contextAtomSnapshotRegistry.delete(coldStartCacheKey);
      }
    }
  });
});

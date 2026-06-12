/** @jest-environment jsdom */

import type { ReactNode } from 'react';
import { Component, createElement } from 'react';

import { render, waitFor } from '@testing-library/react';

import {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from './jotaiContextStore';
import {
  JotaiContextRootProvidersAutoMount,
  JotaiContextStoreMirrorTracker,
} from './JotaiContextStoreMirrorTracker';
import { useJotaiContextRootStore } from './useJotaiContextRootStore';

jest.mock(
  '../../../components/AccountSelector/AccountSelectorRootProvider',
  () => ({
    AccountSelectorRootProvider: () => null,
  }),
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

describe('jotaiContextStore reset flow', () => {
  const data = {
    storeName: EJotaiContextStoreNames.swap,
  };
  const storeId = buildJotaiContextStoreId(data);

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(jest.fn());
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
    jest.clearAllMocks();
    const globalCache = globalThis as IGlobalColdStartSnapshot;
    delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
    platformEnv.isNative = false;
    platformEnv.isDesktop = false;
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
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

    expect(queryAllByTestId('swap-root-provider')).toHaveLength(1);
    expect(queryAllByTestId('perps-root-provider')).toHaveLength(1);
  });

  it('mounts the perps cold-start root when only the L2 book cache snapshot exists', () => {
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

    expect(queryAllByTestId('perps-root-provider')).toHaveLength(1);
  });
});

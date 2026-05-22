/** @jest-environment jsdom */

import type { ReactNode } from 'react';
import { Component, createElement } from 'react';

import { render } from '@testing-library/react';

import {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  buildJotaiContextStoreId,
  jotaiContextStore,
} from './jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from './JotaiContextStoreMirrorTracker';
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
jest.mock('../../../views/Perp/PerpsProvider', () => ({
  PerpsRootProvider: () => null,
}));
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
jest.mock('../../../views/Swap/pages/SwapRootProvider', () => ({
  SwapModalRootProvider: () => null,
  SwapRootProvider: () => null,
}));
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
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
  });

  afterEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
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
});

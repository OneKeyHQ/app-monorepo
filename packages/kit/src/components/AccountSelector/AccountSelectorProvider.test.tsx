/** @jest-environment jsdom */

import { memo } from 'react';

import { act, render, waitFor } from '@testing-library/react';
import { cloneDeep } from 'lodash';

import { getJotaiContextTrackerMap } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  accountSelectorAvailableNetworksAtom,
  defaultSelectedAccount,
  selectedAccountsAtom,
  useAccountSelectorAvailableNetworksByNum,
  useAccountSelectorContextData,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector/atoms';
import { jotaiContextStore } from '../../states/jotai/utils/jotaiContextStore';

import { AccountSelectorProviderMirror } from './AccountSelectorProvider';

import type {
  IAccountSelectorAvailableNetworks,
  IAccountSelectorAvailableNetworksMap,
} from '../../states/jotai/contexts/accountSelector/atoms';
import type { IJotaiContextStore } from '../../states/jotai/utils/createJotaiContext';

const mockPerfTrace = jest.fn();
let mockPerfDebugEnabled = true;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const loggerProxy: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: (_target, property) =>
      property === 'trace' ? mockPerfTrace : loggerProxy,
  });
  return { defaultLogger: loggerProxy };
});

jest.mock('../../states/jotai/contexts/accountSelector/perfDebug', () => ({
  getActiveAccountPerfCommitMeta: () => undefined,
  getNextAccountSelectorPerfOperationId: () => 1,
  getSelectedAccountPerfCommitMeta: () => ({
    changedFields: ['networkId'],
    num: 0,
    reason: 'test-selection',
    stateUpdatedAt: performance.now() - 5,
    transitionId: 1,
  }),
  isAccountSelectorPerfDebugEnabled: () => mockPerfDebugEnabled,
}));

// AccountSelectorProvider imports JotaiContextStoreMirrorTracker, whose module
// graph reaches JotaiContextRootProviderRenderer and every root provider view.
// None of those views participate in the guard under test, so stub them out
// exactly like jotaiContextStore.test.ts does.
jest.mock('./AccountSelectorRootProvider', () => ({
  AccountSelectorRootProvider: () => null,
}));
jest.mock(
  '../../views/Discovery/components/DiscoveryBrowserRootProvider',
  () => ({
    DiscoveryBrowserRootProvider: () => null,
  }),
);
jest.mock('../../views/Earn/EarnProvider', () => ({
  EarnProvider: () => null,
}));
jest.mock(
  '../../views/Home/components/HomeTokenListProvider/HomeTokenListRootProvider',
  () => ({
    HomeTokenListRootProvider: () => null,
  }),
);
jest.mock(
  '../../views/Home/components/HomeTokenListProvider/UrlAccountHomeTokenListProvider',
  () => ({
    UrlAccountHomeTokenListProvider: () => null,
  }),
);
jest.mock('../../views/Market/MarketWatchListProvider', () => ({
  MarketWatchListProvider: () => null,
}));
jest.mock('../../views/Market/MarketWatchListProviderV2', () => ({
  MarketWatchListProviderV2: () => null,
}));
jest.mock('../../views/Perp/PerpsProvider', () => ({
  PerpsRootProvider: () => null,
}));
jest.mock(
  '../../views/Send/components/SendConfirmProvider/SendConfirmRootProvider',
  () => ({
    SendConfirmRootProvider: () => null,
  }),
);
jest.mock(
  '../../views/SignatureConfirm/components/SignatureConfirmProvider/SignatureConfirmRootProvider',
  () => ({
    SignatureConfirmRootProvider: () => null,
  }),
);
jest.mock('../../views/Swap/pages/SwapRootProvider', () => ({
  SwapModalRootProvider: () => null,
  SwapRootProvider: () => null,
}));
jest.mock('../../views/UniversalSearch/pages/UniversalSearchProvider', () => ({
  UniversalSearchProvider: () => null,
}));

function clearJotaiContextTrackerMap() {
  const map = getJotaiContextTrackerMap();
  Object.keys(map).forEach((key) => {
    delete map[key];
  });
}

describe('AccountSelectorProviderMirror availableNetworksMap init guard', () => {
  beforeEach(() => {
    mockPerfDebugEnabled = true;
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
  });

  afterEach(() => {
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
  });

  it('keeps the atom reference for a deep-equal map and rebroadcasts only real changes', () => {
    let consumerRenderCount = 0;
    let observedAvailableNetworks:
      | IAccountSelectorAvailableNetworks
      | undefined;
    let contextStore: IJotaiContextStore | undefined;
    // memo isolates the counter from provider re-renders: only the atom
    // subscription of useAccountSelectorAvailableNetworksByNum can re-render it.
    const Consumer = memo(function Consumer() {
      consumerRenderCount += 1;
      observedAvailableNetworks = useAccountSelectorAvailableNetworksByNum(0);
      contextStore = useAccountSelectorContextData().store;
      return null;
    });

    function renderMirror(
      availableNetworksMap: IAccountSelectorAvailableNetworksMap,
    ) {
      return (
        <AccountSelectorProviderMirror
          config={{ sceneName: EAccountSelectorSceneName.home }}
          enabledNum={[0]}
          availableNetworksMap={availableNetworksMap}
          waitForStorageReady={false}
        >
          <Consumer />
        </AccountSelectorProviderMirror>
      );
    }

    const initialMap: IAccountSelectorAvailableNetworksMap = {
      0: { networkIds: ['evm--1'] },
    };
    const { rerender } = render(renderMirror(initialMap));

    if (!contextStore) {
      throw new OneKeyLocalError('context store not captured');
    }
    const store = contextStore;
    // The mount effect writes the map: the atom holds that exact reference.
    expect(store.get(accountSelectorAvailableNetworksAtom())).toBe(initialMap);
    expect(observedAvailableNetworks).toEqual({ networkIds: ['evm--1'] });
    const renderCountAfterMount = consumerRenderCount;
    expect(renderCountAfterMount).toBeGreaterThan(0);

    // A NEW object that is deep-equal must be swallowed by the isEqual guard:
    // the atom keeps the identical reference and no consumer re-renders.
    rerender(renderMirror(cloneDeep(initialMap)));

    expect(store.get(accountSelectorAvailableNetworksAtom())).toBe(initialMap);
    expect(consumerRenderCount).toBe(renderCountAfterMount);

    // A genuinely different map must write through and cost the consumer
    // exactly one re-render.
    const changedMap: IAccountSelectorAvailableNetworksMap = {
      0: { networkIds: ['evm--1', 'evm--137'] },
    };
    rerender(renderMirror(changedMap));

    expect(store.get(accountSelectorAvailableNetworksAtom())).toBe(changedMap);
    expect(consumerRenderCount).toBe(renderCountAfterMount + 1);
    expect(observedAvailableNetworks).toEqual({
      networkIds: ['evm--1', 'evm--137'],
    });
  });
});

describe('AccountSelectorProviderMirror paint attribution', () => {
  beforeEach(() => {
    mockPerfDebugEnabled = true;
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
    mockPerfTrace.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
  });

  it('reports selection state-to-paint latency after a tracked provider commit', async () => {
    let contextStore: IJotaiContextStore | undefined;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(performance.now() + 16);
      return 1;
    };

    function Consumer() {
      contextStore = useAccountSelectorContextData().store;
      useSelectedAccount({ num: 0 });
      return null;
    }

    render(
      <AccountSelectorProviderMirror
        config={{ sceneName: EAccountSelectorSceneName.home }}
        enabledNum={[0]}
        perfDebugName="provider-paint-test"
        waitForStorageReady={false}
      >
        <Consumer />
      </AccountSelectorProviderMirror>,
    );

    await waitFor(() => expect(contextStore).toBeDefined());
    await waitFor(() =>
      expect(mockPerfTrace).toHaveBeenCalledWith(
        'providerSubtreeCommit',
        expect.objectContaining({
          initialObservation: true,
          perfDebugName: 'provider-paint-test',
        }),
      ),
    );

    if (!contextStore) {
      throw new OneKeyLocalError('context store not captured');
    }
    const store = contextStore;
    mockPerfTrace.mockClear();

    act(() => {
      store.set(selectedAccountsAtom(), {
        0: { ...defaultSelectedAccount(), networkId: 'evm--1' },
      });
    });

    await waitFor(() =>
      expect(mockPerfTrace).toHaveBeenCalledWith(
        'providerSubtreePaint',
        expect.objectContaining({
          commitToPaintMs: expect.any(Number),
          perfDebugName: 'provider-paint-test',
          stateChanges: expect.arrayContaining([
            expect.objectContaining({
              num: 0,
              selectedChanged: true,
              selectionStateToPaintMs: expect.any(Number),
              selectionTransitionId: 1,
            }),
          ]),
        }),
      ),
    );
  });

  it('keeps the mirror registration mounted when perf attribution changes', async () => {
    let contextStore: IJotaiContextStore | undefined;
    const data = {
      accountSelectorInfo: {
        enabledNum: [0],
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: undefined,
      },
      storeName: EJotaiContextStoreNames.accountSelector,
    };

    function Consumer() {
      contextStore = useAccountSelectorContextData().store;
      return null;
    }

    function renderMirror() {
      return (
        <AccountSelectorProviderMirror
          config={{ sceneName: EAccountSelectorSceneName.home }}
          enabledNum={[0]}
          perfDebugName="provider-toggle-test"
          waitForStorageReady={false}
        >
          <Consumer />
        </AccountSelectorProviderMirror>
      );
    }

    const rendered = render(renderMirror());
    await waitFor(() => expect(contextStore).toBeDefined());
    if (!contextStore) {
      throw new OneKeyLocalError('context store not captured');
    }
    const store = contextStore;
    jotaiContextStore.requestStoreReset(data, store);

    mockPerfDebugEnabled = false;
    rendered.rerender(renderMirror());

    await waitFor(() => expect(jotaiContextStore.getStore(data)).toBe(store));
    expect(jotaiContextStore.storeResetRequests.size).toBe(1);
  });
});

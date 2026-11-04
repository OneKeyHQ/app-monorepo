/** @jest-environment jsdom */

import { memo } from 'react';

import { act, render, waitFor } from '@testing-library/react';
import { cloneDeep } from 'lodash';

import { getJotaiContextTrackerMap } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { devSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorJotaiProvider,
  accountSelectorAvailableNetworksAtom,
  accountSelectorStorageReadyAtom,
  defaultSelectedAccount,
  selectedAccountsAtom,
  useAccountSelectorAvailableNetworksByNum,
  useAccountSelectorContextData,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector/atoms';
import { jotaiContextStore } from '../../states/jotai/utils/jotaiContextStore';

import { AccountSelectorE2EContextProbe } from './AccountSelectorE2EContextProbe';
import { resetAccountSelectorMirrorInspectorForTest } from './AccountSelectorMirrorInspectorObserver';
import { AccountSelectorProviderMirror } from './AccountSelectorProvider';

import type {
  IAccountSelectorAvailableNetworks,
  IAccountSelectorAvailableNetworksMap,
} from '../../states/jotai/contexts/accountSelector/atoms';
import type { IJotaiContextStore } from '../../states/jotai/utils/createJotaiContext';

const mockPerfTrace = jest.fn();
let mockPerfDebugEnabled = true;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/platformEnv')
  >('@onekeyhq/shared/src/platformEnv');
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      isDev: true,
      isE2E: true,
      isProduction: false,
      isWeb: true,
    },
  };
});

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

type IAccountSelectorE2EStateAccessorForTest = {
  getMountedContextReports?: (params: {
    num: number;
    probeName: string;
  }) => Array<{
    contextStatus: string;
    findings: Array<{ field: string; status: string }>;
  }>;
  getMountedContextSnapshots?: (params: {
    num: number;
    probeName: string;
  }) => Array<{
    config: {
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string;
    };
    enabledNum: number[];
    instanceId: number;
    selected?: {
      networkId?: string;
    };
  }>;
};

describe('AccountSelectorProviderMirror E2E context probe', () => {
  beforeEach(() => {
    resetAccountSelectorMirrorInspectorForTest();
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
  });

  afterEach(() => {
    resetAccountSelectorMirrorInspectorForTest();
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    clearJotaiContextTrackerMap();
  });

  it('reports values through the actually mounted React context instance', async () => {
    let contextStore: IJotaiContextStore | undefined;

    function Consumer() {
      contextStore = useAccountSelectorContextData().store;
      return null;
    }

    const { unmount } = render(
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.swap,
          sceneUrl: 'swap-context-probe',
        }}
        e2eContextProbeName="swap-context-probe"
        enabledNum={[0, 1]}
        waitForStorageReady={false}
      >
        <Consumer />
      </AccountSelectorProviderMirror>,
    );

    await waitFor(() => expect(contextStore).toBeDefined());
    if (!contextStore) {
      throw new OneKeyLocalError('context store not captured');
    }
    act(() => {
      contextStore?.set(selectedAccountsAtom(), {
        1: {
          ...defaultSelectedAccount(),
          networkId: 'evm--137',
        },
      });
    });

    const accessor = (
      appGlobals as typeof appGlobals & {
        $$accountSelectorE2EStateAccessor?: IAccountSelectorE2EStateAccessorForTest;
      }
    ).$$accountSelectorE2EStateAccessor;
    await waitFor(() =>
      expect(
        accessor?.getMountedContextSnapshots?.({
          num: 1,
          probeName: 'swap-context-probe',
        }),
      ).toEqual([
        expect.objectContaining({
          config: {
            sceneName: EAccountSelectorSceneName.swap,
            sceneUrl: 'swap-context-probe',
          },
          enabledNum: [0, 1],
          selected: expect.objectContaining({ networkId: 'evm--137' }),
        }),
      ]),
    );

    unmount();
    await waitFor(() =>
      expect(
        accessor?.getMountedContextSnapshots?.({
          num: 1,
          probeName: 'swap-context-probe',
        }),
      ).toEqual([]),
    );
  });

  it('keeps multiple Mirror instances and enabled nums separate', async () => {
    const rendered = render(
      <>
        <AccountSelectorProviderMirror
          config={{ sceneName: EAccountSelectorSceneName.swap }}
          e2eContextProbeName="shared-swap-probe"
          enabledNum={[0]}
          waitForStorageReady={false}
        >
          <div />
        </AccountSelectorProviderMirror>
        <AccountSelectorProviderMirror
          config={{ sceneName: EAccountSelectorSceneName.swap }}
          e2eContextProbeName="shared-swap-probe"
          enabledNum={[0, 1]}
          waitForStorageReady={false}
        >
          <div />
        </AccountSelectorProviderMirror>
      </>,
    );
    const accessor = (
      appGlobals as typeof appGlobals & {
        $$accountSelectorE2EStateAccessor?: IAccountSelectorE2EStateAccessorForTest;
      }
    ).$$accountSelectorE2EStateAccessor;

    await waitFor(() =>
      expect(
        accessor?.getMountedContextSnapshots?.({
          num: 0,
          probeName: 'shared-swap-probe',
        }),
      ).toHaveLength(2),
    );
    const numZeroSnapshots = accessor?.getMountedContextSnapshots?.({
      num: 0,
      probeName: 'shared-swap-probe',
    });
    expect(new Set(numZeroSnapshots?.map((item) => item.instanceId)).size).toBe(
      2,
    );
    expect(numZeroSnapshots?.map((item) => item.enabledNum)).toEqual([
      [0],
      [0, 1],
    ]);
    expect(
      accessor?.getMountedContextSnapshots?.({
        num: 1,
        probeName: 'shared-swap-probe',
      }),
    ).toHaveLength(1);
    rendered.unmount();
  });

  it('reports a Provider wired to the wrong Context store', () => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    try {
      const expectedConfig = { sceneName: EAccountSelectorSceneName.home };
      const expectedStore = jotaiContextStore.getOrCreateStore({
        accountSelectorInfo: {
          enabledNum: [0],
          ...expectedConfig,
        },
        storeName: EJotaiContextStoreNames.accountSelector,
      });
      const wrongConfig = { sceneName: EAccountSelectorSceneName.swap };
      const wrongStore = jotaiContextStore.getOrCreateStore({
        accountSelectorInfo: {
          enabledNum: [0],
          ...wrongConfig,
        },
        storeName: EJotaiContextStoreNames.accountSelector,
      });
      wrongStore.set(accountSelectorStorageReadyAtom(), true);
      const rendered = render(
        <AccountSelectorJotaiProvider config={wrongConfig} store={wrongStore}>
          <AccountSelectorE2EContextProbe
            enabledNum={[0]}
            expectedConfig={expectedConfig}
            expectedStore={expectedStore}
            probeName="wrong-provider-probe"
          />
        </AccountSelectorJotaiProvider>,
      );
      const accessor = (
        appGlobals as typeof appGlobals & {
          $$accountSelectorE2EStateAccessor?: IAccountSelectorE2EStateAccessorForTest;
        }
      ).$$accountSelectorE2EStateAccessor;
      expect(
        accessor?.getMountedContextReports?.({
          num: 0,
          probeName: 'wrong-provider-probe',
        })[0]?.contextStatus,
      ).toBe('pending');

      jest.setSystemTime(3000);
      const report = accessor?.getMountedContextReports?.({
        num: 0,
        probeName: 'wrong-provider-probe',
      })[0];
      expect(report?.contextStatus).toBe('fail');
      expect(report?.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'context.sceneName' }),
          expect.objectContaining({ field: 'context.store' }),
        ]),
      );
      rendered.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('registers in local Web dev only while the Inspector setting is on', async () => {
    const mutablePlatformEnv = platformEnv as typeof platformEnv & {
      isE2E: boolean;
    };
    const originalIsE2E = mutablePlatformEnv.isE2E;
    mutablePlatformEnv.isE2E = false;
    act(() => {
      jotaiDefaultStore.set(devSettingsPersistAtom.atom(), (current) => ({
        ...current,
        enabled: true,
        settings: {
          ...current.settings,
          showAccountSelectorMirrorInspector: false,
        },
      }));
    });
    try {
      const rendered = render(
        <AccountSelectorProviderMirror
          config={{ sceneName: EAccountSelectorSceneName.home }}
          e2eContextProbeName="dev-setting-probe"
          enabledNum={[0]}
          waitForStorageReady={false}
        >
          <div />
        </AccountSelectorProviderMirror>,
      );
      const accessor = (
        appGlobals as typeof appGlobals & {
          $$accountSelectorE2EStateAccessor?: IAccountSelectorE2EStateAccessorForTest;
        }
      ).$$accountSelectorE2EStateAccessor;
      expect(
        accessor?.getMountedContextSnapshots?.({
          num: 0,
          probeName: 'dev-setting-probe',
        }),
      ).toEqual([]);

      act(() => {
        jotaiDefaultStore.set(devSettingsPersistAtom.atom(), (current) => ({
          ...current,
          settings: {
            ...current.settings,
            showAccountSelectorMirrorInspector: true,
          },
        }));
      });
      await waitFor(() =>
        expect(
          accessor?.getMountedContextSnapshots?.({
            num: 0,
            probeName: 'dev-setting-probe',
          }),
        ).toHaveLength(1),
      );

      act(() => {
        jotaiDefaultStore.set(devSettingsPersistAtom.atom(), (current) => ({
          ...current,
          settings: {
            ...current.settings,
            showAccountSelectorMirrorInspector: false,
          },
        }));
      });
      await waitFor(() =>
        expect(
          accessor?.getMountedContextSnapshots?.({
            num: 0,
            probeName: 'dev-setting-probe',
          }),
        ).toEqual([]),
      );
      rendered.unmount();
    } finally {
      mutablePlatformEnv.isE2E = originalIsE2E;
    }
  });

  it('does not mount the E2E probe in a production build', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { unmount } = render(
        <AccountSelectorProviderMirror
          config={{ sceneName: EAccountSelectorSceneName.home }}
          e2eContextProbeName="production-context-probe"
          enabledNum={[0]}
          waitForStorageReady={false}
        >
          <div />
        </AccountSelectorProviderMirror>,
      );
      const accessor = (
        appGlobals as typeof appGlobals & {
          $$accountSelectorE2EStateAccessor?: IAccountSelectorE2EStateAccessorForTest;
        }
      ).$$accountSelectorE2EStateAccessor;
      expect(
        accessor?.getMountedContextSnapshots?.({
          num: 0,
          probeName: 'production-context-probe',
        }),
      ).toEqual([]);
      unmount();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

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

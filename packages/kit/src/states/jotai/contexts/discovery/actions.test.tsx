/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { rootNavigationRef, switchTabAsync } from '@onekeyhq/components';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
import { HandleRebuildBrowserData } from '@onekeyhq/kit/src/views/Discovery/components/HandleData/HandleRebuildBrowserTabData';
import type {
  IBrowserBookmark,
  IWebTab,
} from '@onekeyhq/kit/src/views/Discovery/types';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import { useBrowserAction, useBrowserTabActions } from './actions';
import {
  ProviderJotaiContextDiscovery,
  activeTabIdAtom,
  browserDataReadyAtom,
  browserDataReadyWaiterAtom,
  displayHomePageAtom,
  useActiveTabIdAtom,
  useBrowserDataReadyAtom,
  useDisplayHomePageAtom,
  useWebTabsAtom,
  webTabsAtom,
  webTabsMapAtom,
} from './atoms';

const mockGetBrowserTabsRawData = jest.fn(
  async (): Promise<{ tabs: IWebTab[] }> => ({ tabs: [] }),
);
const mockSetBrowserTabsRawData = jest.fn();
const mockSetBrowserHistoryRawData = jest.fn();
const mockSetBrowserClosedTabsRawData = jest.fn();
const mockCrossWebviewLoadUrl = jest.fn();
const mockFetchDiscoveryHomePageData = jest.fn(async () => ({
  banners: [],
  categories: [],
  trending: [],
}));
const mockGetDiscoveryBookmarkData = jest.fn(
  async (_options?: unknown): Promise<IBrowserBookmark[]> => [],
);
const mockSwrCacheSet = jest.fn<void, [string, unknown]>();

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    message: jest.fn(),
  },
  rootNavigationRef: {
    current: {
      getRootState: jest.fn(),
    },
  },
  switchTabAsync: jest.fn(async () => undefined),
}));

const mockSwitchTabAsync = switchTabAsync as jest.MockedFunction<
  typeof switchTabAsync
>;
const mockRootNavigationRef = rootNavigationRef as typeof rootNavigationRef & {
  current: {
    getRootState: jest.Mock;
  };
};
const mockHandleDeepLinkUrl = handleDeepLinkUrl as jest.MockedFunction<
  typeof handleDeepLinkUrl
>;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isNative: true,
    isNativeAndroid: false,
    isNativeIOS: false,
    isJest: true,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {
    set: (key: string, data: unknown) => {
      mockSwrCacheSet(key, data);
    },
  },
  swrKeys: {
    discoveryHomePageData: () => 'discovery-home-page-data',
    discoveryHomeBookmarks: () => 'discovery-home-bookmarks',
  },
}));

// `actions.ts` registers an AppState 'change' listener at module load to flush
// the debounced tab-persist on background/inactive. jsdom doesn't ship a usable
// AppState, so stub the minimal surface the listener touches.
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// `buildWebTabs` now persists tab snapshots via a lodash debounce wrapper
// (500ms trailing / 2s maxWait). The atom state still updates synchronously,
// but the mocked `setRawData` would fire after the assertions complete and
// observe a stale state. Replace `debounce` with a passthrough so persistence
// stays synchronous within `act()` — every other lodash export is untouched.
//
// WARNING: This mock applies to EVERY test in this file. Any future test
// added here that depends on real `debounce` (trailing/maxWait timing,
// `.flush()` queuing semantics, etc.) must either `jest.unmock('lodash')`
// or override `debounce` per-test — otherwise it will silently misbehave.
jest.mock('lodash', () => {
  const actualLodash = jest.requireActual<Record<string, unknown>>('lodash');
  return {
    ...actualLodash,
    debounce: (fn: (...args: unknown[]) => unknown) => {
      const wrapper = (...args: unknown[]) => fn(...args);
      wrapper.flush = () => undefined;
      wrapper.cancel = () => undefined;
      return wrapper;
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      browserTabs: {
        getRawData: () => mockGetBrowserTabsRawData(),
        setRawData: (payload: unknown) => {
          mockSetBrowserTabsRawData(payload);
        },
      },
      browserHistory: {
        getRawData: jest.fn(async () => ({ data: [] })),
        setRawData: (payload: unknown) => {
          mockSetBrowserHistoryRawData(payload);
        },
      },
      browserBookmarks: {
        getRawData: jest.fn(async () => ({ data: [] })),
      },
      browserClosedTabs: {
        setRawData: (payload: unknown) => {
          mockSetBrowserClosedTabsRawData(payload);
        },
      },
    },
    serviceDiscovery: {
      buildWebsiteIconUrl: jest.fn(async () => ''),
      fetchDiscoveryHomePageData: () => mockFetchDiscoveryHomePageData(),
      getBookmarkData: (options: unknown) =>
        mockGetDiscoveryBookmarkData(options),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/routes/config/deeplink', () => ({
  handleDeepLinkUrl: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    usePromiseResult: (fn: () => unknown) => {
      React.useEffect(() => {
        void fn();
      });
    },
  };
});

jest.mock('@onekeyhq/kit/src/views/Discovery/utils/explorerUtils', () => ({
  browserTypeHandler: 'MultiTabBrowser',
  crossWebviewLoadUrl: (payload: unknown) => {
    mockCrossWebviewLoadUrl(payload);
  },
  injectToPauseWebsocket: '',
  injectToResumeWebsocket: '',
  webviewRefs: {},
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  devSettingsPersistAtom: {
    atom: jest.fn(),
  },
  settingsPersistAtom: {
    atom: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: {
    get: jest.fn(() => ({})),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  clearPendingDiscoveryUrl: jest.fn(),
  openUrlInApp: jest.fn(),
}));

const tabsFixture: IWebTab[] = [
  {
    id: 'tab-1',
    url: 'https://previous.example',
    title: 'Previous',
    isActive: true,
    timestamp: 1,
  },
  {
    id: 'tab-2',
    url: 'https://current.example',
    title: 'Current',
    isActive: false,
    timestamp: 2,
  },
];

function createWrapper({
  tabs: tabsValue = tabsFixture,
  activeTabId = 'tab-1',
  displayHomePage = true,
  browserDataReady = true,
  browserDataReadyWaiter,
}: {
  tabs?: IWebTab[];
  activeTabId?: string | null;
  displayHomePage?: boolean;
  browserDataReady?: boolean;
  browserDataReadyWaiter?: {
    promise: Promise<void>;
    resolve: () => void;
    startedAt: number;
  } | null;
} = {}) {
  const tabs = tabsValue.map((tab) => ({ ...tab }));
  const store = createStore();
  store.set(browserDataReadyAtom(), browserDataReady);
  if (browserDataReadyWaiter !== undefined) {
    store.set(browserDataReadyWaiterAtom(), browserDataReadyWaiter);
  }
  store.set(activeTabIdAtom(), activeTabId);
  store.set(displayHomePageAtom(), displayHomePage);
  store.set(webTabsAtom(), {
    keys: tabs.map((tab) => tab.id),
    tabs,
  });
  store.set(
    webTabsMapAtom(),
    Object.fromEntries(tabs.map((tab) => [tab.id, tab])),
  );

  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextDiscovery store={store}>
        {children}
      </ProviderJotaiContextDiscovery>
    );
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(times = 5) {
  let promise = Promise.resolve();
  for (let i = 0; i < times; i += 1) {
    promise = promise.then(() => undefined);
  }
  await promise;
}

function getBookmarkCacheWrites() {
  return mockSwrCacheSet.mock.calls
    .filter(([key]) => key === 'discovery-home-bookmarks')
    .map(([, data]) => data);
}

function resetPlatformEnvMock() {
  Object.assign(platformEnv, {
    isDesktop: false,
    isNative: true,
    isNativeAndroid: false,
    isNativeIOS: false,
    isJest: true,
  });
}

describe('useBrowserTabActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jotaiDefaultStore.get as jest.Mock).mockReturnValue({});
    resetPlatformEnvMock();
  });

  afterEach(() => {
    resetPlatformEnvMock();
  });

  it('persists active tab flags when switching to an existing tab', () => {
    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [displayHomePage] = useDisplayHomePageAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          displayHomePage,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.activeTabId).toBe('tab-1');
    expect(
      result.current.tabs.find((tab) => tab.id === 'tab-1')?.isActive,
    ).toBe(true);

    act(() => {
      result.current.actions.setCurrentWebTab('tab-2');
    });

    expect(result.current.activeTabId).toBe('tab-2');
    expect(result.current.displayHomePage).toBe(false);
    expect(
      result.current.tabs.find((tab) => tab.id === 'tab-1')?.isActive,
    ).toBe(false);
    expect(
      result.current.tabs.find((tab) => tab.id === 'tab-2')?.isActive,
    ).toBe(true);
    expect(mockSetBrowserTabsRawData).toHaveBeenLastCalledWith({
      tabs: [
        expect.objectContaining({
          id: 'tab-1',
          isActive: false,
        }),
        expect.objectContaining({
          id: 'tab-2',
          isActive: true,
        }),
      ],
    });
  });

  it('keeps a desktop home tab in place when it opens its first page and still allows drag sorting', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });

    const { result } = renderHook(
      () => {
        const tabActions = useBrowserTabActions().current;
        const browserActions = useBrowserAction().current;
        const [webTabs] = useWebTabsAtom();

        return {
          browserActions,
          tabActions,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [
            {
              id: 'tab-1',
              url: 'https://previous.example',
              title: 'Previous',
              timestamp: 100,
            },
            {
              id: 'home-tab',
              url: '',
              title: 'Start Tab',
              timestamp: 200,
              type: 'home',
              isActive: true,
            },
            {
              id: 'tab-2',
              url: 'https://next.example',
              title: 'Next',
              timestamp: 300,
            },
          ],
          activeTabId: 'home-tab',
          displayHomePage: false,
        }),
      },
    );

    await act(async () => {
      await result.current.browserActions.gotoSite({
        id: 'home-tab',
        url: 'https://bookmark.example',
        title: 'Bookmark',
      });
    });

    expect(result.current.tabs.map((tab) => tab.id)).toEqual([
      'tab-1',
      'home-tab',
      'tab-2',
    ]);
    expect(result.current.tabs.find((tab) => tab.id === 'home-tab')).toEqual(
      expect.objectContaining({
        timestamp: 200,
        type: 'normal',
        url: 'https://bookmark.example',
      }),
    );

    act(() => {
      result.current.tabActions.setTabsByIds({
        pinnedTabs: [],
        unpinnedTabs: [
          { id: 'tab-1', timestamp: 100 },
          { id: 'tab-2', timestamp: 300 },
          { id: 'home-tab', timestamp: 302 },
        ],
      });
    });

    expect(result.current.tabs.map((tab) => tab.id)).toEqual([
      'tab-1',
      'tab-2',
      'home-tab',
    ]);
  });

  it('does not activate a new desktop home tab when the current tab is already home', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });

    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [
            {
              id: 'home-tab',
              url: '',
              title: 'Start Tab',
              timestamp: 100,
              type: 'home',
              isActive: true,
            },
          ],
          activeTabId: 'home-tab',
          displayHomePage: false,
        }),
      },
    );

    await act(async () => {
      result.current.actions.addBrowserHomeTab();
      await Promise.resolve();
      await Promise.resolve();
    });

    const homeTabs = result.current.tabs.filter((tab) => tab.type === 'home');
    expect(homeTabs).toHaveLength(2);
    expect(result.current.activeTabId).toBe('home-tab');
    expect(result.current.tabs.find((tab) => tab.id === 'home-tab')).toEqual(
      expect.objectContaining({
        isActive: true,
      }),
    );
    expect(homeTabs.find((tab) => tab.id !== 'home-tab')?.isActive).toBe(false);
    expect(mockFetchDiscoveryHomePageData).toHaveBeenCalledTimes(1);
    expect(mockGetDiscoveryBookmarkData).toHaveBeenCalledWith({
      generateIcon: true,
      sliceCount: 14,
    });
    expect(mockSwrCacheSet).toHaveBeenCalledWith(
      'discovery-home-page-data',
      expect.objectContaining({
        trending: [],
      }),
    );
    expect(mockSwrCacheSet).toHaveBeenCalledWith(
      'discovery-home-bookmarks',
      [],
    );
  });

  it('only writes the latest discovery home bookmarks prefetch to cache', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    const firstPrefetch = createDeferred<IBrowserBookmark[]>();
    const secondPrefetch = createDeferred<IBrowserBookmark[]>();
    mockGetDiscoveryBookmarkData
      .mockImplementationOnce(() => firstPrefetch.promise)
      .mockImplementationOnce(() => secondPrefetch.promise);

    const { result } = renderHook(
      () => ({
        actions: useBrowserTabActions().current,
      }),
      {
        wrapper: createWrapper({
          tabs: [
            {
              id: 'home-tab',
              url: '',
              title: 'Start Tab',
              timestamp: 100,
              type: 'home',
              isActive: true,
            },
          ],
          activeTabId: 'home-tab',
          displayHomePage: false,
        }),
      },
    );

    act(() => {
      result.current.actions.addBrowserHomeTab();
      result.current.actions.addBrowserHomeTab();
    });

    const staleBookmarks = [
      {
        title: 'Stale',
        url: 'https://stale.example',
        logo: undefined,
        sortIndex: 0,
      },
    ];
    await act(async () => {
      firstPrefetch.resolve(staleBookmarks);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getBookmarkCacheWrites()).toEqual([]);

    const latestBookmarks = [
      {
        title: 'Latest',
        url: 'https://latest.example',
        logo: undefined,
        sortIndex: 0,
      },
    ];
    await act(async () => {
      secondPrefetch.resolve(latestBookmarks);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getBookmarkCacheWrites()).toEqual([latestBookmarks]);
  });

  it('does not write bookmark prefetch cache after a bookmark refresh event', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    const bookmarkPrefetch = createDeferred<IBrowserBookmark[]>();
    mockGetDiscoveryBookmarkData.mockImplementationOnce(
      () => bookmarkPrefetch.promise,
    );

    const { result } = renderHook(
      () => ({
        actions: useBrowserTabActions().current,
      }),
      {
        wrapper: createWrapper({
          tabs: [
            {
              id: 'home-tab',
              url: '',
              title: 'Start Tab',
              timestamp: 100,
              type: 'home',
              isActive: true,
            },
          ],
          activeTabId: 'home-tab',
          displayHomePage: false,
        }),
      },
    );

    act(() => {
      result.current.actions.addBrowserHomeTab();
      appEventBus.emit(EAppEventBusNames.RefreshBookmarkList, undefined);
    });

    await act(async () => {
      bookmarkPrefetch.resolve([
        {
          title: 'Stale',
          url: 'https://stale.example',
          logo: undefined,
          sortIndex: 0,
        },
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getBookmarkCacheWrites()).toEqual([]);
  });

  it('does not write bookmark prefetch cache after a bookmark prefetch invalidation event', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    const bookmarkPrefetch = createDeferred<IBrowserBookmark[]>();
    mockGetDiscoveryBookmarkData.mockImplementationOnce(
      () => bookmarkPrefetch.promise,
    );

    const { result } = renderHook(
      () => ({
        actions: useBrowserTabActions().current,
      }),
      {
        wrapper: createWrapper({
          tabs: [
            {
              id: 'home-tab',
              url: '',
              title: 'Start Tab',
              timestamp: 100,
              type: 'home',
              isActive: true,
            },
          ],
          activeTabId: 'home-tab',
          displayHomePage: false,
        }),
      },
    );

    act(() => {
      result.current.actions.addBrowserHomeTab();
      appEventBus.emit(
        EAppEventBusNames.InvalidateDiscoveryHomeBookmarksPrefetch,
        undefined,
      );
    });

    await act(async () => {
      bookmarkPrefetch.resolve([
        {
          title: 'Stale',
          url: 'https://stale.example',
          logo: undefined,
          sortIndex: 0,
        },
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getBookmarkCacheWrites()).toEqual([]);
  });

  it('selects a replacement tab after closing the current tab outside native', () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    jest.useFakeTimers();
    try {
      const { result } = renderHook(
        () => {
          const actions = useBrowserTabActions().current;
          const [activeTabId] = useActiveTabIdAtom();
          const [webTabs] = useWebTabsAtom();

          return {
            actions,
            activeTabId,
            tabs: webTabs.tabs,
          };
        },
        {
          wrapper: createWrapper(),
        },
      );

      act(() => {
        result.current.actions.setCurrentWebTab('tab-2');
      });

      act(() => {
        result.current.actions.closeWebTab({
          tabId: 'tab-2',
          entry: 'Menu',
        });
      });
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.activeTabId).toBe('tab-1');
      expect(result.current.tabs).toEqual([
        expect.objectContaining({
          id: 'tab-1',
          isActive: true,
        }),
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('closes the browser instead of revealing an adjacent tab on native', () => {
    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [displayHomePage] = useDisplayHomePageAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          displayHomePage,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    act(() => {
      result.current.actions.setCurrentWebTab('tab-2');
    });

    act(() => {
      result.current.actions.closeWebTab({
        tabId: 'tab-2',
        entry: 'Menu',
      });
    });

    expect(result.current.activeTabId).toBe('');
    expect(result.current.displayHomePage).toBe(true);
    expect(result.current.tabs).toEqual([
      expect.objectContaining({
        id: 'tab-1',
        isActive: false,
      }),
    ]);
  });

  it('keeps native browser closed when closing an inactive tab without an active tab', () => {
    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [displayHomePage] = useDisplayHomePageAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          displayHomePage,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [
            {
              id: 'tab-1',
              url: 'https://previous.example',
              title: 'Previous',
              isActive: false,
              timestamp: 1,
            },
            {
              id: 'tab-2',
              url: 'https://current.example',
              title: 'Current',
              isActive: true,
              timestamp: 2,
            },
            {
              id: 'tab-3',
              url: 'https://next.example',
              title: 'Next',
              isActive: false,
              timestamp: 3,
            },
          ],
          activeTabId: 'tab-2',
          displayHomePage: false,
        }),
      },
    );

    act(() => {
      result.current.actions.closeWebTab({
        tabId: 'tab-2',
        entry: 'Menu',
      });
    });

    expect(result.current.activeTabId).toBe('');
    expect(result.current.displayHomePage).toBe(true);

    act(() => {
      result.current.actions.closeWebTab({
        tabId: 'tab-1',
        entry: 'Menu',
      });
    });

    expect(result.current.activeTabId).toBe('');
    expect(result.current.displayHomePage).toBe(true);
    expect(result.current.tabs).toEqual([
      expect.objectContaining({
        id: 'tab-3',
        isActive: false,
      }),
    ]);
  });

  it('allows local webview URLs only when the developer setting is enabled', () => {
    const { result } = renderHook(() => useBrowserAction().current, {
      wrapper: createWrapper(),
    });

    [
      'http://localhost:3000',
      'http://127.0.0.1:8888',
      'http://127。0。0。1:8888',
      'https://127.0.0.1:3000/',
      'https://127。0。0。1:3000/',
      'http://10.0.0.1:3000',
      'http://192.168.0.1',
      'http://169.254.169.254/latest/meta-data',
    ].forEach((url) => {
      expect(
        result.current.validateWebviewSrc({
          url,
          isTopFrame: true,
        }),
      ).toBe(EValidateUrlEnum.NotSupportProtocol);
    });

    (jotaiDefaultStore.get as jest.Mock).mockReturnValue({
      enabled: true,
      settings: {
        allowLocalhostUrlInDAppBrowser: true,
      },
    });

    [
      'http://localhost:3000',
      'http://127.0.0.1:8888',
      'http://127。0。0。1:8888',
      'https://127.0.0.1:3000/',
      'https://127。0。0。1:3000/',
      'http://10.0.0.1:3000',
      'http://192.168.0.1',
      'http://169.254.169.254/latest/meta-data',
    ].forEach((url) => {
      expect(
        result.current.validateWebviewSrc({
          url,
          isTopFrame: true,
        }),
      ).toBe(EValidateUrlEnum.Valid);
    });
  });

  it('allows public HTTP IP webview URLs without allowing HTTP domains', () => {
    const { result } = renderHook(() => useBrowserAction().current, {
      wrapper: createWrapper(),
    });

    ['http://6.6.6.6', 'http://6.6.6.6:8080/path'].forEach((url) => {
      expect(
        result.current.validateWebviewSrc({
          url,
          isTopFrame: true,
        }),
      ).toBe(EValidateUrlEnum.Valid);
    });

    expect(
      result.current.validateWebviewSrc({
        url: 'http://example.com',
        isTopFrame: true,
      }),
    ).toBe(EValidateUrlEnum.NotSupportProtocol);
  });

  it('does not reload when native WebView reports an equivalent root URL with a trailing slash', () => {
    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [
            {
              id: 'tab-1',
              url: 'https://app.osmosis.zone',
              title: 'Osmosis',
              isActive: true,
              timestamp: 1,
            },
          ],
          displayHomePage: false,
        }),
      },
    );

    act(() => {
      result.current.actions.onNavigation({
        id: 'tab-1',
        url: 'https://app.osmosis.zone/',
        title: 'Osmosis',
        loading: true,
        canGoBack: false,
        canGoForward: false,
      });
    });

    expect(mockCrossWebviewLoadUrl).not.toHaveBeenCalled();
    expect(result.current.tabs.find((tab) => tab.id === 'tab-1')).toEqual(
      expect.objectContaining({
        url: 'https://app.osmosis.zone',
        displayUrl: 'https://app.osmosis.zone/',
        loading: true,
      }),
    );
  });

  it('does not reload desktop navigation when load validation keeps the current URL', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });

    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [
            {
              id: 'tab-1',
              url: 'https://app.osmosis.zone',
              title: 'Osmosis',
              isActive: true,
              timestamp: 1,
            },
          ],
          displayHomePage: false,
        }),
      },
    );

    await act(async () => {
      result.current.actions.onNavigation({
        id: 'tab-1',
        url: 'https://app.osmosis.zone/',
        title: 'Osmosis',
        loading: true,
        canGoBack: false,
        canGoForward: false,
      });
      await Promise.resolve();
    });

    expect(mockCrossWebviewLoadUrl).not.toHaveBeenCalled();
    expect(result.current.tabs.find((tab) => tab.id === 'tab-1')).toEqual(
      expect.objectContaining({
        url: 'https://app.osmosis.zone',
        displayUrl: 'https://app.osmosis.zone/',
        loading: true,
      }),
    );
  });

  it('treats OneKey referral landing URLs as app routes in the browser', async () => {
    const referralUrl = 'https://app.onekey.so/r/R7EKUT/app/perps';
    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    expect(
      result.current.actions.validateWebviewSrc({
        url: referralUrl,
        isTopFrame: true,
      }),
    ).toBe(EValidateUrlEnum.ValidDeeplink);

    let opened!: boolean | void;
    await act(async () => {
      opened = await result.current.actions.gotoSite({
        id: 'tab-1',
        url: referralUrl,
        title: 'Referral',
      });
    });

    expect(opened).toBe(false);
    expect(mockHandleDeepLinkUrl).toHaveBeenCalledWith({ url: referralUrl });
    expect(mockCrossWebviewLoadUrl).not.toHaveBeenCalled();
    expect(result.current.tabs.find((tab) => tab.id === 'tab-1')).toEqual(
      expect.objectContaining({
        url: 'https://previous.example',
      }),
    );
  });

  it('does not switch to the browser when opening a OneKey referral landing URL', () => {
    const referralUrl = 'https://onekey.so/r/R7EKUT';
    mockRootNavigationRef.current.getRootState.mockReturnValue({
      index: 0,
      routes: [
        {
          name: ERootRoutes.Main,
          state: {
            index: 0,
            routes: [{ name: ETabRoutes.Home }],
          },
        },
      ],
    });

    const { result } = renderHook(() => useBrowserAction().current, {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleOpenWebSite({
        webSite: {
          title: 'Referral',
          url: referralUrl,
          logo: undefined,
          sortIndex: undefined,
        },
      });
    });

    expect(mockHandleDeepLinkUrl).toHaveBeenCalledWith({ url: referralUrl });
    expect(mockSwitchTabAsync).not.toHaveBeenCalled();
  });

  it('keeps blocked localhost gotoSite in the browser so the block page is shown', async () => {
    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    let opened!: boolean | void;
    await act(async () => {
      opened = await result.current.actions.gotoSite({
        id: 'tab-1',
        url: '127。0。0。1:8888',
        title: '127。0。0。1:8888',
      });
    });

    expect(opened).toBe(true);
    expect(
      result.current.tabs.some((tab) => tab.url === 'http://127.0.0.1:8888'),
    ).toBe(true);
    expect(mockCrossWebviewLoadUrl).not.toHaveBeenCalled();
    expect(
      result.current.tabs.some((tab) => tab.url.includes('google.com/search')),
    ).toBe(false);
  });

  it('hydrates browser tab data before opening a desktop search result from cold start', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    mockRootNavigationRef.current.getRootState.mockReturnValue({
      index: 0,
      routes: [
        {
          name: ERootRoutes.Main,
          state: {
            index: 0,
            routes: [{ name: ETabRoutes.Discovery }],
          },
        },
      ],
    });

    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [displayHomePage] = useDisplayHomePageAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          displayHomePage,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [],
          activeTabId: null,
          browserDataReady: false,
        }),
      },
    );
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    await act(async () => {
      result.current.actions.handleOpenWebSite({
        webSite: {
          title: 'Example',
          url: 'https://example.com/',
          logo: undefined,
          sortIndex: undefined,
        },
      });
      await flushMicrotasks(10);
    });

    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);
    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.MultiTabBrowser);
    expect(
      emitSpy.mock.calls.some(
        ([eventName]) =>
          eventName === EAppEventBusNames.ClearSavedBrowserActiveTab,
      ),
    ).toBe(true);
    expect(result.current.displayHomePage).toBe(false);
    expect(
      result.current.tabs.find((tab) => tab.id === result.current.activeTabId),
    ).toEqual(
      expect.objectContaining({
        url: 'https://example.com',
        isActive: true,
      }),
    );
  });

  it('opens a desktop search result when stored browser tabs fail to hydrate', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    mockGetBrowserTabsRawData.mockRejectedValueOnce(new Error('read failed'));
    mockRootNavigationRef.current.getRootState.mockReturnValue({
      index: 0,
      routes: [
        {
          name: ERootRoutes.Main,
          state: {
            index: 0,
            routes: [{ name: ETabRoutes.Discovery }],
          },
        },
      ],
    });

    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [displayHomePage] = useDisplayHomePageAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          displayHomePage,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [],
          activeTabId: null,
          browserDataReady: false,
        }),
      },
    );

    await act(async () => {
      result.current.actions.handleOpenWebSite({
        webSite: {
          title: 'Example',
          url: 'https://example.com/',
          logo: undefined,
          sortIndex: undefined,
        },
      });
      await flushMicrotasks(10);
    });

    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);
    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.MultiTabBrowser);
    expect(result.current.displayHomePage).toBe(false);
    expect(
      result.current.tabs.find((tab) => tab.id === result.current.activeTabId),
    ).toEqual(
      expect.objectContaining({
        url: 'https://example.com',
        isActive: true,
      }),
    );
    expect(
      mockSetBrowserTabsRawData.mock.calls.some(
        ([payload]) => (payload as { tabs: IWebTab[] }).tabs.length === 0,
      ),
    ).toBe(false);
  });

  it('recovers a timed-out desktop browser data waiter before opening a search result', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    mockRootNavigationRef.current.getRootState.mockReturnValue({
      index: 0,
      routes: [
        {
          name: ERootRoutes.Main,
          state: {
            index: 0,
            routes: [{ name: ETabRoutes.Discovery }],
          },
        },
      ],
    });

    const staleReady = createDeferred<void>();
    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [],
          activeTabId: null,
          browserDataReady: false,
          browserDataReadyWaiter: {
            promise: staleReady.promise,
            resolve: () => staleReady.resolve(),
            startedAt: 0,
          },
        }),
      },
    );

    await act(async () => {
      result.current.actions.handleOpenWebSite({
        webSite: {
          title: 'Example',
          url: 'https://example.com/',
          logo: undefined,
          sortIndex: undefined,
        },
      });
      await flushMicrotasks(10);
    });

    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);
    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.MultiTabBrowser);
    expect(
      result.current.tabs.find((tab) => tab.id === result.current.activeTabId),
    ).toEqual(
      expect.objectContaining({
        url: 'https://example.com',
        isActive: true,
      }),
    );
  });

  it('does not let an in-flight ensure hydration overwrite tabs after browser data becomes ready', async () => {
    const activeDappTab: IWebTab = {
      id: 'dapp-tab',
      url: 'https://app.uniswap.org',
      title: 'Uniswap',
      isActive: true,
      timestamp: 10,
    };
    const staleRead = createDeferred<{ tabs: IWebTab[] }>();
    mockGetBrowserTabsRawData.mockReturnValueOnce(staleRead.promise);
    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: tabsFixture,
          activeTabId: 'tab-1',
          browserDataReady: false,
        }),
      },
    );

    let hydrationResultPromise: Promise<boolean> | undefined;
    await act(async () => {
      hydrationResultPromise = result.current.actions.ensureBrowserDataReady();
      await flushMicrotasks(2);
    });
    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.actions.setBrowserDataReady();
      result.current.actions.addWebTab(activeDappTab);
      await flushMicrotasks(5);
    });
    const persistCallsAfterDappOpen =
      mockSetBrowserTabsRawData.mock.calls.length;

    let hydrationResult = false;
    await act(async () => {
      staleRead.resolve({ tabs: tabsFixture });
      hydrationResult = Boolean(await hydrationResultPromise);
      await flushMicrotasks(10);
    });

    expect(hydrationResult).toBe(true);
    expect(mockSetBrowserTabsRawData).toHaveBeenCalledTimes(
      persistCallsAfterDappOpen,
    );
    expect(result.current.activeTabId).toBe(activeDappTab.id);
    expect(result.current.tabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: activeDappTab.id,
          url: activeDappTab.url,
          isActive: true,
        }),
      ]),
    );
  });

  it('treats a stored tabs read failure as empty browser data hydration', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    mockGetBrowserTabsRawData.mockRejectedValueOnce(new Error('read failed'));
    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [browserDataReady] = useBrowserDataReadyAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          browserDataReady,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [],
          activeTabId: null,
          browserDataReady: false,
        }),
      },
    );

    let hydrationResult = false;
    await act(async () => {
      hydrationResult = await result.current.actions.ensureBrowserDataReady();
      await flushMicrotasks(5);
    });

    expect(hydrationResult).toBe(true);
    expect(result.current.browserDataReady).toBe(true);
    expect(result.current.tabs).toEqual([]);
    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);
    expect(mockSetBrowserTabsRawData).not.toHaveBeenCalled();
  });

  it('hydrates stored browser tabs without persisting the stored snapshot', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    mockGetBrowserTabsRawData.mockResolvedValueOnce({ tabs: tabsFixture });
    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [browserDataReady] = useBrowserDataReadyAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          browserDataReady,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [],
          activeTabId: null,
          browserDataReady: false,
        }),
      },
    );

    let hydrationResult = false;
    await act(async () => {
      hydrationResult = await result.current.actions.ensureBrowserDataReady();
      await flushMicrotasks(5);
    });

    expect(hydrationResult).toBe(true);
    expect(result.current.browserDataReady).toBe(true);
    expect(result.current.tabs.map((tab) => tab.id)).toEqual([
      'tab-1',
      'tab-2',
    ]);
    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);
    expect(mockSetBrowserTabsRawData).not.toHaveBeenCalled();
  });

  it('does not overwrite ready browser tabs with a stale stored snapshot when the desktop browser page mounts', async () => {
    const activeDappTab: IWebTab = {
      id: 'dapp-tab',
      url: 'https://app.uniswap.org',
      title: 'Uniswap',
      isActive: true,
      timestamp: 10,
    };
    mockGetBrowserTabsRawData.mockResolvedValueOnce({ tabs: tabsFixture });
    const Wrapper = createWrapper({
      tabs: [activeDappTab],
      activeTabId: activeDappTab.id,
      displayHomePage: false,
      browserDataReady: true,
    });

    render(<HandleRebuildBrowserData />, { wrapper: Wrapper });
    await act(async () => {
      await flushMicrotasks(10);
    });

    const { result } = renderHook(
      () => {
        const [activeTabId] = useActiveTabIdAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          activeTabId,
          tabs: webTabs.tabs,
        };
      },
      { wrapper: Wrapper },
    );

    expect(mockGetBrowserTabsRawData).not.toHaveBeenCalled();
    expect(result.current.activeTabId).toBe(activeDappTab.id);
    expect(result.current.tabs).toEqual([
      expect.objectContaining({
        id: activeDappTab.id,
        url: activeDappTab.url,
        isActive: true,
      }),
    ]);
  });

  it('does not let an in-flight rebuild overwrite tabs after browser data becomes ready', async () => {
    const activeDappTab: IWebTab = {
      id: 'dapp-tab',
      url: 'https://app.uniswap.org',
      title: 'Uniswap',
      isActive: true,
      timestamp: 10,
    };
    const staleRead = createDeferred<{ tabs: IWebTab[] }>();
    mockGetBrowserTabsRawData.mockReturnValueOnce(staleRead.promise);
    const Wrapper = createWrapper({
      tabs: tabsFixture,
      activeTabId: 'tab-1',
      displayHomePage: true,
      browserDataReady: false,
    });

    render(<HandleRebuildBrowserData />, { wrapper: Wrapper });
    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          tabs: webTabs.tabs,
        };
      },
      { wrapper: Wrapper },
    );

    await act(async () => {
      await flushMicrotasks(2);
    });
    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.actions.setBrowserDataReady();
      result.current.actions.addWebTab(activeDappTab);
      await flushMicrotasks(5);
    });
    const persistCallsAfterDappOpen =
      mockSetBrowserTabsRawData.mock.calls.length;

    await act(async () => {
      staleRead.resolve({ tabs: tabsFixture });
      await flushMicrotasks(10);
    });

    expect(mockSetBrowserTabsRawData).toHaveBeenCalledTimes(
      persistCallsAfterDappOpen,
    );
    expect(result.current.activeTabId).toBe(activeDappTab.id);
    expect(result.current.tabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: activeDappTab.id,
          url: activeDappTab.url,
          isActive: true,
        }),
      ]),
    );
  });

  it('hydrates browser tab data before opening a native search result from cold start', async () => {
    mockRootNavigationRef.current.getRootState.mockReturnValue({
      index: 0,
      routes: [
        {
          name: ERootRoutes.Main,
          state: {
            index: 0,
            routes: [{ name: ETabRoutes.Home }],
          },
        },
      ],
    });

    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [displayHomePage] = useDisplayHomePageAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          displayHomePage,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [],
          activeTabId: null,
          browserDataReady: false,
        }),
      },
    );
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    await act(async () => {
      result.current.actions.handleOpenWebSite({
        webSite: {
          title: 'Example',
          url: 'https://example.com/',
          logo: undefined,
          sortIndex: undefined,
        },
      });
      await flushMicrotasks(10);
    });

    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.Discovery);
    expect(
      emitSpy.mock.calls.some(
        ([eventName]) =>
          eventName === EAppEventBusNames.SwitchDiscoveryTabInNative,
      ),
    ).toBe(true);
    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);
    expect(result.current.displayHomePage).toBe(false);
    expect(
      result.current.tabs.find((tab) => tab.id === result.current.activeTabId),
    ).toEqual(
      expect.objectContaining({
        url: 'https://example.com',
        isActive: true,
      }),
    );
  });

  it('opens a native search result when stored browser tabs fail to hydrate', async () => {
    mockGetBrowserTabsRawData.mockRejectedValueOnce(new Error('read failed'));
    mockRootNavigationRef.current.getRootState.mockReturnValue({
      index: 0,
      routes: [
        {
          name: ERootRoutes.Main,
          state: {
            index: 0,
            routes: [{ name: ETabRoutes.Home }],
          },
        },
      ],
    });

    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [displayHomePage] = useDisplayHomePageAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          displayHomePage,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper({
          tabs: [],
          activeTabId: null,
          browserDataReady: false,
        }),
      },
    );
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    await act(async () => {
      result.current.actions.handleOpenWebSite({
        webSite: {
          title: 'Example',
          url: 'https://example.com/',
          logo: undefined,
          sortIndex: undefined,
        },
      });
      await flushMicrotasks(10);
    });

    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.Discovery);
    expect(
      emitSpy.mock.calls.some(
        ([eventName]) =>
          eventName === EAppEventBusNames.SwitchDiscoveryTabInNative,
      ),
    ).toBe(true);
    expect(mockGetBrowserTabsRawData).toHaveBeenCalledTimes(1);
    expect(result.current.displayHomePage).toBe(false);
    expect(
      result.current.tabs.find((tab) => tab.id === result.current.activeTabId),
    ).toEqual(
      expect.objectContaining({
        url: 'https://example.com',
        isActive: true,
      }),
    );
    expect(
      mockSetBrowserTabsRawData.mock.calls.some(
        ([payload]) => (payload as { tabs: IWebTab[] }).tabs.length === 0,
      ),
    ).toBe(false);
  });

  it('creates the desktop destination tab before switching to MultiTabBrowser', async () => {
    Object.assign(platformEnv, {
      isDesktop: true,
      isNative: false,
      isNativeAndroid: false,
      isNativeIOS: false,
    });
    mockRootNavigationRef.current.getRootState.mockReturnValue({
      index: 0,
      routes: [
        {
          name: ERootRoutes.Main,
          state: {
            index: 0,
            routes: [{ name: ETabRoutes.Discovery }],
          },
        },
      ],
    });

    const { result } = renderHook(
      () => {
        const actions = useBrowserAction().current;
        const [activeTabId] = useActiveTabIdAtom();
        const [webTabs] = useWebTabsAtom();

        return {
          actions,
          activeTabId,
          tabs: webTabs.tabs,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    await act(async () => {
      result.current.actions.handleOpenWebSite({
        webSite: {
          title: 'Example',
          url: 'https://example.com/',
          logo: undefined,
          sortIndex: undefined,
        },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const switchOrder = mockSwitchTabAsync.mock.invocationCallOrder[0];
    const activeDestinationTabSaveOrder =
      mockSetBrowserTabsRawData.mock.invocationCallOrder.find(
        (_, callIndex) => {
          const payload = mockSetBrowserTabsRawData.mock.calls[
            callIndex
          ]?.[0] as { tabs?: IWebTab[] } | undefined;
          return payload?.tabs?.some(
            (tab) => tab.url === 'https://example.com' && tab.isActive,
          );
        },
      );

    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.MultiTabBrowser);
    const clearSavedActiveTabOrder = emitSpy.mock.invocationCallOrder.find(
      (_, callIndex) =>
        emitSpy.mock.calls[callIndex]?.[0] ===
        EAppEventBusNames.ClearSavedBrowserActiveTab,
    );
    expect(clearSavedActiveTabOrder).toBeDefined();
    expect(activeDestinationTabSaveOrder).toBeDefined();
    expect(activeDestinationTabSaveOrder).toBeLessThan(switchOrder);
    expect(clearSavedActiveTabOrder).toBeLessThan(switchOrder);
    expect(result.current.activeTabId).not.toBe('tab-1');
    expect(
      result.current.tabs.find((tab) => tab.id === result.current.activeTabId),
    ).toEqual(expect.objectContaining({ url: 'https://example.com' }));
  });
});

/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { rootNavigationRef, switchTabAsync } from '@onekeyhq/components';
import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';
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
  displayHomePageAtom,
  useActiveTabIdAtom,
  useDisplayHomePageAtom,
  useWebTabsAtom,
  webTabsAtom,
} from './atoms';

const mockSetBrowserTabsRawData = jest.fn();
const mockSetBrowserHistoryRawData = jest.fn();
const mockSetBrowserClosedTabsRawData = jest.fn();
const mockCrossWebviewLoadUrl = jest.fn();

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
  const actualLodash = jest.requireActual('lodash') as Record<string, unknown>;
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
    },
  },
}));

jest.mock('@onekeyhq/kit/src/routes/config/deeplink', () => ({
  handleDeepLinkUrl: jest.fn(),
}));

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
}: {
  tabs?: IWebTab[];
  activeTabId?: string;
  displayHomePage?: boolean;
} = {}) {
  const tabs = tabsValue.map((tab) => ({ ...tab }));
  const store = createStore();
  store.set(browserDataReadyAtom(), true);
  store.set(activeTabIdAtom(), activeTabId);
  store.set(displayHomePageAtom(), displayHomePage);
  store.set(webTabsAtom(), {
    keys: tabs.map((tab) => tab.id),
    tabs,
  });

  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextDiscovery store={store}>
        {children}
      </ProviderJotaiContextDiscovery>
    );
  };
}

describe('useBrowserTabActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jotaiDefaultStore.get as jest.Mock).mockReturnValue({});
    Object.assign(platformEnv, {
      isDesktop: false,
      isNative: true,
      isNativeAndroid: false,
      isNativeIOS: false,
      isJest: true,
    });
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

    let opened: boolean | void = undefined;
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

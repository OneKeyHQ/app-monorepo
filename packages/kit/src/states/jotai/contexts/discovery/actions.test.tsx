/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
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
  },
}));

jest.mock('@onekeyhq/kit/src/routes/config/deeplink', () => ({
  handleDeepLinkUrl: jest.fn(),
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

function createWrapper() {
  const tabs = tabsFixture.map((tab) => ({ ...tab }));
  const store = createStore();
  store.set(browserDataReadyAtom(), true);
  store.set(activeTabIdAtom(), 'tab-1');
  store.set(displayHomePageAtom(), true);
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

  it('selects a replacement tab after closing the current tab', () => {
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

    expect(result.current.activeTabId).toBe('tab-1');
    expect(result.current.tabs).toEqual([
      expect.objectContaining({
        id: 'tab-1',
        isActive: true,
      }),
    ]);
  });

  it('allows localhost webview URLs only when the developer setting is enabled', () => {
    const { result } = renderHook(() => useBrowserAction().current, {
      wrapper: createWrapper(),
    });

    expect(
      result.current.validateWebviewSrc({
        url: 'http://localhost:3000',
        isTopFrame: true,
      }),
    ).toBe(EValidateUrlEnum.NotSupportProtocol);

    (jotaiDefaultStore.get as jest.Mock).mockReturnValue({
      enabled: true,
      settings: {
        allowLocalhostUrlInDAppBrowser: true,
      },
    });

    expect(
      result.current.validateWebviewSrc({
        url: 'http://localhost:3000',
        isTopFrame: true,
      }),
    ).toBe(EValidateUrlEnum.Valid);
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
        url: 'http://localhost:3000',
        title: 'http://localhost:3000',
      });
    });

    expect(opened).toBe(true);
    expect(
      result.current.tabs.some((tab) => tab.url === 'http://localhost:3000'),
    ).toBe(true);
    expect(
      result.current.tabs.some((tab) => tab.url.includes('google.com/search')),
    ).toBe(false);
  });
});

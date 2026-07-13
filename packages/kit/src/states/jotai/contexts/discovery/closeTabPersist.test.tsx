/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useBrowserTabActions } from './actions';
import {
  ProviderJotaiContextDiscovery,
  activeTabIdAtom,
  browserDataReadyAtom,
  displayHomePageAtom,
  useWebTabsAtom,
  webTabsAtom,
} from './atoms';

const mockSetBrowserTabsRawData = jest.fn();
const mockSetBrowserHistoryRawData = jest.fn();
const mockSetBrowserClosedTabsRawData = jest.fn();

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

// IMPORTANT: do NOT passthrough-mock lodash here. This test deliberately
// exercises the REAL lodash debounce together with jest fake timers, so it
// reproduces the production timing of the bug: several tab closes in rapid
// succession followed by a hard quit before the trailing debounce can fire.

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      browserTabs: {
        setRawData: (payload: unknown) => {
          mockSetBrowserTabsRawData(payload);
          return Promise.resolve();
        },
      },
      browserHistory: {
        getRawData: jest.fn(async () => ({ data: [] })),
        setRawData: (payload: unknown) => {
          mockSetBrowserHistoryRawData(payload);
          return Promise.resolve();
        },
      },
      browserBookmarks: {
        getRawData: jest.fn(async () => ({ data: [] })),
      },
      browserClosedTabs: {
        setRawData: (payload: unknown) => {
          mockSetBrowserClosedTabsRawData(payload);
          return Promise.resolve();
        },
      },
    },
    serviceDiscovery: {
      buildWebsiteIconUrl: jest.fn(async () => ''),
    },
  },
}));

// `actions.ts` imports `deeplink/index.ts`, which transitively pulls in
// `expo-linking` (ESM, untransformed by jest). Stub it out.
jest.mock('@onekeyhq/kit/src/routes/config/deeplink', () => ({
  handleDeepLinkUrl: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/views/Discovery/utils/explorerUtils', () => ({
  browserTypeHandler: 'MultiTabBrowser',
  crossWebviewLoadUrl: jest.fn(),
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

function makeTab(id: string): IWebTab {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    canGoBack: false,
    loading: false,
    favicon: '',
    timestamp: Number(id.replace(/\D/g, '')) || 1,
  };
}

function createWrapper(tabs: IWebTab[]) {
  const store = createStore();
  store.set(browserDataReadyAtom(), true);
  store.set(activeTabIdAtom(), null);
  store.set(displayHomePageAtom(), false);
  store.set(webTabsAtom(), {
    keys: tabs.map((t) => t.id),
    tabs: tabs.map((t) => ({ ...t })),
  });
  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextDiscovery store={store}>
        {children}
      </ProviderJotaiContextDiscovery>
    );
  };
}

function lastPersistedTabIds(): string[] | null {
  if (mockSetBrowserTabsRawData.mock.calls.length === 0) {
    return null;
  }
  const lastCall =
    mockSetBrowserTabsRawData.mock.calls[
      mockSetBrowserTabsRawData.mock.calls.length - 1
    ];
  return (lastCall[0].tabs as IWebTab[]).map((t) => t.id);
}

describe('closeWebTab immediate persistence (bg cascade fix)', () => {
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
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists the FINAL tab array immediately when tabs are closed rapidly, before the debounce window elapses', () => {
    const { result } = renderHook(
      () => {
        const actions = useBrowserTabActions().current;
        const [webTabs] = useWebTabsAtom();
        return { actions, tabs: webTabs.tabs };
      },
      {
        wrapper: createWrapper([
          makeTab('1'),
          makeTab('2'),
          makeTab('3'),
          makeTab('4'),
        ]),
      },
    );

    // Only observe writes caused by the closes below; the seeded state was set
    // directly on the store (no persist call happened for it).
    mockSetBrowserTabsRawData.mockClear();

    // Rapidly close tabs WITHOUT advancing timers past the debounce window.
    act(() => {
      result.current.actions.closeWebTab({ tabId: '4', entry: 'Menu' });
      result.current.actions.closeWebTab({ tabId: '3', entry: 'Menu' });
      result.current.actions.closeWebTab({ tabId: '2', entry: 'Menu' });
    });

    // The final close must already be persisted immediately. With the old
    // debounced-only behavior, the post-all-closes array would still be sitting
    // in the debounce and `setRawData` would only ever have the leading-edge
    // (stale, larger) snapshot.
    expect(mockSetBrowserTabsRawData).toHaveBeenCalled();
    expect(lastPersistedTabIds()).toEqual(['1']);

    // A stale pending debounced trailing write must NOT later overwrite the
    // immediate snapshot (the `.cancel()` guarantee). Flush all pending timers
    // and re-check the last persisted snapshot is still the final array.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(lastPersistedTabIds()).toEqual(['1']);
  });
});

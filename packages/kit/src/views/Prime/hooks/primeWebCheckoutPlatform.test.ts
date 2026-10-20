/* cspell:ignore Discardable */
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import { openPrimeWebCheckoutPage } from './primeWebCheckoutPlatform';

const mockTabs = new Map<number, chrome.tabs.Tab>();
const mockFocusTab = jest.fn<Promise<boolean>, [number]>(async () => true);
const mockOpenUrlInTab = jest.fn<
  Promise<{ id: number }>,
  [string, { tabId?: number }]
>(async () => ({ id: 77 }));
const mockUpdateContext = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtension: true },
}));
jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  __esModule: true,
  default: {
    getBrowserSessionId: async () => 'browser-1',
    focusTab: (id: number) => mockFocusTab(id),
    openUrlInTab: (url: string, options: { tabId?: number }) =>
      mockOpenUrlInTab(url, options),
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      prime: {
        updateWebCheckoutPendingSessionExtensionContext: (params: unknown) =>
          mockUpdateContext(params),
      },
    },
  },
}));
jest.mock('../purchasesSdk/purchasesSdkWebLoader', () => ({}));
jest.mock('./primePaymentUtils', () => ({ __esModule: true, default: {} }));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {},
}));

function tab(id: number, url?: string): chrome.tabs.Tab {
  return {
    id,
    url,
    index: 0,
    windowId: 3,
    pinned: false,
    highlighted: false,
    active: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
  };
}

const session: IPrimeWebCheckoutPendingSession = {
  checkoutId: 'checkout-1',
  onekeyUserId: 'user-1',
  subscriptionPeriod: 'P1Y',
  packageId: '$rc_annual',
  offeringId: 'Sandbox_testing',
  amount: 99,
  currency: 'USD',
  isSandbox: true,
  platform: 'extension',
  checkoutUrl: 'https://pay.rev.cat/test-link/user-1?package_id=annual',
  startedAt: 1,
  extension: {
    browserSessionId: 'browser-1',
    checkoutTabId: 12,
    initiatorKind: 'tab',
    initiatorTabId: 5,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTabs.clear();
  mockFocusTab.mockResolvedValue(true);
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {},
      tabs: {
        get: (
          id: number,
          callback: (value: chrome.tabs.Tab | undefined) => void,
        ) => callback(mockTabs.get(id)),
        getCurrent: (callback: (value: chrome.tabs.Tab) => void) =>
          callback(tab(5)),
      },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'chrome');
});

it('reopens the recorded checkout by focusing it when tab URL fields are unavailable', async () => {
  mockTabs.set(12, tab(12));

  await expect(openPrimeWebCheckoutPage(session)).resolves.toBe('opened');

  expect(mockFocusTab).toHaveBeenCalledWith(12);
  expect(mockOpenUrlInTab).not.toHaveBeenCalled();
});

it('focuses a visible hosted form without reloading or resetting its payment fields', async () => {
  mockTabs.set(12, tab(12, session.checkoutUrl));

  await openPrimeWebCheckoutPage(session);

  expect(mockFocusTab).toHaveBeenCalledWith(12);
  expect(mockOpenUrlInTab).not.toHaveBeenCalled();
});

it('opens a new checkout without overwriting a tab visibly navigated elsewhere', async () => {
  mockTabs.set(12, tab(12, 'https://example.com/'));

  await openPrimeWebCheckoutPage(session);

  expect(mockFocusTab).not.toHaveBeenCalled();
  expect(mockOpenUrlInTab).toHaveBeenCalledWith(session.checkoutUrl, {
    tabId: undefined,
  });
});

it('opens a new tab if the recorded checkout was closed', async () => {
  await openPrimeWebCheckoutPage(session);

  expect(mockFocusTab).not.toHaveBeenCalled();
  expect(mockOpenUrlInTab).toHaveBeenCalledWith(session.checkoutUrl, {
    tabId: undefined,
  });
});

it('opens a new tab if the recorded checkout disappears while being focused', async () => {
  mockTabs.set(12, tab(12));
  mockFocusTab.mockResolvedValueOnce(false);

  await openPrimeWebCheckoutPage(session);

  expect(mockOpenUrlInTab).toHaveBeenCalledWith(session.checkoutUrl, {
    tabId: undefined,
  });
});

it('does not focus or rewrite a tab ID from a previous browser session', async () => {
  mockTabs.set(12, tab(12));

  await openPrimeWebCheckoutPage({
    ...session,
    extension: {
      ...session.extension,
      initiatorKind: 'tab',
      browserSessionId: 'old-browser',
    },
  });

  expect(mockFocusTab).not.toHaveBeenCalled();
  expect(mockOpenUrlInTab).toHaveBeenCalledWith(session.checkoutUrl, {
    tabId: undefined,
  });
});

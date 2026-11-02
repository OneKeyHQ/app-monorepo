/* cspell:ignore Discardable */
import ServiceApp from '@onekeyhq/kit-bg/src/services/ServiceApp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isPrimeWebCheckoutReturnFromCheckoutTab } from '@onekeyhq/shared/src/prime/primeWebCheckoutReturn';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import { openPrimeWebCheckoutPage } from './primeWebCheckoutPlatform';

const mockTabs = new Map<number, chrome.tabs.Tab>();
const mockSessions = new Map<string, IPrimeWebCheckoutPendingSession>();
const mockFocusTab = jest.fn<Promise<boolean>, [number]>(async () => true);
const mockOpenUrlInTab = jest.fn<
  Promise<chrome.tabs.Tab | undefined>,
  [string, { tabId?: number }]
>();
type IUpdateContext = {
  onekeyUserId: string;
  checkoutId: string;
  extension: NonNullable<IPrimeWebCheckoutPendingSession['extension']>;
};
const mockUpdateContext = jest.fn<Promise<boolean>, [IUpdateContext]>();
const mockGetBrowserSessionId = jest.fn<Promise<string | undefined>, []>(
  async () => 'browser-1',
);
let mockUser = { isLoggedIn: true, onekeyUserId: 'user-1' };
const mockRemoveTab = jest.fn<Promise<void>, [number]>();
let mockBackgroundService: ServiceApp;
let mockNextTabId = 77;
let mockCurrentTabId = 5;

// UI requests share one real background service, while their session snapshots
// remain independent. Only the browser and persistence boundaries are mocked.
jest.mock('@onekeyhq/kit-bg/src/services/ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit-bg/src/dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope', () => ({}));
jest.mock(
  '@onekeyhq/kit-bg/src/migrations/v4ToV5Migration/v4appStorage',
  () => ({ v4appStorage: {} }),
);
jest.mock('@onekeyhq/kit-bg/src/migrations/v4ToV5Migration/v4dbHubs', () => ({
  __esModule: true,
  default: {},
}));
jest.mock(
  '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils',
  () => ({}),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtension: true, isExtensionBackground: true, isJest: true },
}));
jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  __esModule: true,
  default: {
    focusTab: (id: number) => mockFocusTab(id),
    openUrlInTab: (url: string, options: { tabId?: number }) =>
      mockOpenUrlInTab(url, options),
    getBrowserSessionId: () => mockGetBrowserSessionId(),
    removeTab: (id: number) => mockRemoveTab(id),
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      getExtensionBrowserSessionId: () => mockGetBrowserSessionId(),
      openExtensionPrimeWebCheckout: (
        ...args: Parameters<ServiceApp['openExtensionPrimeWebCheckout']>
      ) => mockBackgroundService.openExtensionPrimeWebCheckout(...args),
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

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function saveContext(params: IUpdateContext) {
  const current = mockSessions.get(params.onekeyUserId);
  if (current?.checkoutId !== params.checkoutId) return false;
  mockSessions.set(params.onekeyUserId, {
    ...current,
    extension: params.extension,
  });
  return true;
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
  mockSessions.clear();
  mockSessions.set(session.onekeyUserId, { ...session });
  mockUser = { isLoggedIn: true, onekeyUserId: 'user-1' };
  mockNextTabId = 77;
  mockCurrentTabId = 5;
  platformEnv.isExtensionUiSidePanel = false;
  mockFocusTab.mockResolvedValue(true);
  mockGetBrowserSessionId.mockReset().mockResolvedValue('browser-1');
  mockOpenUrlInTab.mockReset().mockImplementation(async (url, { tabId }) => {
    const id = tabId ?? mockNextTabId;
    if (tabId === undefined) mockNextTabId += 1;
    const created = tab(id, url);
    mockTabs.set(id, created);
    return created;
  });
  mockRemoveTab.mockReset().mockImplementation(async (id) => {
    mockTabs.delete(id);
  });
  mockUpdateContext.mockReset().mockImplementation(saveContext);
  mockBackgroundService = new ServiceApp({
    backgroundApi: {
      simpleDb: {
        prime: {
          getWebCheckoutPendingSession: async ({
            onekeyUserId,
          }: {
            onekeyUserId: string;
          }) => mockSessions.get(onekeyUserId),
          updateWebCheckoutPendingSessionExtensionContext: mockUpdateContext,
        },
      },
      servicePrime: {
        getLocalUserInfo: async () => ({ ...mockUser }),
      },
    },
  });
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
          callback(tab(mockCurrentTabId)),
      },
      windows: {
        getCurrent: (callback: (value: { id: number }) => void) =>
          callback({ id: 3 }),
      },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'chrome');
});

it('opens only one payable tab when two extension surfaces open the same new checkout', async () => {
  const newSession = { ...session, extension: undefined };
  mockSessions.set(newSession.onekeyUserId, newSession);
  let openFromAnotherSurface = openPrimeWebCheckoutPage;
  await jest.isolateModulesAsync(async () => {
    openFromAnotherSurface = (await import('./primeWebCheckoutPlatform'))
      .openPrimeWebCheckoutPage;
  });
  expect(openFromAnotherSurface).not.toBe(openPrimeWebCheckoutPage);

  await Promise.all([
    openPrimeWebCheckoutPage(newSession),
    openFromAnotherSurface({ ...newSession }),
  ]);

  expect(mockOpenUrlInTab).toHaveBeenCalledTimes(1);
  expect(mockFocusTab).toHaveBeenCalledWith(77);
  expect(mockTabs.size).toBe(1);
  expect(
    isPrimeWebCheckoutReturnFromCheckoutTab({
      extension: mockSessions.get('user-1')?.extension,
      browserSessionId: 'browser-1',
      sender: {
        tabId: 77,
        frameId: 0,
        url: 'https://app.onekeytest.com/prime/purchase-complete',
      },
    }),
  ).toBe(true);
});

it('keeps the first initiator when another surface opens the checkout before context persistence finishes', async () => {
  const saving = deferred();
  const release = deferred();
  const newSession = { ...session, extension: undefined };
  mockSessions.set('user-1', newSession);
  mockUpdateContext.mockImplementationOnce(async (params) => {
    saving.resolve();
    await release.promise;
    return saveContext(params);
  });

  const first = openPrimeWebCheckoutPage(newSession);
  await saving.promise;
  mockCurrentTabId = 6;
  const second = openPrimeWebCheckoutPage({ ...newSession });
  release.resolve();
  await Promise.all([first, second]);

  expect(mockOpenUrlInTab).toHaveBeenCalledTimes(1);
  expect(mockUpdateContext).toHaveBeenCalledTimes(1);
  expect(mockFocusTab).toHaveBeenCalledWith(77);
  expect(mockSessions.get('user-1')?.extension).toEqual({
    initiatorKind: 'tab',
    initiatorTabId: 5,
    checkoutTabId: 77,
    browserSessionId: 'browser-1',
  });
});

it('lets a queued surface retry after the first tab creation fails', async () => {
  const newSession = { ...session, extension: undefined };
  mockSessions.set('user-1', newSession);
  mockOpenUrlInTab.mockRejectedValueOnce(
    new OneKeyLocalError('Creation failed'),
  );

  const results = await Promise.allSettled([
    openPrimeWebCheckoutPage(newSession),
    openPrimeWebCheckoutPage({ ...newSession }),
  ]);

  expect(results.map((result) => result.status)).toEqual([
    'rejected',
    'fulfilled',
  ]);
  expect(mockTabs.size).toBe(1);
  expect(mockSessions.get('user-1')?.extension?.checkoutTabId).toBe(77);
});

it('releases creation after Chrome returns no tab', async () => {
  mockOpenUrlInTab.mockResolvedValueOnce(undefined);
  await expect(openPrimeWebCheckoutPage(session)).rejects.toThrow(
    'Failed to open',
  );
  await expect(openPrimeWebCheckoutPage(session)).resolves.toBe('opened');

  expect(mockTabs.size).toBe(1);
  expect(mockSessions.get('user-1')?.extension?.checkoutTabId).toBe(77);
});

it('removes an unrecorded payable tab after persistence fails and allows retry', async () => {
  mockUpdateContext.mockRejectedValueOnce(
    new OneKeyLocalError('Storage failed'),
  );

  await expect(openPrimeWebCheckoutPage(session)).rejects.toThrow(
    'Storage failed',
  );
  expect(mockRemoveTab).toHaveBeenCalledWith(77);
  expect(mockTabs.size).toBe(0);
  expect(mockSessions.get('user-1')?.checkoutId).toBe('checkout-1');

  await expect(openPrimeWebCheckoutPage(session)).resolves.toBe('opened');
  expect(mockTabs.size).toBe(1);
  expect(mockSessions.get('user-1')?.extension?.checkoutTabId).toBe(78);
});

it('recovers from a context write that committed before its response failed', async () => {
  mockUpdateContext.mockImplementationOnce(async (params) => {
    await saveContext(params);
    throw new OneKeyLocalError('Response lost');
  });

  await expect(openPrimeWebCheckoutPage(session)).rejects.toThrow(
    'Response lost',
  );
  expect(mockTabs.has(77)).toBe(false);
  await expect(openPrimeWebCheckoutPage(session)).resolves.toBe('opened');

  expect(mockTabs.size).toBe(1);
  expect(mockSessions.get('user-1')?.extension?.checkoutTabId).toBe(78);
});

it('does not open a stale account checkout and allows the current account to proceed', async () => {
  mockUser.onekeyUserId = 'user-2';
  await expect(openPrimeWebCheckoutPage(session)).rejects.toThrow(
    'session changed',
  );
  expect(mockOpenUrlInTab).not.toHaveBeenCalled();

  const next = {
    ...session,
    onekeyUserId: 'user-2',
    checkoutId: 'checkout-2',
    checkoutUrl: 'https://pay.rev.cat/test-link/user-2?package_id=annual',
    extension: undefined,
  };
  mockSessions.set('user-2', next);
  await expect(openPrimeWebCheckoutPage(next)).resolves.toBe('opened');
  expect(mockSessions.get('user-1')?.extension?.checkoutTabId).toBe(12);
  expect(mockSessions.get('user-2')?.extension?.checkoutTabId).toBe(77);
});

it('removes a newly created tab when the account changes in flight, then opens only the new account checkout', async () => {
  const created = deferred();
  const release = deferred();
  mockOpenUrlInTab.mockImplementationOnce(async (url) => {
    const result = tab(70, url);
    mockTabs.set(70, result);
    created.resolve();
    await release.promise;
    return result;
  });
  const firstResult = Promise.allSettled([openPrimeWebCheckoutPage(session)]);
  await created.promise;
  mockUser.onekeyUserId = 'user-2';
  const next = {
    ...session,
    onekeyUserId: 'user-2',
    checkoutId: 'checkout-2',
    checkoutUrl: 'https://pay.rev.cat/test-link/user-2?package_id=annual',
    extension: undefined,
  };
  mockSessions.set('user-2', next);
  const second = openPrimeWebCheckoutPage(next);
  release.resolve();
  expect(await firstResult).toEqual([
    {
      status: 'rejected',
      reason: expect.objectContaining({
        message: 'Prime web checkout session changed',
      }),
    },
  ]);
  await expect(second).resolves.toBe('opened');

  expect(mockTabs.has(70)).toBe(false);
  expect(mockTabs.size).toBe(1);
  expect(mockSessions.get('user-1')?.extension?.checkoutTabId).toBe(12);
  expect(mockSessions.get('user-2')?.extension?.checkoutTabId).toBe(77);
});

it('rejects a queued stale session and preserves the replacement checkout context', async () => {
  const created = deferred();
  const release = deferred();
  mockOpenUrlInTab.mockImplementationOnce(async (url) => {
    const result = tab(70, url);
    mockTabs.set(70, result);
    created.resolve();
    await release.promise;
    return result;
  });
  const firstResult = Promise.allSettled([openPrimeWebCheckoutPage(session)]);
  await created.promise;
  const staleResult = Promise.allSettled([
    openPrimeWebCheckoutPage({ ...session }),
  ]);
  const next = { ...session, checkoutId: 'checkout-2', extension: undefined };
  mockSessions.set('user-1', next);
  const second = openPrimeWebCheckoutPage(next);
  release.resolve();
  for (const result of await Promise.all([firstResult, staleResult])) {
    expect(result).toEqual([
      {
        status: 'rejected',
        reason: expect.objectContaining({
          message: 'Prime web checkout session changed',
        }),
      },
    ]);
  }
  await expect(second).resolves.toBe('opened');

  expect(mockTabs.has(70)).toBe(false);
  expect(mockTabs.size).toBe(1);
  expect(mockUpdateContext).toHaveBeenCalledTimes(1);
  expect(mockSessions.get('user-1')?.checkoutId).toBe('checkout-2');
  expect(mockSessions.get('user-1')?.extension?.checkoutTabId).toBe(77);
});

it('cleans up a tab when its session is cleared and does not recreate it from a stale UI', async () => {
  mockUpdateContext.mockImplementationOnce(async () => {
    mockSessions.delete('user-1');
    return false;
  });

  await expect(openPrimeWebCheckoutPage(session)).rejects.toThrow(
    'session changed',
  );
  await expect(openPrimeWebCheckoutPage({ ...session })).rejects.toThrow(
    'session changed',
  );

  expect(mockTabs.size).toBe(0);
  expect(mockRemoveTab).toHaveBeenCalledWith(77);
  expect(mockOpenUrlInTab).toHaveBeenCalledTimes(1);
});

it('coalesces concurrent retries after the recorded tab was closed', async () => {
  await Promise.all([
    openPrimeWebCheckoutPage(session),
    openPrimeWebCheckoutPage({ ...session }),
  ]);

  expect(mockOpenUrlInTab).toHaveBeenCalledTimes(1);
  expect(mockFocusTab).toHaveBeenCalledWith(77);
  expect(mockTabs.size).toBe(1);
});

it('uses the background context instead of a stale or altered UI tab ID', async () => {
  mockTabs.set(12, tab(12, session.checkoutUrl));
  mockTabs.set(99, tab(99, session.checkoutUrl));

  await openPrimeWebCheckoutPage({
    ...session,
    extension: {
      ...session.extension,
      initiatorKind: 'tab',
      checkoutTabId: 99,
    },
  });

  expect(mockFocusTab).toHaveBeenCalledWith(12);
  expect(mockFocusTab).not.toHaveBeenCalledWith(99);
  expect(mockOpenUrlInTab).not.toHaveBeenCalled();
});

it('retains side panel ownership and does not persist email prefill', async () => {
  const newSession = { ...session, extension: undefined };
  mockSessions.set('user-1', newSession);
  platformEnv.isExtensionUiSidePanel = true;

  await openPrimeWebCheckoutPage(newSession, { email: 'test@example.com' });

  expect(mockOpenUrlInTab).toHaveBeenCalledWith(
    `${session.checkoutUrl}&email=test%40example.com`,
    { tabId: undefined },
  );
  expect(mockSessions.get('user-1')?.checkoutUrl).toBe(session.checkoutUrl);
  expect(mockSessions.get('user-1')?.extension).toEqual({
    initiatorKind: 'sidePanel',
    initiatorWindowId: 3,
    checkoutTabId: 77,
    browserSessionId: 'browser-1',
  });
});

it('reopens the recorded checkout by focusing it when tab URL fields are unavailable', async () => {
  mockTabs.set(12, tab(12));

  await expect(openPrimeWebCheckoutPage(session)).resolves.toBe('opened');

  expect(mockFocusTab).toHaveBeenCalledWith(12);
  expect(mockGetBrowserSessionId).toHaveBeenCalled();
  expect(mockOpenUrlInTab).not.toHaveBeenCalled();
});

it('does not create an untracked checkout while the background session ID is unavailable', async () => {
  mockGetBrowserSessionId.mockRejectedValueOnce(
    new OneKeyLocalError('Background starting'),
  );

  await expect(openPrimeWebCheckoutPage(session)).rejects.toThrow(
    'Background starting',
  );

  expect(mockFocusTab).not.toHaveBeenCalled();
  expect(mockOpenUrlInTab).not.toHaveBeenCalled();

  await expect(openPrimeWebCheckoutPage(session)).resolves.toBe('opened');
  expect(mockOpenUrlInTab).toHaveBeenCalledTimes(1);
});

it('focuses a visible hosted form without reloading or resetting its payment fields', async () => {
  mockTabs.set(12, tab(12, session.checkoutUrl));

  await openPrimeWebCheckoutPage(session);

  expect(mockFocusTab).toHaveBeenCalledWith(12);
  expect(mockOpenUrlInTab).not.toHaveBeenCalled();
});

it.each([
  'https://pay.rev.cat/test-link/user-1?package_id=monthly',
  'https://pay.rev.cat/test-link/other-user?package_id=annual',
  'https://pay.rev.cat/other-link/user-1?package_id=annual',
  'https://pay.rev.cat/test-link/user-1?package_id=annual&currency=EUR',
  'https://pay.rev.cat/test-link/user-1?package_id=annual&package_id=monthly',
])(
  'does not focus or overwrite a different checkout on the hosted origin: %s',
  async (url) => {
    mockTabs.set(12, tab(12, url));

    await openPrimeWebCheckoutPage(session);

    expect(mockFocusTab).not.toHaveBeenCalled();
    expect(mockOpenUrlInTab).toHaveBeenCalledWith(session.checkoutUrl, {
      tabId: undefined,
    });
  },
);

it('ignores email prefill and attribution when identifying the same payment', async () => {
  mockTabs.set(
    12,
    tab(
      12,
      `${session.checkoutUrl}&email=test%40example.com&utm_campaign=test`,
    ),
  );

  await openPrimeWebCheckoutPage(session);

  expect(mockFocusTab).toHaveBeenCalledWith(12);
  expect(mockOpenUrlInTab).not.toHaveBeenCalled();
});

it('does not focus a tab navigating to a different pending payment URL', async () => {
  mockTabs.set(12, {
    ...tab(12, session.checkoutUrl),
    pendingUrl: 'https://pay.rev.cat/test-link/other-user?package_id=annual',
  });

  await openPrimeWebCheckoutPage(session);

  expect(mockFocusTab).not.toHaveBeenCalled();
  expect(mockOpenUrlInTab).toHaveBeenCalledWith(session.checkoutUrl, {
    tabId: undefined,
  });
});

it('does not take over a replaced session tab displaying another customer payment', async () => {
  mockTabs.set(
    12,
    tab(12, 'https://pay.rev.cat/test-link/other-user?package_id=annual'),
  );
  mockSessions.set(session.onekeyUserId, { ...session, extension: undefined });

  await openPrimeWebCheckoutPage(
    { ...session, extension: undefined },
    { replacedSession: session },
  );

  expect(mockFocusTab).not.toHaveBeenCalled();
  expect(mockOpenUrlInTab).toHaveBeenCalledWith(session.checkoutUrl, {
    tabId: undefined,
  });
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

  const previousBrowserSession: IPrimeWebCheckoutPendingSession = {
    ...session,
    extension: {
      ...session.extension,
      initiatorKind: 'tab',
      browserSessionId: 'old-browser',
    },
  };
  mockSessions.set(session.onekeyUserId, previousBrowserSession);
  await openPrimeWebCheckoutPage(previousBrowserSession);

  expect(mockFocusTab).not.toHaveBeenCalled();
  expect(mockOpenUrlInTab).toHaveBeenCalledWith(session.checkoutUrl, {
    tabId: undefined,
  });
});

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockItems = new Map<string, string>();
let mockSequence = 0;
let mockUserId: string | null = null;
let mockBackgroundUserId: string | null = null;
const mockSet = jest.fn(async (key: string, value: string) => {
  mockItems.set(key, value);
});
const mockGet = jest.fn(async (key: string) => mockItems.get(key) ?? null);

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => {
    mockSequence += 1;
    return `test-browser-${mockSequence}`;
  },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGet(key),
    setItem: (key: string, value: string) => mockSet(key, value),
    removeItem: async (key: string) => {
      mockItems.delete(key);
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/getInstanceId', () => ({
  getInstanceId: async () => 'test-install',
}));
jest.mock('./identity', () => ({
  getCurrentIntercomUserId: async () => mockUserId,
  assertIntercomIdentity: async (expected: string | null) => {
    if (expected !== mockBackgroundUserId)
      throw new OneKeyLocalError('Support session changed');
  },
  getIntercomCredentials: async () => undefined,
  getInstanceId: async () => 'test-install',
  getIntercomLanguageOverride: async () => 'en',
}));
jest.mock('./lockState', () => ({
  isIntercomLocked: () => false,
  markIntercomLockReady: () => {},
}));
jest.mock('./supportUi', () => ({ presentIntercomSupportUi: jest.fn() }));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom/openFailure', () => ({
  notifyIntercomOpenFailed: jest.fn(),
}));

const legacyVisitor = JSON.stringify({
  anonymousId: 'test-old-visitor',
  anonymousSession: 'test-old-session',
  expiresAt: 9_999_999_999_000,
});
const originalFetch = globalThis.fetch;
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);
let subject: typeof import('@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage');
beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  mockItems.clear();
  mockSequence = 0;
  mockUserId = null;
  mockBackgroundUserId = null;
  mockSet.mockImplementation(async (key, value) => {
    mockItems.set(key, value);
  });
  mockGet.mockImplementation(async (key) => mockItems.get(key) ?? null);
  subject =
    await import('@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage');
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalNavigator)
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
});

function installSharedLocks() {
  let pending = Promise.resolve();
  const request = jest.fn((_key: string, operation: () => Promise<void>) => {
    const next = pending.catch(() => undefined).then(operation);
    pending = next;
    return next;
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { locks: { request } },
  });
  return request;
}

function visitorResponse(id: string) {
  return new Response(
    JSON.stringify({
      cards: [],
      user: { id, anonymous_id: id },
      anonymous_session: `${id}-session`,
      session_expiry: 9_999_999_999,
    }),
  );
}

function installUnreadReply(replyId: () => string = () => 'admin-1') {
  globalThis.fetch = async (url) =>
    new Response(
      JSON.stringify({
        user: { id: 'shared', anonymous_id: 'shared' },
        anonymous_session: 'shared-session',
        session_expiry: 9_999_999_999,
        unread_conversation_ids: ['42'],
        ...(String(url).endsWith('/conversations')
          ? {
              conversations: [
                {
                  id: '42',
                  read: false,
                  conversation_parts: [
                    {
                      id: replyId(),
                      created_at: 1_700_000_000,
                      participant_is_admin: true,
                      author: { name: 'Support' },
                      body: [{ type: 'paragraph', text: 'Private reply' }],
                    },
                  ],
                },
              ],
            }
          : {}),
      }),
    );
}

it('serializes first boot across independent extension windows and restores the same visitor', async () => {
  const locks = installSharedLocks();
  let finishFirst!: (response: Response) => void;
  const firstPing = new Promise<Response>((resolve) => {
    finishFirst = resolve;
  });
  let creations = 0;
  const fetch = jest.fn(async (_url: string, options?: RequestInit) => {
    const body = new URLSearchParams(String(options?.body));
    if (!body.has('anonymous_session')) {
      creations += 1;
      return creations === 1 ? firstPing : visitorResponse('forked');
    }
    return visitorResponse('shared');
  });
  // Keep mock call history across isolated module registries in Jest 30.
  globalThis.fetch = (url, options) => fetch(String(url), options);
  const firstWindow = await import('./messenger');
  const first = firstWindow.createIntercomMessengerSession(null);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(fetch).toHaveBeenCalledTimes(1);
  jest.resetModules();
  const secondWindow = await import('./messenger');
  const second = secondWindow.createIntercomMessengerSession(null);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(locks).toHaveBeenCalledWith(
    subject.intercomVisitorStorageKey,
    expect.any(Function),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  finishFirst(visitorResponse('shared'));
  const [a, b] = await Promise.all([first, second]);
  expect(creations).toBe(1);
  await Promise.all([a.getHome(), b.getHome()]);
  jest.resetModules();
  const reopened = await import('./messenger');
  await reopened.createIntercomMessengerSession(null);
  expect(creations).toBe(1);
  for (const [, options] of fetch.mock.calls.slice(1)) {
    expect(
      new URLSearchParams(String(options?.body)).get('anonymous_session'),
    ).toBe('shared-session');
  }
  expect(
    await subject.visitorStorage.get(subject.intercomVisitorStorageKey),
  ).toContain('shared-session');
});

it('revokes a boot in flight without blocking reset and lets the queued window start fresh', async () => {
  installSharedLocks();
  let finishFirst!: (response: Response) => void;
  const fetch = jest.fn(async (_url: string, _options?: RequestInit) =>
    visitorResponse('new'),
  );
  fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finishFirst = resolve;
      }),
  );
  globalThis.fetch = (url, options) => fetch(String(url), options);
  const firstWindow = await import('./messenger');
  const first = firstWindow
    .createIntercomMessengerSession(null)
    .catch((error: unknown) => error);
  await new Promise<void>((resolve) => setImmediate(resolve));
  jest.resetModules();
  const secondWindow = await import('./messenger');
  const second = secondWindow.createIntercomMessengerSession(null);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(fetch).toHaveBeenCalledTimes(1);
  mockItems.clear();
  finishFirst(visitorResponse('old'));
  const [revoked] = await Promise.all([first, second]);
  expect(revoked).toBeInstanceOf(Error);
  expect(revoked).toHaveProperty(
    'message',
    'Support visitor installation changed',
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  const body = new URLSearchParams(String(fetch.mock.calls[1][1]?.body));
  expect(body.has('anonymous_session')).toBe(false);
  expect(
    await subject.visitorStorage.get(subject.intercomVisitorStorageKey),
  ).toContain('new-session');
  expect(
    [...mockItems.values()].some((value) => value.includes('old-session')),
  ).toBe(false);
});

it('restores a scoped visitor after a normal browser reload', async () => {
  const key = subject.intercomVisitorStorageKey;
  const binding = await subject.bindVisitorStorage(key);
  await binding.set(legacyVisitor);
  expect(mockItems.get(key)).toMatch(/-ref-test-browser-/);
  jest.resetModules();
  const reloaded =
    await import('@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage');
  await expect(reloaded.visitorStorage.get(key)).resolves.toBe(legacyVisitor);
  await expect((await reloaded.bindVisitorStorage(key)).get()).resolves.toBe(
    legacyVisitor,
  );
});

it('keeps legacy visitors compatible without rewriting their immutable root reference', async () => {
  const key = subject.intercomVisitorStorageKey;
  mockItems.set(key, legacyVisitor);
  const binding = await subject.bindVisitorStorage(key);
  await expect(binding.get()).resolves.toBe(legacyVisitor);
  await binding.set('updated-visitor');
  expect(mockItems.get(key)).toBe(legacyVisitor);
  expect(mockSet.mock.calls.some(([writtenKey]) => writtenKey === key)).toBe(
    false,
  );
  jest.resetModules();
  const otherWindow =
    await import('@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage');
  await expect(otherWindow.visitorStorage.get(key)).resolves.toBe(
    'updated-visitor',
  );
  await expect((await otherWindow.bindVisitorStorage(key)).get()).resolves.toBe(
    'updated-visitor',
  );
});

it.each([false, true])(
  'does not resurrect a revoked visitor after a delayed write (legacy=%s)',
  async (legacy) => {
    const key = subject.intercomVisitorStorageKey;
    if (legacy) mockItems.set(key, legacyVisitor);
    const old = await subject.bindVisitorStorage(key);
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockSet.mockImplementationOnce(async (writtenKey, value) => {
      await waiting;
      mockItems.set(writtenKey, value);
    });
    const lateWrite = old.set(legacyVisitor);
    await new Promise<void>((resolve) => setImmediate(resolve));
    // Simulate bg.clear while a separate extension UI JS heap holds a client.
    mockItems.clear();
    jest.resetModules();
    const otherWindow =
      await import('@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage');
    const fresh = await otherWindow.bindVisitorStorage(key);
    await fresh.set('new-visitor');
    release();
    await expect(lateWrite).rejects.toThrow(
      'Support visitor installation changed',
    );
    await expect(fresh.get()).resolves.toBe('new-visitor');
    expect([...mockItems.values()]).not.toContain(legacyVisitor);
    expect(mockItems.size).toBe(2);
  },
);

it('rejects a legacy read completed after another extension runtime clears storage', async () => {
  const key = subject.intercomVisitorStorageKey;
  mockItems.set(key, legacyVisitor);
  const binding = await subject.bindVisitorStorage(key);
  mockGet
    .mockImplementationOnce(async (readKey) => mockItems.get(readKey) ?? null)
    .mockImplementationOnce(async () => {
      mockItems.clear();
      return null;
    });
  await expect(binding.get()).rejects.toThrow(
    'Support visitor installation changed',
  );
  expect(mockItems.size).toBe(0);
});

it('rejects a boot response after a shared clear and starts the next session without the old visitor', async () => {
  const key = subject.intercomVisitorStorageKey;
  mockItems.set(key, legacyVisitor);
  let respond!: (response: Response) => void;
  const fetch = jest.fn(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  globalThis.fetch = fetch as typeof globalThis.fetch;
  const messenger = await import('./messenger');
  const opening = messenger.createIntercomMessengerSession(null);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(fetch).toHaveBeenCalledTimes(1);
  mockItems.clear();
  respond(
    new Response(
      JSON.stringify({
        user: { id: 'test-old-visitor', anonymous_id: 'test-old-visitor' },
        anonymous_session: 'test-old-session',
        session_expiry: 9_999_999_999,
      }),
    ),
  );
  await expect(opening).rejects.toThrow('Support visitor installation changed');
  expect(mockItems.size).toBe(0);
  const nextFetch = jest.fn(
    async (_url: string, _options?: RequestInit) =>
      new Response(
        JSON.stringify({
          user: { id: 'test-new-visitor', anonymous_id: 'test-new-visitor' },
          anonymous_session: 'test-new-session',
          session_expiry: 9_999_999_999,
        }),
      ),
  );
  globalThis.fetch = nextFetch as typeof globalThis.fetch;
  await messenger.createIntercomMessengerSession(null);
  const body = new URLSearchParams(String(nextFetch.mock.calls[0][1]?.body));
  expect(body.has('anonymous_session')).toBe(false);
  expect(await subject.visitorStorage.get(key)).toContain('test-new-session');
});

it('keeps the new anonymous visitor when another extension window processes the same logout later', async () => {
  installSharedLocks();
  mockUserId = 'A';
  mockBackgroundUserId = 'A';
  const firstWindow = await import('./messenger');
  await firstWindow.initIntercom();
  jest.resetModules();
  const secondWindow = await import('./messenger');
  await secondWindow.initIntercom();
  globalThis.fetch = async () => visitorResponse('after-logout');
  mockUserId = null;
  mockBackgroundUserId = null;
  const fresh = await firstWindow.createIntercomMessengerSession(null);
  const stored = await subject.visitorStorage.get(
    subject.intercomVisitorStorageKey,
  );
  await secondWindow.initIntercom();
  expect(
    await subject.visitorStorage.get(subject.intercomVisitorStorageKey),
  ).toBe(stored);
  await expect(fresh.assertCurrent()).resolves.toBeUndefined();
  await secondWindow.createIntercomMessengerSession(null);
  expect(
    await subject.visitorStorage.get(subject.intercomVisitorStorageKey),
  ).toBe(stored);
});

it('rejects a stale window identity before it can revoke the shared visitor', async () => {
  installSharedLocks();
  const currentWindow = await import('./messenger');
  globalThis.fetch = async () => visitorResponse('current');
  const fresh = await currentWindow.createIntercomMessengerSession(null);
  const stored = await subject.visitorStorage.get(
    subject.intercomVisitorStorageKey,
  );
  jest.resetModules();
  const staleWindow = await import('./messenger');
  mockUserId = 'A';
  await expect(staleWindow.initIntercom()).rejects.toThrow(
    'Support session changed',
  );
  expect(
    await subject.visitorStorage.get(subject.intercomVisitorStorageKey),
  ).toBe(stored);
  mockUserId = null;
  await expect(fresh.assertCurrent()).resolves.toBeUndefined();
});

it('deduplicates unread previews across extension windows and a cold restart while retaining the badge', async () => {
  installSharedLocks();
  let replyId = 'admin-1';
  installUnreadReply(() => replyId);
  const firstWindow = await import('./messenger');
  await firstWindow.createIntercomMessengerSession(null);
  firstWindow.subscribeToIntercomNotifications(() => {});
  await firstWindow.startIntercomBackgroundPolling();
  await firstWindow.setIntercomInAppMessageVisibility(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(firstWindow.getIntercomNotification()?.id).toBe('42:admin-1');
  jest.resetModules();
  const secondWindow = await import('./messenger');
  secondWindow.subscribeToIntercomNotifications(() => {});
  await secondWindow.startIntercomBackgroundPolling();
  await secondWindow.setIntercomInAppMessageVisibility(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(secondWindow.getIntercomNotification()).toBeUndefined();
  expect(secondWindow.getIntercomUnreadCount()).toBe(1);
  await firstWindow.setIntercomInAppMessageVisibility(false);
  await secondWindow.setIntercomInAppMessageVisibility(false);
  jest.resetModules();
  const restarted = await import('./messenger');
  restarted.subscribeToIntercomNotifications(() => {});
  await restarted.startIntercomBackgroundPolling();
  await restarted.setIntercomInAppMessageVisibility(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(restarted.getIntercomNotification()).toBeUndefined();
  expect(restarted.getIntercomUnreadCount()).toBe(1);
  replyId = 'admin-2';
  restarted.refreshIntercomNotifications();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(restarted.getIntercomNotification()?.id).toBe('42:admin-2');
  expect(Array.from(mockItems.values()).join()).not.toContain('Private reply');
  await restarted.setIntercomInAppMessageVisibility(false);
});

it.each(['lock', 'read'] as const)(
  'does not consume a reply hidden while waiting for the notification %s',
  async (phase) => {
    installSharedLocks();
    installUnreadReply();
    const messenger = await import('./messenger');
    await messenger.createIntercomMessengerSession(null);
    messenger.subscribeToIntercomNotifications(() => {});
    await messenger.startIntercomBackgroundPolling();
    const key = `${subject.intercomVisitorStorageKey}-notifications`;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    let heldLock: Promise<void> | undefined;
    if (phase === 'lock')
      heldLock = subject.withVisitorSessionLock(key, () => waiting);
    else
      mockGet.mockImplementation(async (readKey) => {
        if (readKey === key) await waiting;
        return mockItems.get(readKey) ?? null;
      });
    await messenger.setIntercomInAppMessageVisibility(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await messenger.setIntercomInAppMessageVisibility(false);
    release();
    await heldLock;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockItems.has(key)).toBe(false);
    expect(messenger.getIntercomNotification()).toBeUndefined();
    expect(messenger.getIntercomUnreadCount()).toBe(1);
    await messenger.setIntercomInAppMessageVisibility(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(messenger.getIntercomNotification()?.id).toBe('42:admin-1');
    await messenger.setIntercomInAppMessageVisibility(false);
  },
);

it('lets a visible window deliver a reply after the competing window hides during its metadata read', async () => {
  installSharedLocks();
  installUnreadReply();
  const firstWindow = await import('./messenger');
  await firstWindow.createIntercomMessengerSession(null);
  firstWindow.subscribeToIntercomNotifications(() => {});
  await firstWindow.startIntercomBackgroundPolling();
  jest.resetModules();
  const secondWindow = await import('./messenger');
  secondWindow.subscribeToIntercomNotifications(() => {});
  await secondWindow.startIntercomBackgroundPolling();
  const key = `${subject.intercomVisitorStorageKey}-notifications`;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockGet.mockImplementation(async (readKey) => {
    if (readKey === key) await waiting;
    return mockItems.get(readKey) ?? null;
  });
  await firstWindow.setIntercomInAppMessageVisibility(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(mockGet).toHaveBeenCalledWith(key);
  await firstWindow.setIntercomInAppMessageVisibility(false);
  await secondWindow.setIntercomInAppMessageVisibility(true);
  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(firstWindow.getIntercomNotification()).toBeUndefined();
  expect(secondWindow.getIntercomNotification()?.id).toBe('42:admin-1');
  expect(firstWindow.getIntercomUnreadCount()).toBe(1);
  await secondWindow.setIntercomInAppMessageVisibility(false);
});

it('discards the old visibility generation when the same window returns before its metadata read completes', async () => {
  installSharedLocks();
  let replyId = 'admin-1';
  installUnreadReply(() => replyId);
  const messenger = await import('./messenger');
  await messenger.createIntercomMessengerSession(null);
  const delivered: string[] = [];
  messenger.subscribeToIntercomNotifications(() => {
    const message = messenger.getIntercomNotification();
    if (message) delivered.push(message.id);
  });
  await messenger.startIntercomBackgroundPolling();
  const key = `${subject.intercomVisitorStorageKey}-notifications`;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockGet.mockImplementation(async (readKey) => {
    if (readKey === key) await waiting;
    return mockItems.get(readKey) ?? null;
  });
  await messenger.setIntercomInAppMessageVisibility(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(mockGet).toHaveBeenCalledWith(key);
  await messenger.setIntercomInAppMessageVisibility(false);
  replyId = 'admin-2';
  await messenger.setIntercomInAppMessageVisibility(true);
  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(delivered).toEqual(['42:admin-2']);
  await messenger.setIntercomInAppMessageVisibility(false);
});

it('hands a reply to the visible host before a delayed deduplication write and does not replay it after hiding', async () => {
  installSharedLocks();
  installUnreadReply();
  const messenger = await import('./messenger');
  await messenger.createIntercomMessengerSession(null);
  const delivered: string[] = [];
  messenger.subscribeToIntercomNotifications(() => {
    const message = messenger.getIntercomNotification();
    if (message) delivered.push(message.id);
  });
  await messenger.startIntercomBackgroundPolling();
  const key = `${subject.intercomVisitorStorageKey}-notifications`;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockSet.mockImplementation(async (writtenKey, value) => {
    if (writtenKey === key) await waiting;
    mockItems.set(writtenKey, value);
  });
  await messenger.setIntercomInAppMessageVisibility(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(delivered).toEqual(['42:admin-1']);
  expect(mockItems.has(key)).toBe(false);
  await messenger.setIntercomInAppMessageVisibility(false);
  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await messenger.setIntercomInAppMessageVisibility(true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(messenger.getIntercomNotification()).toBeUndefined();
  expect(delivered).toEqual(['42:admin-1']);
  expect(messenger.getIntercomUnreadCount()).toBe(1);
  await messenger.setIntercomInAppMessageVisibility(false);
});

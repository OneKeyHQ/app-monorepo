import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IIntercomVisitor } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerClient';

let mockUserId: string | null = null;
let mockLocked = false;
let mockPolicy: { validFromMs: number; lockAtMs: number } | undefined;
jest.mock('./lockState', () => ({
  markIntercomLockReady: () => {},
  isIntercomLocked: () =>
    mockLocked ||
    (!!mockPolicy &&
      (Date.now() < mockPolicy.validFromMs ||
        Date.now() >= mockPolicy.lockAtMs)),
}));
let mockVisitor: string | null = null;
let mockStorageEpoch = 0;
let mockStorageIdentity: string | null | undefined;
const mockNotificationStorage = new Map<string, string>();
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockNotificationStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockNotificationStorage.set(key, value);
    },
  },
}));
const mockPresent = jest.fn((_route: unknown) => true);
const mockPresentOptions = jest.fn<void, [unknown]>();
const mockNotify = jest.fn((_error: unknown): void => {});
const mockCredentials = jest.fn(async (_user: string) => ({
  token: 'test-jwt',
  attributes: { userId: 'test' },
}));
const mockRemove = jest.fn(async () => {
  mockVisitor = null;
});
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => 'test-uuid',
}));
jest.mock('@onekeyhq/shared/src/utils/getInstanceId', () => ({
  getInstanceId: async () => 'test-install',
}));
jest.mock('./identity', () => ({
  getCurrentIntercomUserId: async () => mockUserId,
  assertIntercomIdentity: async (expected: string | null) => {
    if (expected !== mockUserId)
      throw new OneKeyLocalError('Support session changed');
  },
  getIntercomCredentials: (user: string) => mockCredentials(user),
  getInstanceId: async () => 'test-install',
  getIntercomLanguageOverride: async () => 'en',
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage',
  () => ({
    intercomVisitorStorageKey: 'test-visitor-key',
    withVisitorSessionLock: async (
      _key: string,
      operation: () => Promise<void>,
    ) => operation(),
    bindVisitorStorage: async () => {
      const epoch = mockStorageEpoch;
      return {
        assertCurrent: async () => {
          if (epoch !== mockStorageEpoch)
            throw new OneKeyLocalError('Support visitor installation changed');
        },
        get: async () => mockVisitor,
        set: async (value: string) => {
          mockVisitor = value;
        },
      };
    },
    visitorStorage: {
      syncIdentity: async (
        _key: string,
        userId: string | null,
        assertCurrent: () => Promise<void>,
      ) => {
        await assertCurrent();
        if (mockStorageIdentity === userId) return;
        if (mockStorageIdentity !== undefined || userId !== null)
          await mockRemove();
        mockStorageIdentity = userId;
      },
      get: async () => mockVisitor,
      set: async (_key: string, value: string) => {
        mockVisitor = value;
      },
      remove: () => mockRemove(),
    },
  }),
);
jest.mock('./supportUi', () => ({
  presentIntercomSupportUi: (route: unknown, options?: unknown) => {
    mockPresentOptions(options);
    return mockPresent(route);
  },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom/openFailure', () => ({
  notifyIntercomOpenFailed: (error: unknown) => mockNotify(error),
}));

const originalFetch = globalThis.fetch;
const boot = {
  user: { id: 'test-user', anonymous_id: 'test-visitor' },
  anonymous_session: 'test-session',
  session_expiry: 9_999_999_999,
  unread_conversation_ids: ['42'],
};
const mockFetch = jest.fn(
  async (_url: string, _options?: RequestInit) =>
    new Response(JSON.stringify({ ...boot, conversations: [] }), {
      status: 200,
    }),
);
let subject: typeof import('./messenger');
async function setLock(
  locked: boolean,
  policy?: { validFromMs: number; lockAtMs: number },
) {
  mockLocked = locked;
  mockPolicy = policy;
  await subject.syncIntercomLockState();
}

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  mockUserId = null;
  mockLocked = false;
  mockPolicy = undefined;
  mockVisitor = null;
  mockStorageEpoch = 0;
  mockStorageIdentity = undefined;
  mockNotificationStorage.clear();
  mockRemove.mockImplementation(async () => {
    mockVisitor = null;
  });
  mockPresent.mockReturnValue(true);
  mockCredentials.mockImplementation(async () => ({
    token: 'test-jwt',
    attributes: { userId: 'test' },
  }));
  mockFetch.mockImplementation(
    async () =>
      new Response(JSON.stringify({ ...boot, conversations: [] }), {
        status: 200,
      }),
  );
  globalThis.fetch = mockFetch as typeof fetch;
  subject = await import('./messenger');
});
afterEach(async () => {
  await subject.setIntercomInAppMessageVisibility(false);
  await setLock(true);
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe('support message notifications', () => {
  function conversation(partId = 'reply-1', read = false, isAdmin = true) {
    return {
      id: '42',
      read,
      conversation_parts: [
        {
          id: partId,
          created_at: 1_700_000_000,
          participant_is_admin: isAdmin,
          author: { name: 'OneKey Support' },
          body: [
            { type: 'paragraph', text: '<p>Test reply &amp; preview</p>' },
          ],
        },
      ],
    };
  }
  let conversations: ReturnType<typeof conversation>[];
  const changed = jest.fn();
  beforeEach(() => {
    jest.useFakeTimers();
    mockUserId = 'A';
    conversations = [conversation()];
    subject.subscribeToIntercomNotifications(changed);
    mockFetch.mockImplementation(async (url) => {
      const unread_conversation_ids = conversations
        .filter((item) => !item.read)
        .map((item) => item.id);
      let payload: unknown = { ...boot, unread_conversation_ids };
      if (url.endsWith('/conversations'))
        payload = { conversations, unread_conversation_ids };
      if (url.endsWith('/conversations/42'))
        payload = { ...conversations[0], unread_conversation_ids };
      return new Response(JSON.stringify(payload));
    });
  });
  async function show() {
    await subject.startIntercomBackgroundPolling();
    await subject.setIntercomInAppMessageVisibility(true);
    await jest.advanceTimersByTimeAsync(0);
  }
  it('asks support to open the message list while replies are unread', async () => {
    await show();
    expect(subject.getIntercomUnreadCount()).toBe(1);
    await subject.showIntercom();
    expect(mockPresent).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: 'A', conversationId: undefined }),
    );
    expect(mockPresentOptions).toHaveBeenLastCalledWith({ hasUnread: true });
  });

  it('shows an authenticated admin preview once per reply and opens the matching conversation', async () => {
    await show();
    expect(subject.getIntercomNotification()).toEqual({
      id: '42:reply-1',
      conversationId: '42',
      author: 'OneKey Support',
      message: 'Test reply & preview',
      avatarUrl: undefined,
    });
    await subject.openIntercomNotification('42:reply-1');
    expect(mockPresent).toHaveBeenCalledWith({
      userId: 'A',
      conversationId: '42',
    });
    expect(subject.getIntercomNotification()).toBeUndefined();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(subject.getIntercomNotification()).toBeUndefined();
    conversations = [conversation('reply-2')];
    subject.refreshIntercomNotifications('42');
    await jest.advanceTimersByTimeAsync(0);
    expect(subject.getIntercomNotification()?.id).toBe('42:reply-2');
    expect(mockFetch.mock.calls.at(-1)?.[0]).toMatch(/conversations\/42$/);
  });
  it('shows only the newest reply in a batch across polls and restarts while allowing a later reply', async () => {
    const older = { ...conversation('older-reply'), id: '41' };
    const newer = conversation('newer-reply');
    newer.conversation_parts[0].created_at += 1;
    conversations = [older, newer];
    await show();
    expect(subject.getIntercomNotification()?.id).toBe('42:newer-reply');
    subject.dismissIntercomNotification('42:newer-reply');
    await jest.advanceTimersByTimeAsync(30_000);
    expect(subject.getIntercomNotification()).toBeUndefined();
    expect(subject.getIntercomUnreadCount()).toBe(2);
    await subject.setIntercomInAppMessageVisibility(false);
    jest.resetModules();
    subject = await import('./messenger');
    subject.subscribeToIntercomNotifications(changed);
    await show();
    expect(subject.getIntercomNotification()).toBeUndefined();
    expect(subject.getIntercomUnreadCount()).toBe(2);
    older.conversation_parts[0].id = 'later-reply';
    older.conversation_parts[0].created_at += 2;
    subject.refreshIntercomNotifications();
    await jest.advanceTimersByTimeAsync(0);
    expect(subject.getIntercomNotification()?.id).toBe('41:later-reply');
  });
  it.each([
    [true, true],
    [false, false],
  ])(
    'suppresses previews for read=%s and isAdmin=%s conversations',
    async (read, isAdmin) => {
      conversations = [conversation('reply', read, isAdmin)];
      await show();
      expect(subject.getIntercomNotification()).toBeUndefined();
    },
  );
  it('dismisses the preview after a read acknowledgement', async () => {
    await show();
    const session = await subject.createIntercomMessengerSession('A');
    await session.markRead('42');
    expect(subject.getIntercomNotification()).toBeUndefined();
    expect(subject.getIntercomUnreadCount()).toBe(0);
  });
  it('hides private content on lock without replaying the same reply after unlock', async () => {
    await show();
    await setLock(true);
    expect(subject.getIntercomNotification()).toBeUndefined();
    await subject.openIntercomNotification('42:reply-1');
    expect(mockPresent).not.toHaveBeenCalled();
    await setLock(false);
    await jest.advanceTimersByTimeAsync(0);
    expect(subject.getIntercomNotification()).toBeUndefined();
    conversations = [conversation('reply-2')];
    await jest.advanceTimersByTimeAsync(30_000);
    expect(subject.getIntercomNotification()?.id).toBe('42:reply-2');
  });
  it('rejects a preview click after the signed-in account changes', async () => {
    await show();
    mockUserId = 'B';
    await subject.openIntercomNotification('42:reply-1');
    expect(mockPresent).not.toHaveBeenCalled();
    expect(subject.getIntercomNotification()).toBeUndefined();
  });
  it('does not show a response that arrives after foreground visibility is lost', async () => {
    await show();
    let resolve!: (value: Response) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    subject.refreshIntercomNotifications('42');
    await jest.advanceTimersByTimeAsync(0);
    await subject.setIntercomInAppMessageVisibility(false);
    resolve(new Response(JSON.stringify({ ...boot, conversations: [] })));
    await jest.advanceTimersByTimeAsync(0);
    expect(subject.getIntercomNotification()).toBeUndefined();
    await subject.openIntercomNotification('42:reply-1');
    expect(mockPresent).not.toHaveBeenCalled();
  });
  it('queues one immediate follow-up when several pushes arrive during an unread request', async () => {
    await show();
    const countUnread = () =>
      mockFetch.mock.calls.filter(([url]) =>
        url.endsWith('/conversations/unread'),
      ).length;
    const before = countUnread();
    let resolve!: (value: Response) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    subject.refreshIntercomNotifications('42');
    await jest.advanceTimersByTimeAsync(0);
    subject.refreshIntercomNotifications('42');
    subject.refreshIntercomNotifications('42');
    resolve(new Response(JSON.stringify({ ...boot, conversations: [] })));
    await jest.advanceTimersByTimeAsync(1);
    expect(countUnread()).toBe(before + 2);
  });
  it('keeps first-use anonymous polling disabled even with a notification subscriber and a push', async () => {
    mockUserId = null;
    await show();
    subject.refreshIntercomNotifications('42');
    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(subject.getIntercomNotification()).toBeUndefined();
  });
});

it('opens the shared RN route without booting a remote SDK or sending a request', async () => {
  await subject.showIntercom({ conversationId: '42' });
  expect(mockPresent).toHaveBeenCalledWith({
    userId: null,
    conversationId: '42',
    requestId: undefined,
  });
  expect(mockFetch).not.toHaveBeenCalled();
});
it('persists only the anonymous visitor and restores it on reload', async () => {
  await subject.createIntercomMessengerSession(null);
  expect(JSON.parse(mockVisitor || '{}')).toEqual({
    anonymousId: 'test-visitor',
    anonymousSession: 'test-session',
    expiresAt: 9_999_999_999_000,
  });
  jest.resetModules();
  subject = await import('./messenger');
  await subject.createIntercomMessengerSession(null);
  const body = new URLSearchParams(
    String(mockFetch.mock.calls.at(-1)?.[1]?.body),
  );
  expect(body.get('anonymous_session')).toBe('test-session');
  expect(JSON.parse(body.get('user_data') || '{}').anonymous_id).toBe(
    'test-visitor',
  );
});
it('uses the verified JWT for signed-in requests without attaching an anonymous visitor', async () => {
  mockUserId = 'A';
  mockVisitor = JSON.stringify({
    anonymousId: 'old',
    anonymousSession: 'old',
    expiresAt: 9_999_999_999_000,
  } satisfies IIntercomVisitor);
  await subject.createIntercomMessengerSession('A');
  const body = new URLSearchParams(String(mockFetch.mock.calls[0][1]?.body));
  expect(JSON.parse(body.get('user_data') || '{}')).toEqual({
    intercom_user_jwt: 'test-jwt',
    language_override: 'en',
  });
  expect(body.has('anonymous_session')).toBe(false);
  expect(mockVisitor).toBeNull();
});
it.each(['B', null])(
  'retires A before switching to %s and rejects its old session',
  async (nextUser) => {
    mockUserId = 'A';
    const session = await subject.createIntercomMessengerSession('A');
    expect(subject.getIntercomUnreadCount()).toBe(1);
    mockUserId = nextUser;
    await subject.initIntercom();
    expect(subject.getIntercomUnreadCount()).toBe(0);
    await expect(session.listConversations()).rejects.toThrow(
      'Support session changed',
    );
    expect(mockRemove).toHaveBeenCalled();
  },
);
it('fails closed when verified credentials cannot be obtained and allows retry', async () => {
  mockUserId = 'A';
  mockCredentials.mockRejectedValueOnce(new Error('offline'));
  await expect(subject.createIntercomMessengerSession('A')).rejects.toThrow(
    'offline',
  );
  expect(mockFetch).not.toHaveBeenCalled();
  await expect(
    subject.createIntercomMessengerSession('A'),
  ).resolves.toBeDefined();
});
it('rejects a JWT arriving after an account change', async () => {
  mockUserId = 'A';
  let resolve!: (value: {
    token: string;
    attributes: { userId: string };
  }) => void;
  mockCredentials.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = subject.createIntercomMessengerSession('A');
  await new Promise<void>((done) => setImmediate(done));
  mockUserId = 'B';
  resolve({ token: 'test-A', attributes: { userId: 'A' } });
  await expect(pending).rejects.toThrow('Support session changed');
  expect(mockFetch).not.toHaveBeenCalled();
});
it('aborts in-flight requests on lock and rejects late responses', async () => {
  const session = await subject.createIntercomMessengerSession(null);
  let resolve!: (response: Response) => void;
  mockFetch.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = session.listConversations();
  await new Promise<void>((done) => setImmediate(done));
  const signal = mockFetch.mock.calls.at(-1)?.[1]?.signal;
  await setLock(true);
  expect(signal?.aborted).toBe(true);
  resolve(new Response(JSON.stringify({ conversations: [] })));
  await expect(pending).rejects.toThrow('Support session changed');
  expect(subject.getIntercomUnreadCount()).toBe(0);
});
it('does not present while locked and reports a navigator that is not ready', async () => {
  await setLock(true);
  await subject.showIntercom();
  expect(mockPresent).not.toHaveBeenCalled();
  await setLock(false);
  mockPresent.mockReturnValue(false);
  await subject.showIntercom();
  expect(mockNotify).toHaveBeenCalledWith(expect.any(Error));
});
it('marks only the acknowledged conversation read', async () => {
  const session = await subject.createIntercomMessengerSession(null);
  mockFetch.mockResolvedValueOnce(new Response('{}'));
  await session.markRead('42');
  expect(subject.getIntercomUnreadCount()).toBe(0);
});

it('rejects requests beyond the auto-lock deadline before the lock UI catches up', async () => {
  const session = await subject.createIntercomMessengerSession(null);
  await setLock(false, {
    validFromMs: 0,
    lockAtMs: Date.now() - 1,
  });
  await expect(session.listConversations()).rejects.toThrow(
    'Support session changed',
  );
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('does not create an anonymous visitor until support is explicitly opened', async () => {
  jest.useFakeTimers();
  await subject.startIntercomBackgroundPolling();
  await subject.setIntercomInAppMessageVisibility(true);
  await jest.advanceTimersByTimeAsync(90_000);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockVisitor).toBeNull();
  await subject.createIntercomMessengerSession(null);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(30_000);
  expect(mockFetch.mock.calls.at(-1)?.[0]).toMatch(/conversations\/unread$/);
});

it('does not remint an expired anonymous visitor during badge polling', async () => {
  jest.useFakeTimers();
  mockVisitor = JSON.stringify({
    anonymousId: 'expired',
    anonymousSession: 'expired',
    expiresAt: Date.now() - 1,
  } satisfies IIntercomVisitor);
  await subject.startIntercomBackgroundPolling();
  await subject.setIntercomInAppMessageVisibility(true);
  await jest.advanceTimersByTimeAsync(60_000);
  expect(mockFetch).not.toHaveBeenCalled();
});

it('resumes one unread poll loop when the visible account changes', async () => {
  jest.useFakeTimers();
  mockUserId = 'A';
  mockCredentials.mockImplementation(async (user) => ({
    token: `test-${user}`,
    attributes: { userId: user },
  }));
  await subject.startIntercomBackgroundPolling();
  await subject.setIntercomInAppMessageVisibility(true);
  await jest.advanceTimersByTimeAsync(0);
  mockFetch.mockClear();
  mockUserId = 'B';
  await subject.initIntercom();
  await jest.advanceTimersByTimeAsync(0);
  const unread = mockFetch.mock.calls.filter(([url]) =>
    url.endsWith('/conversations/unread'),
  );
  expect(unread).toHaveLength(1);
  expect(
    JSON.parse(
      new URLSearchParams(String(unread[0][1]?.body)).get('user_data') || '{}',
    ),
  ).toMatchObject({ intercom_user_jwt: 'test-B' });
  await jest.advanceTimersByTimeAsync(30_000);
  expect(
    mockFetch.mock.calls.filter(([url]) =>
      url.endsWith('/conversations/unread'),
    ),
  ).toHaveLength(2);
});

it('resumes polling after an expired lock policy becomes valid without a boolean lock change', async () => {
  jest.useFakeTimers();
  await subject.createIntercomMessengerSession(null);
  await setLock(false, {
    validFromMs: 0,
    lockAtMs: Date.now() + 10_000,
  });
  await subject.startIntercomBackgroundPolling();
  await subject.setIntercomInAppMessageVisibility(true);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(30_000);
  mockFetch.mockClear();
  await setLock(false, {
    validFromMs: 0,
    lockAtMs: Date.now() + 60_000,
  });
  await jest.advanceTimersByTimeAsync(0);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch.mock.calls[0][0]).toMatch(/conversations\/unread$/);
  await jest.advanceTimersByTimeAsync(30_000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('revokes an in-memory visitor after the shared storage reference is reset', async () => {
  const old = await subject.createIntercomMessengerSession(null);
  mockStorageEpoch += 1;
  mockVisitor = null;
  await expect(old.listConversations()).rejects.toThrow(
    'Support visitor installation changed',
  );
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await subject.createIntercomMessengerSession(null);
  const body = new URLSearchParams(
    String(mockFetch.mock.calls.at(-1)?.[1]?.body),
  );
  expect(body.has('anonymous_session')).toBe(false);
});

it('binds a new anonymous client only after the previous identity storage removal completes', async () => {
  mockUserId = 'A';
  await subject.createIntercomMessengerSession('A');
  let release!: () => void;
  const removing = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockRemove.mockImplementationOnce(async () => {
    await removing;
    mockStorageEpoch += 1;
    mockVisitor = null;
  });
  mockUserId = null;
  const updating = subject.initIntercom();
  await new Promise<void>((resolve) => setImmediate(resolve));
  let opened = false;
  const opening = subject
    .createIntercomMessengerSession(null)
    .then((session) => {
      opened = true;
      return session;
    });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(opened).toBe(false);
  release();
  await updating;
  const session = await opening;
  await expect(session.listConversations()).resolves.toBeDefined();
});

it('shares a failed identity cleanup with concurrent opens and retries cleanup before booting', async () => {
  mockUserId = 'A';
  await subject.createIntercomMessengerSession('A');
  mockVisitor = JSON.stringify({
    anonymousId: 'previous-installation',
    anonymousSession: 'previous-session',
    expiresAt: 9_999_999_999_000,
  } satisfies IIntercomVisitor);
  mockFetch.mockClear();
  let fail!: (error: Error) => void;
  mockRemove.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      }),
  );
  mockUserId = null;
  const updating = subject.initIntercom();
  await new Promise<void>((resolve) => setImmediate(resolve));
  const opening = subject.createIntercomMessengerSession(null);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(mockFetch).not.toHaveBeenCalled();
  const failures = Promise.allSettled([updating, opening]);
  fail(new Error('Keychain unavailable'));
  expect(await failures).toEqual([
    { status: 'rejected', reason: new Error('Keychain unavailable') },
    { status: 'rejected', reason: new Error('Keychain unavailable') },
  ]);
  expect(mockFetch).not.toHaveBeenCalled();
  const previousRemoves = mockRemove.mock.calls.length;
  await subject.createIntercomMessengerSession(null);
  expect(mockRemove).toHaveBeenCalledTimes(previousRemoves + 1);
  const body = new URLSearchParams(String(mockFetch.mock.calls[0][1]?.body));
  expect(body.has('anonymous_session')).toBe(false);
});

it('keeps first-screen visibility, unlock, push and identity sync behind the startup polling gate', async () => {
  jest.useFakeTimers();
  mockUserId = 'A';
  await subject.setIntercomInAppMessageVisibility(true);
  await setLock(false);
  subject.refreshIntercomNotifications('42');
  await subject.initIntercom();
  await jest.advanceTimersByTimeAsync(9999);
  expect(mockCredentials).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
  await subject.startIntercomBackgroundPolling();
  await jest.advanceTimersByTimeAsync(0);
  expect(mockCredentials).toHaveBeenCalledTimes(1);
  expect(
    mockFetch.mock.calls.some(([url]) => url.endsWith('/conversations/unread')),
  ).toBe(true);
});

it('allows an explicit support open before passive polling starts', async () => {
  mockUserId = 'A';
  await subject.setIntercomInAppMessageVisibility(true);
  await subject.showIntercom();
  expect(mockPresent).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'A' }),
  );
  expect(mockPresentOptions).toHaveBeenLastCalledWith({ hasUnread: false });
  await subject.createIntercomMessengerSession('A');
  expect(mockCredentials).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

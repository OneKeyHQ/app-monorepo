import { OneKeyLocalError } from '../../errors';

import type { IIntercomVisitor } from './messengerClient';

let mockUserId: string | null = null;
let mockVisitor: string | null = null;
let mockStorageEpoch = 0;
const mockPresent = jest.fn((_route: unknown) => true);
const mockNotify = jest.fn((_error: unknown): void => {});
const mockCredentials = jest.fn(async (_user: string) => ({
  token: 'test-jwt',
  attributes: { userId: 'test' },
}));
const mockRemove = jest.fn(async () => {
  mockVisitor = null;
});
jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('../../utils/miscUtils', () => ({ generateUUID: () => 'test-uuid' }));
jest.mock('./identity', () => ({
  getCurrentIntercomUserId: async () => mockUserId,
  getIntercomCredentials: (user: string) => mockCredentials(user),
}));
jest.mock('./utils', () => ({
  ...jest.requireActual<typeof import('./utils')>('./utils'),
  getIntercomLanguageOverride: async () => 'en',
}));
jest.mock('./visitorStorage', () => ({
  intercomVisitorStorageKey: 'test-visitor-key',
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
    get: async () => mockVisitor,
    set: async (_key: string, value: string) => {
      mockVisitor = value;
    },
    remove: () => mockRemove(),
  },
}));
jest.mock('./supportUi', () => ({
  presentIntercomSupportUi: (route: unknown) => mockPresent(route),
}));
jest.mock('./openFailure', () => ({
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
    new Response(JSON.stringify(boot), { status: 200 }),
);
let subject: typeof import('./messenger');
beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  mockUserId = null;
  mockVisitor = null;
  mockStorageEpoch = 0;
  mockRemove.mockImplementation(async () => {
    mockVisitor = null;
  });
  mockPresent.mockReturnValue(true);
  mockCredentials.mockImplementation(async () => ({
    token: 'test-jwt',
    attributes: { userId: 'test' },
  }));
  mockFetch.mockImplementation(
    async () => new Response(JSON.stringify(boot), { status: 200 }),
  );
  globalThis.fetch = mockFetch as typeof fetch;
  subject = await import('./messenger');
});
afterEach(async () => {
  await subject.setIntercomInAppMessageVisibility(false);
  await subject.setIntercomMessengerLocked(true);
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
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
    await expect(session.request('conversations')).rejects.toThrow(
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
  const pending = session.request('conversations');
  await new Promise<void>((done) => setImmediate(done));
  const signal = mockFetch.mock.calls.at(-1)?.[1]?.signal;
  await subject.setIntercomMessengerLocked(true);
  expect(signal?.aborted).toBe(true);
  resolve(new Response(JSON.stringify({ conversations: [] })));
  await expect(pending).rejects.toThrow('Support session changed');
  expect(subject.getIntercomUnreadCount()).toBe(0);
});
it('does not present while locked and reports a navigator that is not ready', async () => {
  await subject.setIntercomMessengerLocked(true);
  await subject.showIntercom();
  expect(mockPresent).not.toHaveBeenCalled();
  await subject.setIntercomMessengerLocked(false);
  mockPresent.mockReturnValue(false);
  await subject.showIntercom();
  expect(mockNotify).toHaveBeenCalledWith(expect.any(Error));
});
it('marks only the acknowledged conversation read', async () => {
  const session = await subject.createIntercomMessengerSession(null);
  mockFetch.mockResolvedValueOnce(new Response('{}'));
  await session.request('conversations/42/read');
  expect(subject.getIntercomUnreadCount()).toBe(0);
});

it('rejects requests beyond the auto-lock deadline before the lock UI catches up', async () => {
  const session = await subject.createIntercomMessengerSession(null);
  await subject.setIntercomMessengerLocked(false, {
    validFromMs: 0,
    lockAtMs: Date.now() - 1,
  });
  await expect(session.request('conversations')).rejects.toThrow(
    'Support session changed',
  );
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('does not create an anonymous visitor until support is explicitly opened', async () => {
  jest.useFakeTimers();
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
  await subject.setIntercomMessengerLocked(false, {
    validFromMs: 0,
    lockAtMs: Date.now() + 10_000,
  });
  await subject.setIntercomInAppMessageVisibility(true);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(30_000);
  mockFetch.mockClear();
  await subject.setIntercomMessengerLocked(false, {
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
  await expect(old.request('conversations')).rejects.toThrow(
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
  await expect(session.request('conversations')).resolves.toBeDefined();
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

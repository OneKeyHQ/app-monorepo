const mockItems = new Map<string, string>();
let mockSequence = 0;
const mockSet = jest.fn(async (key: string, value: string) => {
  mockItems.set(key, value);
});
const mockGet = jest.fn(async (key: string) => mockItems.get(key) ?? null);

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('../../utils/miscUtils', () => ({
  generateUUID: () => {
    mockSequence += 1;
    return `test-browser-${mockSequence}`;
  },
}));
jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGet(key),
    setItem: (key: string, value: string) => mockSet(key, value),
    removeItem: async (key: string) => {
      mockItems.delete(key);
    },
  },
}));
jest.mock('./identity', () => ({
  getCurrentIntercomUserId: async () => null,
  getIntercomCredentials: async () => undefined,
}));
jest.mock('./utils', () => ({
  ...jest.requireActual<typeof import('./utils')>('./utils'),
  getIntercomLanguageOverride: async () => 'en',
}));
jest.mock('./supportUi', () => ({ presentIntercomSupportUi: jest.fn() }));
jest.mock('./openFailure', () => ({ notifyIntercomOpenFailed: jest.fn() }));

const legacyVisitor = JSON.stringify({
  anonymousId: 'test-old-visitor',
  anonymousSession: 'test-old-session',
  expiresAt: 9_999_999_999_000,
});
const originalFetch = globalThis.fetch;
let subject: typeof import('./visitorStorage');
beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  mockItems.clear();
  mockSequence = 0;
  mockSet.mockImplementation(async (key, value) => {
    mockItems.set(key, value);
  });
  mockGet.mockImplementation(async (key) => mockItems.get(key) ?? null);
  subject = await import('./visitorStorage');
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('restores a scoped visitor after a normal browser reload', async () => {
  const key = subject.intercomVisitorStorageKey;
  const binding = await subject.bindVisitorStorage(key);
  await binding.set(legacyVisitor);
  expect(mockItems.get(key)).toMatch(/-ref-test-browser-/);
  jest.resetModules();
  const reloaded = await import('./visitorStorage');
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
  const otherWindow = await import('./visitorStorage');
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
    const otherWindow = await import('./visitorStorage');
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

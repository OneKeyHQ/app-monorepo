import { createMessengerClient } from './messengerClient';
import { parseIntercomOpen } from './messengerModels';

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('../../utils/miscUtils', () => ({
  generateUUID: () => 'request-id',
}));
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn(
  async (_url: string, _options?: RequestInit) =>
    new Response(JSON.stringify({ user: { id: 'A' }, id: '42', cards: [] })),
);
beforeEach(() => {
  fetchMock
    .mockReset()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ user: { id: 'A' }, id: '42', cards: [] }),
        ),
    );
  globalThis.fetch = fetchMock as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});
const client = () =>
  createMessengerClient({
    appId: 'test',
    assertCurrent: async () => {},
    getIdentity: async () => ({ token: 'test-jwt', language: 'en' }),
    loadVisitor: async () => undefined,
    saveVisitor: async () => {},
    onUnread: () => {},
  });
it('coalesces concurrent initialization and encodes a stable message id for retries', async () => {
  const api = client();
  await Promise.all([api.boot(), api.boot()]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await api.api.createConversation({
    open: parseIntercomOpen({ new_conversation: { cta: { text: 'Send' } } }),
    message: {
      clientId: 'message-id',
      blocks: [{ type: 'paragraph', text: 'test' }],
    },
  });
  const body = new URLSearchParams(String(fetchMock.mock.calls[1][1]?.body));
  expect(body.get('Idempotency-Key')).toBe('message-id');
  expect(JSON.parse(body.get('blocks') || '[]')).toEqual([
    { type: 'paragraph', text: 'test' },
  ]);
  expect(fetchMock.mock.calls[1][1]?.credentials).toBe('omit');
});
it('never automatically retries an unacknowledged send', async () => {
  const api = client();
  await api.boot();
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await expect(
    api.api.createConversation({
      open: parseIntercomOpen({ new_conversation: { cta: { text: 'Send' } } }),
      message: { clientId: 'message-id', blocks: [] },
    }),
  ).rejects.toThrow('offline');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it.each(['https://example.com', '../messages', 'conversations/../1', 'admins'])(
  'rejects ids outside the conversation contract: %s',
  async (path) => {
    const api = client();
    await api.boot();
    await expect(api.api.getConversation(path)).rejects.toThrow(
      'Invalid support conversation',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);
it('does not expose response bodies containing credentials in errors', async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ errors: [{ message: 'secret-test-token' }] }),
      { status: 401 },
    ),
  );
  await expect(client().boot()).rejects.toThrow('Support request failed (401)');
});

it('refreshes authentication on an explicit retry after expiry without replaying the failed mutation', async () => {
  const api = client();
  await api.boot();
  fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
  await expect(
    api.api.createConversation({
      open: parseIntercomOpen({ new_conversation: { cta: { text: 'Send' } } }),
      message: { clientId: 'stable-id', blocks: [] },
    }),
  ).rejects.toThrow('(401)');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await api.api.createConversation({
    open: parseIntercomOpen({ new_conversation: { cta: { text: 'Send' } } }),
    message: { clientId: 'stable-id', blocks: [] },
  });
  expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    '/messenger/web/ping',
    '/messenger/web/messages',
    '/messenger/web/ping',
    '/messenger/web/messages',
  ]);
});

it('preserves support request context once per client without exposing it in a URL', async () => {
  const api = client();
  const metadata = { instanceId: 'test-install', requestId: 'test-order' };
  await Promise.all([api.setContext(metadata), api.setContext(metadata)]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [url, options] = fetchMock.mock.calls[1];
  expect(url).toBe('https://api-iam.intercom.io/messenger/web/events');
  expect(
    JSON.parse(
      new URLSearchParams(String(options?.body)).get('event_list') || '{}',
    ),
  ).toEqual({ data: [{ event_name: 'client info', metadata }] });
});

it('drops an expired anonymous session from memory and storage before refreshing', async () => {
  const now = 1_700_000_000_000;
  const time = jest.spyOn(Date, 'now').mockReturnValue(now);
  const visitor = {
    anonymousId: 'old-visitor',
    anonymousSession: 'old-session',
    expiresAt: now + 120_000,
  };
  const saveVisitor = jest.fn(async () => {});
  const api = createMessengerClient({
    appId: 'test',
    assertCurrent: async () => {},
    getIdentity: async () => ({ language: 'en' }),
    loadVisitor: async () => visitor,
    saveVisitor,
    onUnread: () => {},
  });
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        user: { id: 'old', anonymous_id: visitor.anonymousId },
        anonymous_session: visitor.anonymousSession,
        session_expiry: visitor.expiresAt / 1000,
      }),
    ),
  );
  await api.boot();
  expect(
    new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body)).get(
      'anonymous_session',
    ),
  ).toBe('old-session');
  time.mockReturnValue(visitor.expiresAt);
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        user: { id: 'new', anonymous_id: 'new-visitor' },
        anonymous_session: 'new-session',
        session_expiry: (now + 3_600_000) / 1000,
      }),
    ),
  );
  await api.api.getHome();
  const ping = new URLSearchParams(String(fetchMock.mock.calls[1][1]?.body));
  expect(ping.has('anonymous_session')).toBe(false);
  expect(JSON.parse(ping.get('user_data') || '{}')).toEqual({
    language_override: 'en',
  });
  expect(saveVisitor).toHaveBeenLastCalledWith({
    anonymousId: 'new-visitor',
    anonymousSession: 'new-session',
    expiresAt: now + 3_600_000,
  });
  expect(
    new URLSearchParams(String(fetchMock.mock.calls[2][1]?.body)).get(
      'anonymous_session',
    ),
  ).toBe('new-session');
});

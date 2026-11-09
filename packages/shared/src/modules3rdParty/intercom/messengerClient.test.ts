import { createMessengerClient } from './messengerClient';

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('../../utils/miscUtils', () => ({
  generateUUID: () => 'request-id',
}));
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn(
  async (_url: string, _options?: RequestInit) =>
    new Response(JSON.stringify({ user: { id: 'A' } })),
);
beforeEach(() => {
  fetchMock
    .mockReset()
    .mockImplementation(
      async () => new Response(JSON.stringify({ user: { id: 'A' } })),
    );
  globalThis.fetch = fetchMock as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
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
  await api.request('messages', {
    client_assigned_uuid: 'message-id',
    blocks: [{ type: 'paragraph', text: 'test' }],
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
    api.request('messages', { client_assigned_uuid: 'message-id' }),
  ).rejects.toThrow('offline');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it.each(['https://example.com', '../messages', 'conversations/../1', 'admins'])(
  'rejects paths outside the end-user contract: %s',
  async (path) => {
    const api = client();
    await api.boot();
    await expect(api.request(path)).rejects.toThrow(
      'Unsupported support operation',
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
    api.request('messages', { client_assigned_uuid: 'stable-id' }),
  ).rejects.toThrow('(401)');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await api.request('messages', { client_assigned_uuid: 'stable-id' });
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

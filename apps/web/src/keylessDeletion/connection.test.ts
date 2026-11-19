import { createDeletionTransport } from './connection';

const local = new URL('http://127.0.0.1:3003/keyless-deletion');
const testSite = new URL('https://app.onekeytest.com/keyless-deletion');
const prodSite = new URL('https://app.onekey.so/keyless-deletion');
const testPrime = 'https://prime.onekeytest.com';
const prodPrime = 'https://prime.onekeycn.com';
const enabled = { enabled: true, settings: { enableTestEndpoint: true } };
const disabled = { enabled: false, settings: { enableTestEndpoint: true } };

it.each([
  [local, enabled, testPrime],
  [local, disabled, prodPrime],
  [
    local,
    { enabled: true, settings: { enableTestEndpoint: false } },
    prodPrime,
  ],
  [testSite, disabled, testPrime],
  [prodSite, enabled, prodPrime],
])('selects the configured Prime on %s with %j', (page, settings, expected) => {
  expect(createDeletionTransport(page, settings)?.apiOrigin).toBe(expected);
});

it('permits only supported POSTs to the selected Prime host with isolated fetch options', async () => {
  const send = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  send.mockResolvedValue(new Response());
  const transport = createDeletionTransport(local, enabled, send)?.transport;
  if (!transport) throw new TypeError('Expected loopback transport');
  const path = '/prime/v1/keyless-deletion/link-info';
  const request = new Request(testPrime + path, { method: 'POST' });
  await expect(transport(request)).resolves.toBeInstanceOf(Response);
  expect(send).toHaveBeenCalledWith(request, {
    credentials: 'omit',
    mode: 'cors',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
  });
  for (const candidate of [
    new Request(prodPrime + path, { method: 'POST' }),
    new Request(testPrime + path),
    new Request(`${testPrime + path}?env=prod`, { method: 'POST' }),
    new Request(`${testPrime + path}#other`, { method: 'POST' }),
    new Request(`${testPrime}/prime/v1/other`, { method: 'POST' }),
  ]) {
    expect(() => transport(candidate)).toThrow('Invalid deletion API request.');
  }
  expect(send).toHaveBeenCalledTimes(1);
});

it('rejects unrecognized web origins and disables loopback in production builds', () => {
  expect(
    createDeletionTransport(new URL('https://example.invalid'), enabled),
  ).toBeUndefined();
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    expect(createDeletionTransport(local, enabled)).toBeUndefined();
    expect(createDeletionTransport(prodSite, enabled)?.apiOrigin).toBe(
      prodPrime,
    );
  } finally {
    process.env.NODE_ENV = original;
  }
});

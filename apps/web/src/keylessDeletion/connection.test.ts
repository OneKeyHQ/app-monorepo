import { updateWebAppLocalePreference } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';

import { createDeletionTransport } from './connection';
import { createLocalePreference } from './localePreference';
import {
  API_BASE,
  CONFIRMATION_VERSION,
  CURRENT_SHARE_CAPABILITY,
  DELETION_SCOPE,
  RESULT_CAPABILITY_HEADER,
  RETAINED_SCOPE,
  WARNING_CODES,
  createDeletionClient,
} from './protocol';

jest.mock('@onekeyhq/kit-bg/src/states/jotai/jotaiStorage', () => ({
  getTravelModeSettingsControlState: jest.fn(),
  updateWebAppLocalePreference: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/locale/getDefaultLocale', () => ({
  getDefaultLocale: () => 'zh-CN',
}));

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
  const transport = createDeletionTransport(local, enabled, {
    send,
  })?.transport;
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
    headers: expect.any(Headers),
  });
  expect(
    new Headers(send.mock.calls[0]?.[1]?.headers).get(
      'X-Onekey-Request-Locale',
    ),
  ).toBe('zh-cn');
  for (const candidate of [
    new Request(prodPrime + path, { method: 'POST' }),
    new Request(testPrime + path),
    new Request(`${testPrime + path}?env=prod`, { method: 'POST' }),
    new Request(`${testPrime + path}#other`, { method: 'POST' }),
    new Request(`${testPrime}/prime/v1/other`, { method: 'POST' }),
    new Request(testPrime + path, {
      method: 'POST',
      headers: { Authorization: 'fixture-not-allowed' },
    }),
  ]) {
    expect(() => transport(candidate)).toThrow('Invalid deletion API request.');
  }
  expect(send).toHaveBeenCalledTimes(1);
});

it('uses the current saved App locale on all four requests without recreating the client', async () => {
  const preference = createLocalePreference('system');
  const time = '2030-01-01T00:00:00Z';
  const expiresAt = '2030-01-01T00:05:00Z';
  const receipt = {
    status: 'completed',
    resultId: 'fixture-operation',
    supportReference: 'TEST-CASE',
    completedAt: time,
    deletedScope: [DELETION_SCOPE],
    retainedScope: [...RETAINED_SCOPE],
  };
  const info = {
    status: 'ready',
    allowedProvider: 'google',
    serverTime: time,
    expiresAt,
    confirmationVersion: CONFIRMATION_VERSION,
    deletionScope: [DELETION_SCOPE],
    retainedScope: [...RETAINED_SCOPE],
    warningCodes: [...WARNING_CODES],
    recreationPolicy: 'allowed_new_wallet',
  };
  const otp = {
    challengeId: 'fixture-challenge',
    maskedEmail: 'd***@example.invalid',
    expiresAt,
    serverTime: time,
    resendAfterSeconds: 60,
  };
  const captured: Request[] = [];
  const send: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    captured.push(request);
    const route = new URL(request.url).pathname.slice(API_BASE.length);
    let data: unknown = receipt;
    if (route === '/link-info') data = info;
    else if (route === '/otp/send') data = otp;
    return Response.json({ code: 0, message: '', data });
  };
  const connection = createDeletionTransport(testSite, enabled, {
    send,
    getLocalePreference: preference.get,
  });
  if (!connection) throw new TypeError('Expected test transport');
  const client = createDeletionClient(connection.transport, {
    origin: connection.apiOrigin,
  });
  const proof = {
    invitationToken: 'fixture-invite',
    provider: 'google' as const,
    supabaseAccessToken: 'fixture-proof',
  };
  await client.getLinkInfo(proof.invitationToken);
  await client.sendDeletionOtp(proof);
  const japanese = await preference.change('ja-JP');
  await expect(japanese?.persisted).resolves.toBe(true);
  expect(updateWebAppLocalePreference).toHaveBeenCalledWith('ja-JP');
  await client.deleteShare(
    {
      ...proof,
      challengeId: otp.challengeId,
      code: '01234567',
      confirmationVersion: CONFIRMATION_VERSION,
      acknowledgements: [...WARNING_CODES],
    },
    'fixture-idempotency',
  );
  await client.getResult(proof);
  expect(
    captured.map((request) =>
      new URL(request.url).pathname.slice(API_BASE.length),
    ),
  ).toEqual(['/link-info', '/otp/send', '/delete', '/result']);
  expect(
    captured.map((request) => request.headers.get('x-onekey-request-locale')),
  ).toEqual(['zh-cn', 'zh-cn', 'ja-jp', 'ja-jp']);
  const individualHeaders = [
    [],
    [],
    ['idempotency-key'],
    ['x-onekey-keyless-result'],
  ];
  for (const [index, request] of captured.entries()) {
    expect([...request.headers.keys()].toSorted()).toEqual(
      [
        'accept',
        'content-type',
        'x-onekey-request-locale',
        ...individualHeaders[index],
      ].toSorted(),
    );
    expect(request.credentials).toBe('omit');
    expect(request.redirect).toBe('error');
    expect(request.referrerPolicy).toBe('no-referrer');
    expect(request.cache).toBe('no-store');
  }
  expect(captured[2].headers.get('idempotency-key')).toBe(
    'fixture-idempotency',
  );
  expect(captured[3].headers.get(RESULT_CAPABILITY_HEADER)).toBe(
    CURRENT_SHARE_CAPABILITY,
  );
  expect(await captured[3].json()).toEqual(proof);

  const automatic = await preference.change('system');
  await expect(automatic?.persisted).resolves.toBe(true);
  expect(updateWebAppLocalePreference).toHaveBeenLastCalledWith('system');
  await client.getResult(proof);
  expect(captured[4].headers.get('x-onekey-request-locale')).toBe('zh-cn');
  expect(captured.filter(({ url }) => url.endsWith('/link-info'))).toHaveLength(
    1,
  );
});

it('does not report a network failure as a successful Prime request', async () => {
  const send = jest
    .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    .mockRejectedValue(new TypeError('fixture network failure'));
  const connection = createDeletionTransport(testSite, enabled, {
    send,
    getLocalePreference: () => 'ja-JP',
  });
  if (!connection) throw new TypeError('Expected test transport');
  const client = createDeletionClient(connection.transport, {
    origin: connection.apiOrigin,
  });
  await expect(client.getLinkInfo('fixture-invite')).rejects.toThrow(
    'fixture network failure',
  );
  expect(send).toHaveBeenCalledTimes(1);
});

it('uses the selected locale on the same request client when saving App settings fails', async () => {
  const preference = createLocalePreference('en');
  const send = jest
    .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    .mockResolvedValue(new Response());
  const transport = createDeletionTransport(testSite, enabled, {
    send,
    getLocalePreference: preference.get,
  })?.transport;
  if (!transport) throw new TypeError('Expected test transport');
  const request = () =>
    new Request(`${testPrime + API_BASE}/link-info`, { method: 'POST' });

  jest
    .mocked(updateWebAppLocalePreference)
    .mockRejectedValueOnce(new TypeError('test settings unavailable'));
  const selected = await preference.change('ja-JP');
  await expect(selected?.persisted).resolves.toBe(false);
  expect(preference.get()).toBe('ja-JP');
  await transport(request());
  expect(
    new Headers(send.mock.calls[0]?.[1]?.headers).get(
      'X-Onekey-Request-Locale',
    ),
  ).toBe('ja-jp');
});

it('applies later choices during a stalled save and persists only the latest queued language afterwards', async () => {
  const preference = createLocalePreference('en');
  const writes: string[] = [];
  let finishFirstWrite = () => {};
  const firstWrite = new Promise<void>((resolve) => {
    finishFirstWrite = resolve;
  });
  const save = jest.mocked(updateWebAppLocalePreference);
  save.mockImplementationOnce(async (locale) => {
    await firstWrite;
    writes.push(locale);
  });
  save.mockImplementationOnce(async (locale) => {
    writes.push(locale);
  });

  const first = await preference.change('ja-JP');
  expect(preference.get()).toBe('ja-JP');
  const second = await preference.change('de');
  const latest = await preference.change('system');
  expect(preference.get()).toBe('system');
  expect(first?.isCurrent()).toBe(false);
  expect(second?.isCurrent()).toBe(false);
  expect(latest?.isCurrent()).toBe(true);
  expect(writes).toEqual([]);

  finishFirstWrite();
  await expect(latest?.persisted).resolves.toBe(true);
  expect(writes).toEqual(['ja-JP', 'system']);
  expect(preference.get()).toBe('system');
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

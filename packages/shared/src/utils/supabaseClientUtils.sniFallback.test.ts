import { OneKeyLocalError } from '../errors';

import type { ISniRequestConfig, ISniResponse } from '../request/types/ipTable';

const mockCreateClient = jest.fn(
  (_url: unknown, _key: unknown, _options: unknown) => ({}),
);
const mockSniRequest = jest.fn<
  Promise<ISniResponse | null>,
  [ISniRequestConfig, unknown]
>();
const mockIsProxyActiveForUrl = jest.fn<Promise<boolean | null>, [string]>();
const mockIsSniSupported = jest.fn(() => true);
const mockGetDevSettingsPersistAtom = jest.fn<Promise<unknown>, []>();
const mockGetIpTableConfig = jest.fn<Promise<unknown>, []>();
const mockLogInfo = jest.fn((_payload: { info: string }) => undefined);

jest.mock('@supabase/supabase-js', () => ({
  createClient: (url: unknown, key: unknown, options: unknown) =>
    mockCreateClient(url, key, options),
}));

jest.mock(
  '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance',
  () => ({
    __esModule: true,
    default: {},
  }),
);

jest.mock('../request/helpers/sniRequest', () => ({
  isProxyActiveForUrl: (url: string) => mockIsProxyActiveForUrl(url),
  isSniSupported: () => mockIsSniSupported(),
  sniRequest: (config: ISniRequestConfig, options: unknown) =>
    mockSniRequest(config, options),
}));

jest.mock('../request/requestHelper', () => ({
  __esModule: true,
  default: {
    getDevSettingsPersistAtom: () => mockGetDevSettingsPersistAtom(),
    getIpTableConfig: () => mockGetIpTableConfig(),
  },
}));

jest.mock('./ipTableUtils', () => ({
  ...jest.requireActual<typeof import('./ipTableUtils')>('./ipTableUtils'),
  isSupportIpTablePlatform: () => true,
}));

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: (payload: { info: string }) => mockLogInfo(payload),
      },
    },
  },
}));

const REFRESH_URL =
  'https://auth.onekey.so/auth/v1/token?grant_type=refresh_token';
// The production table without its Cloudflare endpoints, spread by provider.
const FIRST_IP = '216.19.3.115';
const SECOND_IP = '43.168.19.96';
const THIRD_IP = '216.19.2.116';

function networkError() {
  return new TypeError('Network request failed');
}

function sniOk(body = '{"access_token":"a"}'): ISniResponse {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body,
  };
}

function refreshInit(): RequestInit {
  return {
    method: 'POST',
    headers: new Headers({
      apikey: 'public-key',
      Authorization: 'Bearer session-token',
    }),
    body: '{"refresh_token":"r"}',
  };
}

function getSniIps(): string[] {
  return mockSniRequest.mock.calls.map(([config]) => config.ip);
}

describe('supabase SNI fallback', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // The route is module state: every test starts on the domain.
    jest.resetModules();
    jest.clearAllMocks();
    mockIsSniSupported.mockReturnValue(true);
    mockIsProxyActiveForUrl.mockResolvedValue(false);
    mockGetDevSettingsPersistAtom.mockResolvedValue({ settings: {} });
    mockGetIpTableConfig.mockResolvedValue(null);
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function getGuardedFetch(): Promise<typeof fetch> {
    const { getKeylessSupabaseClient } = await import('./supabaseClientUtils');
    getKeylessSupabaseClient();
    const options = mockCreateClient.mock.calls[0]?.[2] as
      | { global?: { fetch?: typeof fetch } }
      | undefined;
    if (!options?.global?.fetch) {
      throw new OneKeyLocalError('Supabase guarded fetch was not configured');
    }
    return options.global.fetch;
  }

  // Leaves the module on the first IP-table candidate.
  async function failDomainOnce(guardedFetch: typeof fetch) {
    mockFetch.mockRejectedValueOnce(networkError());
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      'Network request failed',
    );
  }

  test('uses the domain untouched while it works', async () => {
    const response = new Response('{}', { status: 200 });
    mockFetch.mockResolvedValue(response);
    const guardedFetch = await getGuardedFetch();
    const init = refreshInit();

    await expect(guardedFetch(REFRESH_URL, init)).resolves.toBe(response);
    await expect(guardedFetch(REFRESH_URL, init)).resolves.toBe(response);

    expect(mockFetch).toHaveBeenNthCalledWith(1, REFRESH_URL, init);
    expect(mockSniRequest).not.toHaveBeenCalled();
    expect(mockIsProxyActiveForUrl).not.toHaveBeenCalled();
  });

  test('rejects the failed domain request as is and sends the next one to the first candidate', async () => {
    const domainError = networkError();
    mockFetch.mockRejectedValueOnce(domainError);
    mockSniRequest.mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();

    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toBe(
      domainError,
    );
    expect(mockSniRequest).not.toHaveBeenCalled();

    const response = await guardedFetch(REFRESH_URL, refreshInit());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    await expect(response.json()).resolves.toEqual({ access_token: 'a' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockSniRequest).toHaveBeenCalledTimes(1);
    expect(mockSniRequest).toHaveBeenCalledWith(
      {
        ip: FIRST_IP,
        hostname: 'auth.onekey.so',
        path: '/auth/v1/token?grant_type=refresh_token',
        method: 'POST',
        headers: {
          apikey: 'public-key',
          authorization: 'Bearer session-token',
        },
        body: '{"refresh_token":"r"}',
        timeout: 10_000,
      },
      undefined,
    );
    expect(mockIsProxyActiveForUrl).toHaveBeenCalledWith(
      'https://auth.onekey.so',
    );
  });

  test('never replays a failed SNI request and rotates through the candidates back to the domain', async () => {
    mockSniRequest.mockRejectedValue(
      Object.assign(new Error('SNI_TLS_FAILED: 216.19.3.115'), {
        code: 'SNI_TLS_FAILED',
      }),
    );
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    for (const expectedIps of [
      [FIRST_IP],
      [FIRST_IP, SECOND_IP],
      [FIRST_IP, SECOND_IP, THIRD_IP],
    ]) {
      const failure = guardedFetch(REFRESH_URL, refreshInit());
      await expect(failure).rejects.toBeInstanceOf(TypeError);
      // The transport detail (which may name the IP) is not passed on.
      await expect(failure).rejects.toThrow(/^Network request failed$/);
      expect(getSniIps()).toEqual(expectedIps);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }

    const response = new Response('{}', { status: 200 });
    mockFetch.mockResolvedValueOnce(response);
    await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
      response,
    );
    expect(mockSniRequest).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('keeps the candidate that works', async () => {
    mockSniRequest
      .mockRejectedValueOnce(new Error('SNI_REQUEST_TIMEOUT'))
      .mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      'Network request failed',
    );

    await guardedFetch(REFRESH_URL, refreshInit());
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, SECOND_IP]);
  });

  test('advances once when concurrent requests fail on the same candidate', async () => {
    mockSniRequest
      .mockRejectedValueOnce(new Error('SNI_REQUEST_FAILED'))
      .mockRejectedValueOnce(new Error('SNI_REQUEST_FAILED'))
      .mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    await Promise.allSettled([
      guardedFetch(REFRESH_URL, refreshInit()),
      guardedFetch(REFRESH_URL, refreshInit()),
    ]);
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP, SECOND_IP]);
  });

  test('treats an empty SNI result as a failure', async () => {
    mockSniRequest.mockResolvedValueOnce(null).mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      'Network request failed',
    );
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP]);
  });

  test('returns any HTTP status from the IP route as the final answer', async () => {
    mockSniRequest.mockResolvedValue({
      statusCode: 400,
      headers: { 'content-type': 'application/json' },
      body: '{"code":"bad_jwt"}',
    });
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    const response = await guardedFetch('https://auth.onekey.so/auth/v1/user', {
      headers: { apikey: 'public-key' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: 'bad_jwt' });
    // A body-less GET is still sent over SNI, and the candidate is kept.
    expect(mockSniRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ip: FIRST_IP,
        method: 'GET',
        path: '/auth/v1/user',
        headers: { apikey: 'public-key' },
        body: null,
      }),
      undefined,
    );
    await guardedFetch('https://auth.onekey.so/auth/v1/user');
    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
  });

  test('builds a body-less response for 204', async () => {
    mockSniRequest.mockResolvedValue({
      statusCode: 204,
      headers: {},
      body: '',
    });
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    const response = await guardedFetch(
      'https://auth.onekey.so/auth/v1/logout',
      { method: 'POST', headers: [['apikey', 'public-key']] },
    );

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
    expect(mockSniRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        headers: { apikey: 'public-key' },
        body: null,
      }),
      undefined,
    );
  });

  test('leaves other hosts on the domain even after failures', async () => {
    mockFetch.mockRejectedValue(networkError());
    const guardedFetch = await getGuardedFetch();

    for (const url of [
      'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
      'https://auth.onekey.so.example.com/auth/v1/user',
      'http://auth.onekey.so/auth/v1/user',
      'https://auth.onekey.so:8443/auth/v1/user',
    ]) {
      await expect(guardedFetch(url, refreshInit())).rejects.toThrow(
        'Network request failed',
      );
      await expect(guardedFetch(url, refreshInit())).rejects.toThrow(
        'Network request failed',
      );
    }

    expect(mockFetch).toHaveBeenCalledTimes(8);
    expect(mockSniRequest).not.toHaveBeenCalled();
  });

  test.each([
    [
      'a system proxy is active',
      () => mockIsProxyActiveForUrl.mockResolvedValue(true),
    ],
    [
      'the proxy preflight fails',
      () => mockIsProxyActiveForUrl.mockRejectedValue(new Error('preflight')),
    ],
    [
      'the IP table is disabled in dev settings',
      () =>
        mockGetDevSettingsPersistAtom.mockResolvedValue({
          settings: { disableIpTableInProd: true },
        }),
    ],
    [
      'the IP table runtime is disabled',
      () =>
        mockGetIpTableConfig.mockResolvedValue({
          config: { domains: {} },
          runtime: { enabled: false },
        }),
    ],
  ])('goes back to the domain when %s', async (_name, arrange) => {
    arrange();
    const response = new Response('{}', { status: 200 });
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);
    mockFetch.mockResolvedValue(response);

    await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
      response,
    );

    expect(mockSniRequest).not.toHaveBeenCalled();
  });

  test('keeps using SNI when the platform has no proxy preflight', async () => {
    mockIsProxyActiveForUrl.mockResolvedValue(null);
    mockSniRequest.mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP]);
  });

  test('sends requests the SNI transport cannot carry to the domain', async () => {
    const response = new Response('{}', { status: 200 });
    mockSniRequest.mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);
    mockFetch.mockResolvedValue(response);

    await expect(
      guardedFetch(REFRESH_URL, {
        method: 'POST',
        body: new URLSearchParams({ refresh_token: 'r' }),
      }),
    ).resolves.toBe(response);
    await expect(
      guardedFetch(new Request(REFRESH_URL, { method: 'POST' })),
    ).resolves.toBe(response);

    expect(mockSniRequest).not.toHaveBeenCalled();
    // The route itself is unchanged for requests it can carry.
    await guardedFetch(REFRESH_URL, refreshInit());
    expect(getSniIps()).toEqual([FIRST_IP]);
  });

  test('does nothing on platforms without the SNI transport', async () => {
    mockIsSniSupported.mockReturnValue(false);
    mockFetch.mockRejectedValue(networkError());
    const guardedFetch = await getGuardedFetch();

    await failDomainOnce(guardedFetch);
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      'Network request failed',
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSniRequest).not.toHaveBeenCalled();
  });

  test('does not change the route when the caller aborted', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementationOnce(async () => {
      controller.abort();
      throw new OneKeyLocalError('aborted');
    });
    const response = new Response('{}', { status: 200 });
    mockFetch.mockResolvedValue(response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch(REFRESH_URL, {
        ...refreshInit(),
        signal: controller.signal,
      }),
    ).rejects.toThrow('aborted');
    await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
      response,
    );

    expect(mockSniRequest).not.toHaveBeenCalled();
  });

  test('rejects with AbortError and keeps the candidate when aborted during SNI', async () => {
    const controller = new AbortController();
    mockSniRequest
      .mockImplementationOnce(async () => {
        controller.abort();
        throw new OneKeyLocalError('SNI_CANCELLED: Request cancelled');
      })
      .mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    await expect(
      guardedFetch(REFRESH_URL, {
        ...refreshInit(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockSniRequest).toHaveBeenLastCalledWith(expect.anything(), {
      signal: controller.signal,
    });
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
  });

  test('still masks an intermediary error page from the IP route and moves on from that candidate', async () => {
    mockSniRequest.mockResolvedValueOnce({
      statusCode: 403,
      headers: { 'content-type': 'text/html', server: 'cloudflare' },
      body: '<!DOCTYPE html><title>Attention Required</title>',
    });
    mockSniRequest.mockResolvedValueOnce({
      statusCode: 502,
      headers: {},
      body: '',
    });
    mockSniRequest.mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      /Supabase non-JSON HTTP 403 .*server=cloudflare/,
    );
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      /Supabase transient HTTP 502/,
    );
    await guardedFetch(REFRESH_URL, refreshInit());

    // Each request was sent once; the page-serving candidates were left.
    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, THIRD_IP]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('keeps the candidate on a JSON error, which is the auth server answering', async () => {
    mockSniRequest.mockResolvedValue({
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: '{"code":"unexpected_failure"}',
    });
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      /Supabase transient HTTP 500/,
    );
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      /Supabase transient HTTP 500/,
    );

    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
  });

  test('a failure on another host leaves auth.onekey.so on the domain', async () => {
    const response = new Response('{}', { status: 200 });
    const guardedFetch = await getGuardedFetch();
    mockFetch.mockRejectedValueOnce(networkError());
    await expect(
      guardedFetch(
        'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
        refreshInit(),
      ),
    ).rejects.toThrow('Network request failed');
    mockFetch.mockResolvedValue(response);

    await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
      response,
    );

    expect(mockSniRequest).not.toHaveBeenCalled();
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  test('keeps the candidate order when the IP table preference or environment changes', async () => {
    const { DEFAULT_IP_TABLE_CONFIG } =
      await import('../request/constants/ipTableDefaults');
    mockGetDevSettingsPersistAtom.mockResolvedValue({
      enabled: true,
      settings: { enableTestEndpoint: true },
    });
    mockSniRequest
      .mockRejectedValueOnce(new OneKeyLocalError('SNI_REQUEST_FAILED'))
      .mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      'Network request failed',
    );
    await guardedFetch(REFRESH_URL, refreshInit());

    // A speed test now prefers another endpoint for the API hosts.
    mockGetIpTableConfig.mockResolvedValue({
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: { 'onekeycn.com': THIRD_IP },
        lastBestIp: { 'onekeycn.com': THIRD_IP },
      },
    });
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, SECOND_IP]);
  });

  test('a late domain failure does not undo a route that has moved on', async () => {
    let rejectSlowDomain: (error: Error) => void = () => undefined;
    mockFetch.mockRejectedValueOnce(networkError()).mockImplementationOnce(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectSlowDomain = reject;
        }),
    );
    mockSniRequest
      .mockRejectedValueOnce(new OneKeyLocalError('SNI_REQUEST_FAILED'))
      .mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();

    // Two domain requests are in flight; the first one fails right away.
    const fast = guardedFetch(REFRESH_URL, refreshInit());
    const slow = guardedFetch(REFRESH_URL, refreshInit());
    await expect(fast).rejects.toThrow('Network request failed');
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      'Network request failed',
    );
    await guardedFetch(REFRESH_URL, refreshInit());
    rejectSlowDomain(networkError());
    await expect(slow).rejects.toThrow('Network request failed');
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, SECOND_IP]);
  });

  test('a late failure from an earlier candidate does not move the route', async () => {
    let rejectSlowSni: (error: Error) => void = () => undefined;
    mockSniRequest
      .mockImplementationOnce(
        () =>
          new Promise<ISniResponse | null>((_resolve, reject) => {
            rejectSlowSni = reject;
          }),
      )
      .mockRejectedValueOnce(new OneKeyLocalError('SNI_REQUEST_FAILED'))
      .mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);

    const slow = guardedFetch(REFRESH_URL, refreshInit());
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      'Network request failed',
    );
    await guardedFetch(REFRESH_URL, refreshInit());
    rejectSlowSni(new OneKeyLocalError('SNI_REQUEST_TIMEOUT'));
    await expect(slow).rejects.toThrow('Network request failed');
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP, SECOND_IP, SECOND_IP]);
  });

  test('logs route changes without addresses, paths or credentials', async () => {
    mockSniRequest.mockRejectedValue(new Error('SNI_TLS_FAILED'));
    const guardedFetch = await getGuardedFetch();
    await failDomainOnce(guardedFetch);
    mockFetch.mockRejectedValue(networkError());
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
        'Network request failed',
      );
    }

    const lines = mockLogInfo.mock.calls.map(([payload]) => payload.info);
    expect(lines).toEqual([
      '[SupabaseSniFallback] route=sni candidate=0 reason=domain_failed',
      '[SupabaseSniFallback] route=sni candidate=1 reason=sni_failed',
      '[SupabaseSniFallback] route=sni candidate=2 reason=sni_failed',
      '[SupabaseSniFallback] route=sni candidate=3 reason=sni_failed',
      '[SupabaseSniFallback] route=domain reason=no_candidate',
      '[SupabaseSniFallback] route=sni candidate=0 reason=domain_failed',
    ]);
  });
});

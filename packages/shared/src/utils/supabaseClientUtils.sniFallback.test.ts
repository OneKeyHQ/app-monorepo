/* cspell:ignore apikey */
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
const USER_URL = 'https://auth.onekey.so/auth/v1/user';
const ID_TOKEN_URL = 'https://auth.onekey.so/auth/v1/token?grant_type=id_token';
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

function getLogLines(): string[] {
  return mockLogInfo.mock.calls.map(([payload]) => payload.info);
}

type ICreateClientOptions = { global?: { fetch?: typeof fetch } } | undefined;

describe('supabase SNI fallback', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // The route is module state: every test starts on the domain.
    jest.resetModules();
    jest.clearAllMocks();
    mockSniRequest.mockReset();
    mockIsSniSupported.mockReturnValue(true);
    mockIsProxyActiveForUrl.mockResolvedValue(false);
    mockGetDevSettingsPersistAtom.mockResolvedValue({ settings: {} });
    mockGetIpTableConfig.mockResolvedValue(null);
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  function getLastClientFetch(): typeof fetch {
    const options = mockCreateClient.mock.calls.at(
      -1,
    )?.[2] as ICreateClientOptions;
    if (!options?.global?.fetch) {
      throw new OneKeyLocalError('Supabase client fetch was not configured');
    }
    return options.global.fetch;
  }

  // The fetch of the persistent clients, which also guards the session.
  async function getGuardedFetch(): Promise<typeof fetch> {
    const { getKeylessSupabaseClient } = await import('./supabaseClientUtils');
    getKeylessSupabaseClient();
    return getLastClientFetch();
  }

  // Leaves the module on the first IP-table candidate.
  async function moveToFirstCandidate(guardedFetch: typeof fetch) {
    mockFetch.mockRejectedValueOnce(networkError());
    mockSniRequest.mockResolvedValueOnce(sniOk());
    await guardedFetch(REFRESH_URL, refreshInit());
    mockFetch.mockClear();
    mockSniRequest.mockClear();
    mockLogInfo.mockClear();
  }

  test('uses the domain while it answers', async () => {
    const response = new Response('{}', { status: 200 });
    mockFetch.mockResolvedValue(response);
    const guardedFetch = await getGuardedFetch();
    const init = refreshInit();

    await expect(guardedFetch(REFRESH_URL, init)).resolves.toBe(response);
    await expect(guardedFetch(REFRESH_URL, init)).resolves.toBe(response);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, REFRESH_URL, {
      ...init,
      signal: expect.any(AbortSignal),
    });
    expect(mockSniRequest).not.toHaveBeenCalled();
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  test('answers a failed domain request from the first candidate and keeps that route', async () => {
    mockFetch.mockRejectedValueOnce(networkError());
    mockSniRequest.mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();

    const response = await guardedFetch(REFRESH_URL, refreshInit());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    await expect(response.json()).resolves.toEqual({ access_token: 'a' });
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

    // The next request goes straight to the candidate.
    await guardedFetch(REFRESH_URL, refreshInit());
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
  });

  // A domain request that never settles unless its signal aborts.
  function hangDomainUntilAborted() {
    const state: { signal?: AbortSignal | null } = {};
    mockFetch.mockImplementation(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          state.signal = init?.signal;
          init?.signal?.addEventListener('abort', () => reject(networkError()));
        }),
    );
    return state;
  }

  test.each<[string, string, RequestInit | undefined]>([
    ['a token refresh', REFRESH_URL, refreshInit()],
    [
      'an ID token sign-in',
      ID_TOKEN_URL,
      { method: 'POST', body: '{"provider":"apple","id_token":"t"}' },
    ],
    ['a read', USER_URL, undefined],
  ])(
    'gives a silent domain 5 seconds before moving on with %s',
    async (_name, url, init) => {
      jest.useFakeTimers();
      const domain = hangDomainUntilAborted();
      mockSniRequest.mockResolvedValue(sniOk());
      const guardedFetch = await getGuardedFetch();

      const pending = guardedFetch(url, init);
      await jest.advanceTimersByTimeAsync(4999);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(domain.signal?.aborted).toBe(false);
      expect(mockSniRequest).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      const response = await pending;

      expect(domain.signal?.aborted).toBe(true);
      expect(response.status).toBe(200);
      expect(getSniIps()).toEqual([FIRST_IP]);
    },
  );

  test.each<[string, string, string]>([
    [
      'an OTP send',
      'https://auth.onekey.so/auth/v1/otp',
      '{"email":"a@example.com"}',
    ],
    [
      'an OTP verification',
      'https://auth.onekey.so/auth/v1/verify',
      '{"type":"email","token":"123456"}',
    ],
    [
      'a PKCE code exchange',
      'https://auth.onekey.so/auth/v1/token?grant_type=pkce',
      '{"auth_code":"c","code_verifier":"v"}',
    ],
  ])(
    'never cuts short %s, which must not be sent twice',
    async (_name, url, body) => {
      jest.useFakeTimers();
      let rejectDomain: (error: Error) => void = () => undefined;
      mockFetch.mockImplementation(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectDomain = reject;
          }),
      );
      mockSniRequest.mockResolvedValue(sniOk());
      const guardedFetch = await getGuardedFetch();
      const init: RequestInit = { method: 'POST', body };

      const pending = guardedFetch(url, init);
      await jest.advanceTimersByTimeAsync(120_000);

      // Sent untouched: no abort signal of ours is attached.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0]?.[1]).toBe(init);
      expect(mockSniRequest).not.toHaveBeenCalled();

      // Once the domain fails by itself, the candidates still take over.
      rejectDomain(networkError());
      const response = await pending;
      expect(response.status).toBe(200);
      expect(getSniIps()).toEqual([FIRST_IP]);
    },
  );

  test('walks the candidates in order and keeps the one that answers', async () => {
    mockFetch.mockRejectedValueOnce(networkError());
    mockSniRequest
      .mockRejectedValueOnce(new Error('SNI_REQUEST_TIMEOUT'))
      .mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();

    const response = await guardedFetch(REFRESH_URL, refreshInit());
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(response.status).toBe(200);
    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, SECOND_IP]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('rejects like a failed fetch when no route answers and still starts from the domain', async () => {
    mockFetch.mockRejectedValue(networkError());
    mockSniRequest.mockRejectedValue(
      Object.assign(new Error('SNI_TLS_FAILED: 216.19.3.115'), {
        code: 'SNI_TLS_FAILED',
      }),
    );
    const guardedFetch = await getGuardedFetch();

    const failure = guardedFetch(REFRESH_URL, refreshInit());
    await expect(failure).rejects.toBeInstanceOf(TypeError);
    // The transport detail (which may name the IP) is not passed on.
    await expect(failure).rejects.toThrow(/^Network request failed$/);
    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, THIRD_IP]);
    expect(mockLogInfo).not.toHaveBeenCalled();

    const response = new Response('{}', { status: 200 });
    mockFetch.mockResolvedValueOnce(response);
    await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
      response,
    );
    expect(mockSniRequest).toHaveBeenCalledTimes(3);
  });

  test('treats an empty SNI result as a failed route', async () => {
    mockFetch.mockRejectedValueOnce(networkError());
    mockSniRequest.mockResolvedValueOnce(null).mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();

    const response = await guardedFetch(REFRESH_URL, refreshInit());

    expect(response.status).toBe(200);
    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP]);
  });

  test('moves past candidates that answer with an intermediary page or a redirect', async () => {
    mockFetch.mockRejectedValueOnce(networkError());
    mockSniRequest.mockResolvedValueOnce({
      statusCode: 403,
      headers: { 'content-type': 'text/html', server: 'cloudflare' },
      body: '<!DOCTYPE html><title>Attention Required</title>',
    });
    mockSniRequest.mockResolvedValueOnce({
      statusCode: 302,
      headers: { location: 'https://example.com/login' },
      body: '',
    });
    mockSniRequest.mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();

    const response = await guardedFetch(REFRESH_URL, refreshInit());
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(response.status).toBe(200);
    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, THIRD_IP, THIRD_IP]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('returns a JSON error from a candidate as the final answer', async () => {
    const guardedFetch = await getGuardedFetch();
    await moveToFirstCandidate(guardedFetch);
    mockSniRequest.mockResolvedValue({
      statusCode: 400,
      headers: { 'content-type': 'application/json' },
      body: '{"code":"bad_jwt"}',
    });

    const response = await guardedFetch(USER_URL, {
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
    await guardedFetch(USER_URL);
    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('keeps the candidate on a JSON server error, which is the auth server answering', async () => {
    const guardedFetch = await getGuardedFetch();
    await moveToFirstCandidate(guardedFetch);
    mockSniRequest.mockResolvedValue({
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: '{"code":"unexpected_failure"}',
    });

    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      /Supabase transient HTTP 500/,
    );
    await expect(guardedFetch(REFRESH_URL, refreshInit())).rejects.toThrow(
      /Supabase transient HTTP 500/,
    );

    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('builds a body-less response for 204', async () => {
    const guardedFetch = await getGuardedFetch();
    await moveToFirstCandidate(guardedFetch);
    mockSniRequest.mockResolvedValue({
      statusCode: 204,
      headers: {},
      body: '',
    });

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

  test('tries the other candidates, then the domain, when the route in use stops answering', async () => {
    const guardedFetch = await getGuardedFetch();
    await moveToFirstCandidate(guardedFetch);
    mockSniRequest.mockRejectedValue(new Error('SNI_REQUEST_FAILED'));
    const response = new Response('{}', { status: 200 });
    mockFetch.mockResolvedValue(response);

    await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
      response,
    );
    await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
      response,
    );

    // The second request starts from the domain, which answered last.
    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, THIRD_IP]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(getLogLines()).toEqual([
      '[SupabaseSniFallback] route=domain reason=sni_failed',
    ]);
  });

  test('leaves other hosts untouched', async () => {
    mockFetch.mockRejectedValue(networkError());
    const guardedFetch = await getGuardedFetch();
    const init = refreshInit();

    for (const url of [
      'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
      'https://auth.onekey.so.example.com/auth/v1/user',
      'http://auth.onekey.so/auth/v1/user',
      'https://auth.onekey.so:8443/auth/v1/user',
    ]) {
      await expect(guardedFetch(url, init)).rejects.toThrow(
        'Network request failed',
      );
      expect(mockFetch).toHaveBeenLastCalledWith(url, init);
    }

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(mockSniRequest).not.toHaveBeenCalled();
    expect(mockIsProxyActiveForUrl).not.toHaveBeenCalled();
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  describe.each([
    [
      'a system proxy is active',
      () => mockIsProxyActiveForUrl.mockResolvedValue(true),
    ],
    [
      'the proxy preflight fails',
      () => mockIsProxyActiveForUrl.mockRejectedValue(new Error('preflight')),
    ],
    [
      'the platform cannot tell whether a proxy is active',
      () => mockIsProxyActiveForUrl.mockResolvedValue(null),
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
  ])('when %s', (_name, arrange) => {
    test('sends the request to the domain untouched, with no time limit and no second attempt', async () => {
      arrange();
      const domainError = networkError();
      mockFetch.mockRejectedValue(domainError);
      const guardedFetch = await getGuardedFetch();
      const init = refreshInit();

      await expect(guardedFetch(REFRESH_URL, init)).rejects.toBe(domainError);
      await expect(guardedFetch(REFRESH_URL, init)).rejects.toBe(domainError);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // The very same init: no abort signal of ours is attached.
      expect(mockFetch.mock.calls[0]?.[1]).toBe(init);
      expect(mockSniRequest).not.toHaveBeenCalled();
      expect(mockLogInfo).not.toHaveBeenCalled();
    });

    test('goes back to the domain from a candidate in use', async () => {
      const guardedFetch = await getGuardedFetch();
      await moveToFirstCandidate(guardedFetch);
      arrange();
      const response = new Response('{}', { status: 200 });
      mockFetch.mockResolvedValue(response);

      await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
        response,
      );

      expect(mockSniRequest).not.toHaveBeenCalled();
      expect(getLogLines()).toEqual([
        '[SupabaseSniFallback] route=domain reason=no_candidate',
      ]);
    });
  });

  test('sends requests the SNI transport cannot carry to the domain untouched', async () => {
    const response = new Response('{}', { status: 200 });
    const guardedFetch = await getGuardedFetch();
    await moveToFirstCandidate(guardedFetch);
    mockSniRequest.mockResolvedValue(sniOk());
    mockFetch.mockResolvedValue(response);
    const formInit: RequestInit = {
      method: 'POST',
      body: new URLSearchParams({ refresh_token: 'r' }),
    };

    await expect(guardedFetch(REFRESH_URL, formInit)).resolves.toBe(response);
    await expect(
      guardedFetch(new Request(REFRESH_URL, { method: 'POST' })),
    ).resolves.toBe(response);

    expect(mockFetch.mock.calls[0]?.[1]).toBe(formInit);
    expect(mockSniRequest).not.toHaveBeenCalled();
    // The route itself is unchanged for requests it can carry.
    await guardedFetch(REFRESH_URL, refreshInit());
    expect(getSniIps()).toEqual([FIRST_IP]);
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  test('does nothing on platforms without the SNI transport', async () => {
    mockIsSniSupported.mockReturnValue(false);
    mockFetch.mockRejectedValue(networkError());
    const guardedFetch = await getGuardedFetch();
    const init = refreshInit();

    await expect(guardedFetch(REFRESH_URL, init)).rejects.toThrow(
      'Network request failed',
    );
    await expect(guardedFetch(REFRESH_URL, init)).rejects.toThrow(
      'Network request failed',
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(REFRESH_URL, init);
    expect(mockSniRequest).not.toHaveBeenCalled();
    expect(mockIsProxyActiveForUrl).not.toHaveBeenCalled();
  });

  test('stops at the domain when the caller aborts', async () => {
    const controller = new AbortController();
    let domainSignal: AbortSignal | null | undefined;
    mockFetch.mockImplementationOnce(
      async (_input: unknown, init?: RequestInit) => {
        domainSignal = init?.signal;
        controller.abort();
        throw new OneKeyLocalError('aborted');
      },
    );
    const response = new Response('{}', { status: 200 });
    mockFetch.mockResolvedValue(response);
    mockSniRequest.mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch(REFRESH_URL, {
        ...refreshInit(),
        signal: controller.signal,
      }),
    ).rejects.toThrow('aborted');
    // The caller's abort reached the domain request.
    expect(domainSignal?.aborted).toBe(true);
    await expect(guardedFetch(REFRESH_URL, refreshInit())).resolves.toBe(
      response,
    );

    expect(mockSniRequest).not.toHaveBeenCalled();
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  test('rejects with AbortError and stops walking when aborted during SNI', async () => {
    const controller = new AbortController();
    const guardedFetch = await getGuardedFetch();
    await moveToFirstCandidate(guardedFetch);
    mockSniRequest
      .mockImplementationOnce(async () => {
        controller.abort();
        throw new OneKeyLocalError('SNI_CANCELLED: Request cancelled');
      })
      .mockResolvedValue(sniOk());

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

    // No other route was tried for the aborted request, and the route is kept.
    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('returns any HTTP answer from the domain without trying a candidate', async () => {
    const blockedPage = new Response('<html>blocked</html>', {
      status: 403,
      headers: { 'content-type': 'text/html' },
    });
    mockFetch.mockResolvedValue(blockedPage);
    mockSniRequest.mockResolvedValue(sniOk());
    const { createTemporarySupabaseClient } =
      await import('./supabaseClientUtils');
    createTemporarySupabaseClient();
    const clientFetch = getLastClientFetch();

    await expect(clientFetch(ID_TOKEN_URL, refreshInit())).resolves.toBe(
      blockedPage,
    );

    expect(mockSniRequest).not.toHaveBeenCalled();
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  test('the temporary sign-in client walks the same routes', async () => {
    mockFetch.mockRejectedValue(networkError());
    mockSniRequest.mockResolvedValue(sniOk('{"access_token":"signed-in"}'));
    const { createTemporarySupabaseClient } =
      await import('./supabaseClientUtils');
    createTemporarySupabaseClient();
    const clientFetch = getLastClientFetch();

    const response = await clientFetch(ID_TOKEN_URL, {
      method: 'POST',
      headers: { apikey: 'public-key' },
      body: '{"provider":"apple","id_token":"t"}',
    });

    await expect(response.json()).resolves.toEqual({
      access_token: 'signed-in',
    });
    expect(mockSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: FIRST_IP,
        path: '/auth/v1/token?grant_type=id_token',
        method: 'POST',
        body: '{"provider":"apple","id_token":"t"}',
      }),
      undefined,
    );
    // The route is shared with the persistent clients of this runtime.
    const guardedFetch = await getGuardedFetch();
    await guardedFetch(REFRESH_URL, refreshInit());
    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('keeps the candidate order when the IP table preference or environment changes', async () => {
    const { DEFAULT_IP_TABLE_CONFIG } =
      await import('../request/constants/ipTableDefaults');
    mockGetDevSettingsPersistAtom.mockResolvedValue({
      enabled: true,
      settings: { enableTestEndpoint: true },
    });
    mockFetch.mockRejectedValueOnce(networkError());
    mockSniRequest
      .mockRejectedValueOnce(new Error('SNI_REQUEST_FAILED'))
      .mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();
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

  test('concurrent requests settle on the same route and log it once', async () => {
    mockFetch.mockRejectedValue(networkError());
    mockSniRequest.mockResolvedValue(sniOk());
    const guardedFetch = await getGuardedFetch();

    const responses = await Promise.all([
      guardedFetch(REFRESH_URL, refreshInit()),
      guardedFetch(USER_URL),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(getSniIps()).toEqual([FIRST_IP, FIRST_IP]);
    expect(getLogLines()).toEqual([
      '[SupabaseSniFallback] route=sni candidate=0 reason=domain_failed',
    ]);
  });

  test('logs route changes without addresses, paths or credentials', async () => {
    const guardedFetch = await getGuardedFetch();
    mockFetch.mockRejectedValueOnce(networkError());
    mockSniRequest
      .mockResolvedValueOnce({
        statusCode: 502,
        headers: {},
        body: '',
      })
      .mockResolvedValueOnce(sniOk());
    await guardedFetch(REFRESH_URL, refreshInit());

    // The candidate in use fails; the other candidates come before the domain.
    mockSniRequest
      .mockRejectedValueOnce(new Error('SNI_TLS_FAILED'))
      .mockResolvedValueOnce(sniOk());
    await guardedFetch(REFRESH_URL, refreshInit());

    mockIsProxyActiveForUrl.mockResolvedValue(true);
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    await guardedFetch(REFRESH_URL, refreshInit());

    expect(getSniIps()).toEqual([FIRST_IP, SECOND_IP, SECOND_IP, FIRST_IP]);
    expect(getLogLines()).toEqual([
      '[SupabaseSniFallback] route=sni candidate=1 reason=domain_failed',
      '[SupabaseSniFallback] route=sni candidate=0 reason=sni_failed',
      '[SupabaseSniFallback] route=domain reason=no_candidate',
    ]);
  });
});

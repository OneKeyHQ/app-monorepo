import { EventEmitter } from 'events';
import https from 'https';

import electronLogger from 'electron-log/main';

import type { ISniRequestConfig } from '@onekeyhq/shared/src/request/types/ipTable';

import DesktopApiSniRequest, {
  SniRequestError,
  SniRequestLimiter,
  buildSniRequestOptions,
  classifyTransportError,
  headersToMaps,
  isProxyRouteActive,
  isSniFailClosedError,
  validateSniRequestConfig,
} from './DesktopApiSniRequest';

import type { IncomingMessage } from 'http';
import type { RequestOptions } from 'https';

const mockResolveProxy = jest.fn<Promise<string>, [string]>();

jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('electron', () => ({
  session: {
    defaultSession: {
      resolveProxy: (url: string) => mockResolveProxy(url),
    },
  },
}));

const mockedElectronLogger = jest.mocked(electronLogger);

const baseConfig = (): ISniRequestConfig => ({
  ip: '93.184.216.34',
  hostname: 'example.com',
  path: '/',
  headers: {},
  method: 'GET',
  body: null,
  timeout: 30_000,
});

class FakeClientRequest extends EventEmitter {
  constructor(public options: RequestOptions) {
    super();
  }

  destroyedWith: Error | undefined;

  write = jest.fn();

  end = jest.fn();

  destroy = jest.fn((error?: Error) => {
    this.destroyedWith = error;
    if (error) {
      this.emit('error', error);
    }
    return this as never;
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function observeRejection<T>(promise: Promise<T>): Promise<T> {
  void promise.catch(() => undefined);
  return promise;
}

function getRequestLimiter(api: DesktopApiSniRequest): SniRequestLimiter {
  return (
    api as unknown as {
      requestLimiter: SniRequestLimiter;
    }
  ).requestLimiter;
}

function getSniAgent(
  api: DesktopApiSniRequest,
): https.Agent & { getName(options: RequestOptions): string } {
  return (
    api as unknown as {
      agentState: {
        agent: https.Agent & { getName(options: RequestOptions): string };
      };
    }
  ).agentState.agent;
}

describe('DesktopApiSniRequest OSCS validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const expectInvalid = (config: Partial<ISniRequestConfig>) => {
    expect(() =>
      validateSniRequestConfig({ ...baseConfig(), ...config }),
    ).toThrow(/SNI_INVALID_CONFIG/);
  };

  test('accepts valid request boundary values and normalizes method/path/body', () => {
    const normalized = validateSniRequestConfig({
      ...baseConfig(),
      requestId: 'req-1',
      method: ' get ',
      path: 'v1?q=1',
      body: 'a'.repeat(1024 * 1024),
      timeout: 120_000,
    });

    expect(normalized.method).toBe('GET');
    expect(normalized.path).toBe('/v1?q=1');
    expect(normalized.body).toHaveLength(1024 * 1024);
  });

  test('rejects unsafe IP destinations and hostnames that are IP literals', () => {
    [
      'example.com',
      '93.184.216.34:443',
      ' 93.184.216.34',
      '10.0.0.1',
      '127.0.0.1',
      '100.64.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '192.0.2.1',
      '198.18.0.1',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      'fe80::1',
      'fc00::1',
      'ff00::1',
      '100::1',
      '2001::1',
      '2001:2::1',
      '2001:db8::1',
      '2002:0a00:0001::1',
      '::ffff:10.0.0.1',
      '64:ff9b::10.0.0.1',
      '64:ff9b:1::1',
      '2001:4860:4860::8888%en0',
      '[2001:4860:4860::8888]',
    ].forEach((ip) => expectInvalid({ ip }));

    ['93.184.216.34', '2001:4860:4860::8888'].forEach((hostname) =>
      expectInvalid({ hostname }),
    );
  });

  test('rejects malformed hostnames, methods, paths, request ids, timeouts and body sizes', () => {
    [
      '',
      '-example.com',
      'example-.com',
      'example..com',
      'bad_host.example',
      'https://example.com',
      'example.com:443',
      `${'a'.repeat(64)}.example.com`,
      `${'a'.repeat(250)}.com`,
    ].forEach((hostname) => expectInvalid({ hostname }));

    ['TRACE', 'CONNECT', '', 'GET\n'].forEach((method) =>
      expectInvalid({ method }),
    );

    [
      'https://example.com',
      'http://example.com',
      '//example.com/path',
      ['java', 'script:alert(1)'].join(''),
      '/path\nInjected: yes',
      `/${'a'.repeat(8192)}`,
    ].forEach((path) => expectInvalid({ path }));

    expectInvalid({ requestId: '' });
    expectInvalid({ requestId: 'x'.repeat(129) });
    expectInvalid({ requestId: 'req\n1' });
    expectInvalid({ timeout: 0 });
    expectInvalid({ timeout: 120_001 });
    expectInvalid({ timeout: Number.NaN });
    expectInvalid({ body: 'a'.repeat(1024 * 1024 + 1) });
    expectInvalid({ port: 8443 });
  });

  test('redacts raw IPs from validation failure diagnostics', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });

    await expect(
      api.request({ ...baseConfig(), ip: '10.0.0.5' }),
    ).rejects.toThrow(/Forbidden IP: 10\.0\.0\.5/);

    const errorLogs = mockedElectronLogger.error.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(errorLogs).toContain(
      'errorMessage=SNI_INVALID_CONFIG:_Forbidden_IP:_<ip>',
    );
    expect(errorLogs).not.toContain('10.0.0.5');
  });

  test('filters module-owned headers and rejects unsafe headers', () => {
    const normalized = validateSniRequestConfig({
      ...baseConfig(),
      method: 'get',
      headers: {
        Host: 'evil.example',
        'Content-Length': '9999',
        'Accept-Encoding': 'gzip',
        'X-Test': 'ok',
      },
      body: 'abc',
    });
    const options = buildSniRequestOptions(normalized, {} as never);

    expect(options.port).toBe(443);
    expect(options.host).toBe('93.184.216.34');
    expect(options.servername).toBe('example.com');
    expect(options.method).toBe('GET');
    expect(options.headers).toMatchObject({
      Host: 'example.com',
      'Accept-Encoding': 'identity',
      'Content-Length': '3',
      'X-Test': 'ok',
    });

    [
      { Connection: 'close' },
      { 'Proxy-Authorization': 'secret' },
      { 'Transfer-Encoding': 'chunked' },
      { Expect: '100-continue' },
      { ':authority': 'evil.example' },
      { 'Bad Header': 'x' },
      { 'X-Test': 'line\nbreak' },
      { 'X-Test': 'x'.repeat(8 * 1024 + 1) },
      Object.fromEntries(
        Array.from({ length: 65 }, (_, index) => [`X-${index}`, 'v']),
      ),
      Object.fromEntries(
        Array.from({ length: 5 }, (_, index) => [
          `X-${index}`,
          'x'.repeat(7 * 1024),
        ]),
      ),
    ].forEach((headers) => expectInvalid({ headers }));
  });

  test('preserves repeated response headers separately from last-value map', () => {
    const maps = headersToMaps([
      'Set-Cookie',
      'a=1',
      'set-cookie',
      'b=2',
      'X-Test',
      'one',
    ]);

    expect(maps.headers).toEqual({
      'set-cookie': 'b=2',
      'x-test': 'one',
    });
    expect(maps.multiValueHeaders).toEqual({
      'set-cookie': ['a=1', 'b=2'],
      'x-test': ['one'],
    });
  });

  test('treats fail-closed SNI errors as non-fallback failures', () => {
    expect(isSniFailClosedError(new Error('SNI_RESOURCE_LIMIT'))).toBe(true);
    expect(isSniFailClosedError(new Error('SNI_CANCELLED'))).toBe(true);
    expect(isSniFailClosedError(new Error('SNI_TLS_FAILED'))).toBe(true);
    expect(
      isSniFailClosedError(new Error('connect ssl.example.com failed')),
    ).toBe(false);
    expect(isSniFailClosedError(new Error('ECONNRESET'))).toBe(false);
  });

  test('queues the 17th request for one destination until a slot is released', async () => {
    const limiter = new SniRequestLimiter();
    const releases = await Promise.all(
      Array.from({ length: 16 }, () =>
        limiter.acquire('Example.com', '93.184.216.34'),
      ),
    );
    let queuedStarted = false;
    const queuedReleasePromise = limiter
      .acquire('example.com', '93.184.216.34')
      .then((release) => {
        queuedStarted = true;
        return release;
      });

    await flushMicrotasks();
    expect(queuedStarted).toBe(false);
    expect(limiter.snapshot('example.com', '93.184.216.34')).toEqual({
      activeRequests: 16,
      activeRequestsForPair: 16,
      pendingRequests: 1,
      pendingRequestsForPair: 1,
    });

    releases[0]();
    const queuedRelease = await queuedReleasePromise;
    expect(queuedStarted).toBe(true);
    releases.forEach((release) => release());
    queuedRelease();
    expect(limiter.snapshot()).toEqual({
      activeRequests: 0,
      activeRequestsForPair: 0,
      pendingRequests: 0,
      pendingRequestsForPair: 0,
    });
  });

  test('uses one limiter bucket for equivalent IPv6 representations', async () => {
    const limiter = new SniRequestLimiter(2, 1);
    const releaseActive = await limiter.acquire(
      'Example.com',
      '2001:4860:4860:0:0:0:0:8888',
    );
    let queuedStarted = false;
    const queuedReleasePromise = limiter
      .acquire('example.com', '2001:4860:4860::8888')
      .then((release) => {
        queuedStarted = true;
        return release;
      });

    await flushMicrotasks();
    expect(queuedStarted).toBe(false);
    expect(limiter.snapshot('example.com', '2001:4860:4860::8888')).toEqual({
      activeRequests: 1,
      activeRequestsForPair: 1,
      pendingRequests: 1,
      pendingRequestsForPair: 1,
    });

    releaseActive();
    const queuedRelease = await queuedReleasePromise;
    expect(queuedStarted).toBe(true);
    queuedRelease();
  });

  test('uses one limiter bucket for IPv4 and mapped IPv6 forms', async () => {
    const limiter = new SniRequestLimiter(2, 1);
    const releaseActive = await limiter.acquire('Example.com', '93.184.216.34');
    let queuedStarted = false;
    const queuedReleasePromise = limiter
      .acquire('example.com', '::ffff:93.184.216.34')
      .then((release) => {
        queuedStarted = true;
        return release;
      });

    await flushMicrotasks();
    expect(queuedStarted).toBe(false);
    expect(limiter.snapshot('example.com', '::ffff:93.184.216.34')).toEqual({
      activeRequests: 1,
      activeRequestsForPair: 1,
      pendingRequests: 1,
      pendingRequestsForPair: 1,
    });

    releaseActive();
    const queuedRelease = await queuedReleasePromise;
    expect(queuedStarted).toBe(true);
    queuedRelease();
  });

  test('uses one HTTPS agent identity for IPv4 and mapped IPv6 forms', () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });
    const agent = getSniAgent(api);

    expect(
      agent.getName({
        host: '::ffff:93.184.216.34',
        servername: 'example.com',
        port: 443,
      }),
    ).toBe(
      agent.getName({
        host: '93.184.216.34',
        servername: 'example.com',
        port: 443,
      }),
    );
  });

  test('exposes the live 16 active plus pending limiter state in development', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });
    const limiter = getRequestLimiter(api);
    const releases: Array<() => void> = [];
    for (let index = 0; index < 16; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      releases.push(await limiter.acquire('example.com', '93.184.216.34'));
    }
    const pendingReleasePromise = limiter.acquire(
      'example.com',
      '93.184.216.34',
    );

    await expect(
      api.getDebugSnapshot({
        hostname: 'example.com',
        ip: '93.184.216.34',
      }),
    ).resolves.toEqual({
      activeRequests: 16,
      activeRequestsForPair: 16,
      pendingRequests: 1,
      pendingRequestsForPair: 1,
    });

    releases.forEach((release) => release());
    const pendingRelease = await pendingReleasePromise;
    pendingRelease();
  });

  test('exposes count-only limiter state in production QA builds', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await expect(
        api.getDebugSnapshot({
          hostname: 'example.com',
          ip: '93.184.216.34',
        }),
      ).resolves.toEqual({
        activeRequests: 0,
        activeRequestsForPair: 0,
        pendingRequests: 0,
        pendingRequestsForPair: 0,
      });
    } finally {
      if (previousNodeEnv === undefined) {
        Reflect.deleteProperty(process.env, 'NODE_ENV');
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  test('queues the 65th global request until a slot is released', async () => {
    const limiter = new SniRequestLimiter();
    const releases = await Promise.all(
      Array.from({ length: 64 }, (_, index) =>
        limiter.acquire(`host-${index}.example.com`, `ip-${index}`),
      ),
    );
    let queuedStarted = false;
    const queuedReleasePromise = limiter
      .acquire('queued.example.com', 'queued-ip')
      .then((release) => {
        queuedStarted = true;
        return release;
      });

    await flushMicrotasks();
    expect(queuedStarted).toBe(false);
    expect(limiter.snapshot()).toMatchObject({
      activeRequests: 64,
      pendingRequests: 1,
    });

    releases[0]();
    const queuedRelease = await queuedReleasePromise;
    releases.forEach((release) => release());
    queuedRelease();
    expect(limiter.snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
  });

  test('rejects only after the bounded pending queue is full', async () => {
    const limiter = new SniRequestLimiter(1, 1, 2);
    const activeRelease = await limiter.acquire('a.example.com', 'ip-a');
    const firstPending = limiter.acquire('a.example.com', 'ip-a');
    const secondPending = limiter.acquire('b.example.com', 'ip-b');

    await expect(
      limiter.acquire('c.example.com', 'ip-c'),
    ).rejects.toMatchObject({
      code: 'SNI_RESOURCE_LIMIT',
      failClosed: true,
    });
    expect(limiter.snapshot()).toMatchObject({
      activeRequests: 1,
      pendingRequests: 2,
    });

    activeRelease();
    const firstPendingRelease = await firstPending;
    firstPendingRelease();
    const secondPendingRelease = await secondPending;
    secondPendingRelease();
    expect(limiter.snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
  });

  test('preserves FIFO within a pair and skips blocked pairs', async () => {
    const limiter = new SniRequestLimiter(2, 1);
    const releaseA = await limiter.acquire('a.example.com', 'ip-a');
    const releaseBlocker = await limiter.acquire('blocker.example.com', 'ip-b');
    const order: string[] = [];
    const queuedA = limiter.acquire('a.example.com', 'ip-a').then((release) => {
      order.push('a');
      return release;
    });
    const queuedRunnable = limiter
      .acquire('runnable.example.com', 'ip-c')
      .then((release) => {
        order.push('runnable');
        return release;
      });

    releaseBlocker();
    const releaseRunnable = await queuedRunnable;
    expect(order).toEqual(['runnable']);
    releaseA();
    const releaseQueuedA = await queuedA;
    expect(order).toEqual(['runnable', 'a']);

    releaseA();
    releaseRunnable();
    releaseQueuedA();
    expect(limiter.snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
  });

  test('preserves FIFO order for waiters on the same pair', async () => {
    const limiter = new SniRequestLimiter(1, 1);
    const activeRelease = await limiter.acquire('a.example.com', 'ip-a');
    const order: string[] = [];
    const firstPending = limiter
      .acquire('a.example.com', 'ip-a')
      .then((release) => {
        order.push('first');
        return release;
      });
    const secondPending = limiter
      .acquire('a.example.com', 'ip-a')
      .then((release) => {
        order.push('second');
        return release;
      });

    activeRelease();
    const firstRelease = await firstPending;
    expect(order).toEqual(['first']);
    firstRelease();
    const secondRelease = await secondPending;
    expect(order).toEqual(['first', 'second']);
    secondRelease();
    expect(limiter.snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
  });

  test('removes an aborted waiter without leaking a slot', async () => {
    const limiter = new SniRequestLimiter(1, 1);
    const activeRelease = await limiter.acquire('a.example.com', 'ip-a');
    const controller = new AbortController();
    const queued = limiter.acquire('a.example.com', 'ip-a', {
      signal: controller.signal,
    });
    controller.abort(
      Object.assign(new Error('cancelled'), {
        code: 'SNI_CANCELLED',
      }),
    );

    await expect(queued).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
    expect(limiter.snapshot()).toMatchObject({
      activeRequests: 1,
      pendingRequests: 0,
    });
    activeRelease();
    activeRelease();
    expect(limiter.snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
  });

  test('classifies desktop TLS and certificate errors as fail-closed', () => {
    const certError = Object.assign(
      new Error("Hostname/IP does not match certificate's altnames"),
      { code: 'ERR_TLS_CERT_ALTNAME_INVALID' },
    );
    const classifiedCertError = classifyTransportError(certError);
    expect(classifiedCertError).toMatchObject({
      code: 'SNI_CERT_FAILED',
      failClosed: true,
    });

    const tlsError = Object.assign(new Error('SSL handshake failed'), {
      code: 'EPROTO',
    });
    const classifiedTlsError = classifyTransportError(tlsError);
    expect(classifiedTlsError).toMatchObject({
      code: 'SNI_TLS_FAILED',
      failClosed: true,
    });

    const networkError = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
    });
    expect(classifyTransportError(networkError)).toBe(networkError);
  });

  test('detects active proxy routes from Electron resolveProxy output', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });

    expect(isProxyRouteActive('DIRECT')).toBe(false);
    expect(isProxyRouteActive('DIRECT; direct')).toBe(false);
    expect(isProxyRouteActive('PROXY 127.0.0.1:7890; DIRECT')).toBe(true);
    expect(isProxyRouteActive('SOCKS5 127.0.0.1:7890')).toBe(true);

    mockResolveProxy.mockResolvedValueOnce('DIRECT');
    await expect(api.isProxyActiveForUrl('https://example.com/')).resolves.toBe(
      false,
    );

    mockResolveProxy.mockResolvedValueOnce('PROXY 127.0.0.1:7890; DIRECT');
    await expect(api.isProxyActiveForUrl('https://example.com/')).resolves.toBe(
      true,
    );
  });

  test('does not start the 17th same-pair transport until an active request settles', async () => {
    const requests: FakeClientRequest[] = [];
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });
    const activePromises = Array.from({ length: 16 }, (_, index) =>
      observeRejection(
        api.request({ ...baseConfig(), requestId: `active-${index}` }),
      ),
    );
    await flushMicrotasks();

    const queuedPromise = observeRejection(
      api.request({ ...baseConfig(), requestId: 'queued-17' }),
    );
    await flushMicrotasks();
    expect(requests).toHaveLength(16);
    expect(
      getRequestLimiter(api).snapshot('example.com', '93.184.216.34'),
    ).toEqual({
      activeRequests: 16,
      activeRequestsForPair: 16,
      pendingRequests: 1,
      pendingRequestsForPair: 1,
    });

    requests[0].destroy(new Error('slot released'));
    await expect(activePromises[0]).rejects.toThrow('slot released');
    await flushMicrotasks();
    expect(requests).toHaveLength(17);
    expect(getRequestLimiter(api).snapshot()).toMatchObject({
      activeRequests: 16,
      pendingRequests: 0,
    });

    await api.cancelAllRequests();
    await Promise.allSettled([...activePromises.slice(1), queuedPromise]);
    expect(getRequestLimiter(api).snapshot()).toEqual({
      activeRequests: 0,
      activeRequestsForPair: 0,
      pendingRequests: 0,
      pendingRequestsForPair: 0,
    });
    requestSpy.mockRestore();
  });

  test('cancels a queued request without starting its transport', async () => {
    const requests: FakeClientRequest[] = [];
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });
    (
      api as unknown as {
        requestLimiter: SniRequestLimiter;
      }
    ).requestLimiter = new SniRequestLimiter(1, 1);
    const activePromise = observeRejection(
      api.request({ ...baseConfig(), requestId: 'active' }),
    );
    await flushMicrotasks();
    const queuedPromise = observeRejection(
      api.request({ ...baseConfig(), requestId: 'queued' }),
    );
    await flushMicrotasks();

    await expect(api.cancelRequest('queued')).resolves.toEqual({
      success: true,
    });
    await expect(queuedPromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
      failClosed: true,
    });
    expect(requests).toHaveLength(1);
    expect(getRequestLimiter(api).snapshot()).toMatchObject({
      activeRequests: 1,
      pendingRequests: 0,
    });

    await api.cancelAllRequests();
    await expect(activePromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    expect(getRequestLimiter(api).snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
    requestSpy.mockRestore();
  });

  test('cancelAllRequests cancels active and pending requests together', async () => {
    const requests: FakeClientRequest[] = [];
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });
    (
      api as unknown as {
        requestLimiter: SniRequestLimiter;
      }
    ).requestLimiter = new SniRequestLimiter(1, 1);
    const activePromise = observeRejection(
      api.request({ ...baseConfig(), requestId: 'active' }),
    );
    await flushMicrotasks();
    const queuedPromise = observeRejection(
      api.request({ ...baseConfig(), requestId: 'pending' }),
    );
    await flushMicrotasks();

    await expect(api.cancelAllRequests()).resolves.toEqual({ success: true });
    await expect(activePromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    await expect(queuedPromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    expect(requests).toHaveLength(1);
    expect(getRequestLimiter(api).snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
    requestSpy.mockRestore();
  });

  test('a duplicate pending requestId cancels the older waiter immediately', async () => {
    const requests: FakeClientRequest[] = [];
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });
    (
      api as unknown as {
        requestLimiter: SniRequestLimiter;
      }
    ).requestLimiter = new SniRequestLimiter(1, 1);
    const blocker = observeRejection(
      api.request({ ...baseConfig(), requestId: 'blocker' }),
    );
    await flushMicrotasks();
    const firstPending = observeRejection(
      api.request({ ...baseConfig(), requestId: 'same' }),
    );
    await flushMicrotasks();
    const replacementPending = observeRejection(
      api.request({ ...baseConfig(), requestId: 'same' }),
    );

    await expect(firstPending).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
    await flushMicrotasks();
    expect(requests).toHaveLength(1);
    expect(getRequestLimiter(api).snapshot()).toMatchObject({
      activeRequests: 1,
      pendingRequests: 1,
    });

    await expect(api.cancelRequest('same')).resolves.toEqual({ success: true });
    await expect(replacementPending).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    await api.cancelAllRequests();
    await expect(blocker).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
    expect(getRequestLimiter(api).snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
    requestSpy.mockRestore();
  });

  test('queued timeout removes the waiter and never starts a transport', async () => {
    jest.useFakeTimers();
    const requests: FakeClientRequest[] = [];
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    try {
      const api = new DesktopApiSniRequest({ desktopApi: {} as never });
      (
        api as unknown as {
          requestLimiter: SniRequestLimiter;
        }
      ).requestLimiter = new SniRequestLimiter(1, 1);
      const activePromise = observeRejection(
        api.request({ ...baseConfig(), requestId: 'active' }),
      );
      await flushMicrotasks();
      const queuedPromise = observeRejection(
        api.request({
          ...baseConfig(),
          requestId: 'queued-timeout',
          timeout: 100,
        }),
      );
      await flushMicrotasks();

      jest.advanceTimersByTime(100);
      await expect(queuedPromise).rejects.toMatchObject({
        code: 'SNI_TIMEOUT',
      });
      expect(requests).toHaveLength(1);
      expect(getRequestLimiter(api).snapshot()).toMatchObject({
        activeRequests: 1,
        pendingRequests: 0,
      });

      await api.cancelAllRequests();
      await expect(activePromise).rejects.toMatchObject({
        code: 'SNI_CANCELLED',
      });
      expect(getRequestLimiter(api).snapshot()).toMatchObject({
        activeRequests: 0,
        pendingRequests: 0,
      });
    } finally {
      requestSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('uses only the remaining timeout after queue admission', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    const requests: FakeClientRequest[] = [];
    jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    try {
      const api = new DesktopApiSniRequest({ desktopApi: {} as never });
      (
        api as unknown as {
          requestLimiter: SniRequestLimiter;
        }
      ).requestLimiter = new SniRequestLimiter(1, 1);
      const activePromise = observeRejection(
        api.request({ ...baseConfig(), requestId: 'active' }),
      );
      await flushMicrotasks();
      const queuedPromise = observeRejection(
        api.request({
          ...baseConfig(),
          requestId: 'remaining-timeout',
          timeout: 1000,
        }),
      );
      await flushMicrotasks();
      jest.advanceTimersByTime(400);

      requests[0].destroy(new Error('slot released'));
      await expect(activePromise).rejects.toThrow('slot released');
      await flushMicrotasks();
      expect(requests).toHaveLength(2);
      expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 600);

      await api.cancelAllRequests();
      await expect(queuedPromise).rejects.toMatchObject({
        code: 'SNI_CANCELLED',
      });
      expect(getRequestLimiter(api).snapshot()).toMatchObject({
        activeRequests: 0,
        pendingRequests: 0,
      });
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });

  test('releases the limiter slot after a successful response', async () => {
    let responseCallback: ((response: IncomingMessage) => void) | undefined;
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
      callback: (response: IncomingMessage) => void,
    ) => {
      responseCallback = callback;
      return new FakeClientRequest(options) as never;
    }) as never);
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });
    const requestPromise = api.request({
      ...baseConfig(),
      requestId: 'success',
    });
    await flushMicrotasks();
    const response = Object.assign(new EventEmitter(), {
      headers: {},
      rawHeaders: [],
      statusCode: 204,
      statusMessage: 'No Content',
      resume: jest.fn(),
    }) as unknown as IncomingMessage;

    expect(responseCallback).toBeDefined();
    responseCallback?.(response);
    response.emit('end');
    await expect(requestPromise).resolves.toMatchObject({
      statusCode: 204,
      body: '',
    });
    expect(getRequestLimiter(api).snapshot()).toMatchObject({
      activeRequests: 0,
      pendingRequests: 0,
    });
    requestSpy.mockRestore();
  });

  test('releases the limiter slot when https.request throws synchronously', async () => {
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(() => {
      throw new SniRequestError(
        'SNI_REQUEST_FAILED',
        'synchronous transport failure',
      );
    });
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });

    await expect(api.request(baseConfig())).rejects.toThrow(
      'synchronous transport failure',
    );
    expect(getRequestLimiter(api).snapshot()).toEqual({
      activeRequests: 0,
      activeRequestsForPair: 0,
      pendingRequests: 0,
      pendingRequestsForPair: 0,
    });
    requestSpy.mockRestore();
  });

  test('settle only removes the active requestId entry for the same request', async () => {
    const requests: FakeClientRequest[] = [];
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });

    const firstRequest = observeRejection(
      api.request({ ...baseConfig(), requestId: 'same' }),
    );
    await flushMicrotasks();
    const secondRequest = observeRejection(
      api.request({ ...baseConfig(), requestId: 'same' }),
    );

    await expect(firstRequest).rejects.toThrow(/SNI_CANCELLED/);
    await flushMicrotasks();
    expect(requests).toHaveLength(2);
    expect(requests[0].destroy).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SNI_CANCELLED' }),
    );

    await expect(api.cancelRequest('same')).resolves.toEqual({ success: true });
    await expect(secondRequest).rejects.toThrow(/SNI_CANCELLED/);
    await expect(api.cancelRequest('same')).resolves.toEqual({
      success: false,
    });

    requestSpy.mockRestore();
  });

  test('redacts raw IPs from transport failure diagnostics', async () => {
    const requests: FakeClientRequest[] = [];
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });

    const promise = api.request(baseConfig());
    await flushMicrotasks();
    requests[0].destroy(
      Object.assign(new Error('connect ECONNREFUSED 93.184.216.34:443'), {
        code: 'ECONNREFUSED',
      }),
    );

    await expect(promise).rejects.toThrow(
      /connect ECONNREFUSED 93\.184\.216\.34:443/,
    );
    const errorLogs = mockedElectronLogger.error.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(errorLogs).toContain('errorMessage=connect_ECONNREFUSED_<ip>:443');
    expect(errorLogs).not.toContain('93.184.216.34');

    requestSpy.mockRestore();
  });

  test('clearDNSCache rotates agents without destroying the active request agent', async () => {
    const requests: FakeClientRequest[] = [];
    const requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
    ) => {
      const request = new FakeClientRequest(options);
      requests.push(request);
      return request as never;
    }) as never);
    const api = new DesktopApiSniRequest({ desktopApi: {} as never });

    const firstRequest = observeRejection(
      api.request({ ...baseConfig(), requestId: 'req-1' }),
    );
    await flushMicrotasks();
    const firstAgent = requests[0].options.agent as https.Agent;
    const firstAgentDestroySpy = jest.spyOn(firstAgent, 'destroy');

    await api.clearDNSCache();

    expect(firstAgentDestroySpy).not.toHaveBeenCalled();
    expect(requests[0].destroy).not.toHaveBeenCalled();

    const secondRequest = observeRejection(
      api.request({ ...baseConfig(), requestId: 'req-2' }),
    );
    await flushMicrotasks();
    expect(requests[1].options.agent).not.toBe(firstAgent);

    requests[0].destroy(new Error('first done'));
    await expect(firstRequest).rejects.toThrow('first done');
    expect(firstAgentDestroySpy).toHaveBeenCalledTimes(1);

    requests[1].destroy(new Error('second done'));
    await expect(secondRequest).rejects.toThrow('second done');

    requestSpy.mockRestore();
  });
});

import { EventEmitter } from 'events';
import https from 'https';

import electronLogger from 'electron-log/main';

import type { ISniRequestConfig } from '@onekeyhq/shared/src/request/types/ipTable';

import DesktopApiSniRequest, {
  SniRequestLimiter,
  buildSniRequestOptions,
  classifyTransportError,
  headersToMaps,
  isProxyRouteActive,
  isSniFailClosedError,
  validateSniRequestConfig,
} from './DesktopApiSniRequest';

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

  test('enforces bounded active requests and treats resource limits as fail-closed', () => {
    const limiter = new SniRequestLimiter(2, 1);
    const releaseFirst = limiter.acquire('Example.com', '93.184.216.34');

    expect(() => limiter.acquire('example.com', '93.184.216.34')).toThrow(
      /SNI_RESOURCE_LIMIT/,
    );

    const releaseSecond = limiter.acquire('example.com', '93.184.216.35');
    expect(() => limiter.acquire('example.net', '93.184.216.36')).toThrow(
      /SNI_RESOURCE_LIMIT/,
    );

    releaseFirst();
    const releaseReplacement = limiter.acquire('example.com', '93.184.216.34');
    releaseFirst();
    releaseSecond();
    releaseReplacement();

    expect(isSniFailClosedError(new Error('SNI_RESOURCE_LIMIT'))).toBe(true);
    expect(isSniFailClosedError(new Error('SNI_CANCELLED'))).toBe(true);
    expect(isSniFailClosedError(new Error('SNI_TLS_FAILED'))).toBe(true);
    expect(
      isSniFailClosedError(new Error('connect ssl.example.com failed')),
    ).toBe(false);
    expect(isSniFailClosedError(new Error('ECONNRESET'))).toBe(false);
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

    const firstRequest = api.request({ ...baseConfig(), requestId: 'same' });
    const secondRequest = api.request({ ...baseConfig(), requestId: 'same' });

    await expect(firstRequest).rejects.toThrow(/SNI_CANCELLED/);
    expect(
      (
        api as unknown as {
          activeRequests: Map<string, FakeClientRequest>;
        }
      ).activeRequests.get('same'),
    ).toBe(requests[1]);
    expect(requests[0].destroy).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SNI_CANCELLED' }),
    );

    requests[1].destroy(new Error('done'));
    await expect(secondRequest).rejects.toThrow('done');
    expect(
      (
        api as unknown as {
          activeRequests: Map<string, FakeClientRequest>;
        }
      ).activeRequests.has('same'),
    ).toBe(false);

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

    const firstRequest = api.request({ ...baseConfig(), requestId: 'req-1' });
    const firstAgent = requests[0].options.agent as https.Agent;
    const firstAgentDestroySpy = jest.spyOn(firstAgent, 'destroy');

    await api.clearDNSCache();

    expect(firstAgentDestroySpy).not.toHaveBeenCalled();
    expect(requests[0].destroy).not.toHaveBeenCalled();

    const secondRequest = api.request({ ...baseConfig(), requestId: 'req-2' });
    expect(requests[1].options.agent).not.toBe(firstAgent);

    requests[0].destroy(new Error('first done'));
    await expect(firstRequest).rejects.toThrow('first done');
    expect(firstAgentDestroySpy).toHaveBeenCalledTimes(1);

    requests[1].destroy(new Error('second done'));
    await expect(secondRequest).rejects.toThrow('second done');

    requestSpy.mockRestore();
  });
});

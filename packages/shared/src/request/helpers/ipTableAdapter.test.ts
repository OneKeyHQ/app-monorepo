import axios from 'axios';

import { OneKeyLocalError } from '../../errors';
import { getRequestHeaders } from '../Interceptor';
import requestHelper from '../requestHelper';

import {
  createIpTableAdapter,
  resetAdapterFailoverStatesForTesting,
  testIpSpeed,
} from './ipTableAdapter';
import { isProxyActiveForUrl, isSniSupported, sniRequest } from './sniRequest';

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

jest.mock('../requestHelper', () => ({
  __esModule: true,
  default: {
    getDevSettingsPersistAtom: jest.fn(),
    getIpTableConfig: jest.fn(),
  },
}));

jest.mock('../Interceptor', () => ({
  getRequestHeaders: jest.fn(),
}));

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      metrics: {
        endpointSwitched: jest.fn(),
        adapterFailover: jest.fn(),
        configVerifyFailed: jest.fn(),
      },
    },
  },
}));

jest.mock('./sniRequest', () => ({
  isProxyActiveForUrl: jest.fn(),
  isSniSupported: jest.fn(),
  sniRequest: jest.fn(),
}));

const mockedGetRequestHeaders = getRequestHeaders as jest.Mock;
const mockedRequestHelper = requestHelper as jest.Mocked<typeof requestHelper>;
const mockedIsProxyActiveForUrl = isProxyActiveForUrl as jest.Mock;
const mockedIsSniSupported = isSniSupported as jest.Mock;
const mockedSniRequest = sniRequest as jest.Mock;

function buildConfig(url: string): InternalAxiosRequestConfig {
  return {
    url,
    method: 'get',
    headers: axios.AxiosHeaders.from({}),
  } as InternalAxiosRequestConfig;
}

describe('ipTableAdapter SNI preflight and fail-closed behavior', () => {
  let originalAdapter: typeof axios.defaults.adapter;
  let fallbackAdapter: jest.Mock<
    Promise<AxiosResponse>,
    [InternalAxiosRequestConfig]
  >;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    originalAdapter = axios.defaults.adapter;
    fallbackAdapter = jest.fn(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    axios.defaults.adapter = fallbackAdapter;

    mockedIsSniSupported.mockReturnValue(true);
    mockedIsProxyActiveForUrl.mockResolvedValue(false);
    mockedSniRequest.mockReset();
    mockedGetRequestHeaders.mockResolvedValue({});
    mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
      settings: {},
    } as never);
    mockedRequestHelper.getIpTableConfig.mockResolvedValue({
      config: {
        version: 1,
        ttl_sec: 60,
        generated_at: '2026-06-30T00:00:00.000Z',
        signature: '',
        domains: {
          'example.com': {
            endpoints: [
              {
                ip: '93.184.216.34',
                provider: 'test',
                region: 'ALL',
                weight: 1,
              },
            ],
          },
        },
      },
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'example.com': '93.184.216.34',
        },
      },
    } as never);
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  test('falls back before SNI work when proxy preflight is active', async () => {
    mockedIsProxyActiveForUrl.mockResolvedValue(true);
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(buildConfig('https://api.example.com/v1')),
    ).resolves.toMatchObject({
      status: 200,
      data: { fallback: true },
    });

    expect(mockedIsProxyActiveForUrl).toHaveBeenCalledWith(
      'https://api.example.com/v1',
    );
    expect(mockedRequestHelper.getIpTableConfig).not.toHaveBeenCalled();
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('keeps legacy SNI path when proxy preflight capability is missing', async () => {
    mockedIsProxyActiveForUrl.mockResolvedValue(null);
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(buildConfig('https://api.example.com/v1')),
    ).resolves.toMatchObject({
      status: 200,
      data: { ok: true },
    });

    expect(mockedRequestHelper.getIpTableConfig).toHaveBeenCalledTimes(1);
    expect(mockedSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '93.184.216.34',
        hostname: 'api.example.com',
      }),
    );
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('falls back before IP selection when proxy preflight errors', async () => {
    mockedIsProxyActiveForUrl.mockRejectedValue(new Error('preflight failed'));
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(buildConfig('https://api.example.com/v1')),
    ).resolves.toMatchObject({
      status: 200,
      data: { fallback: true },
    });

    expect(mockedRequestHelper.getIpTableConfig).not.toHaveBeenCalled();
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('does not fallback after SNI starts and returns a fail-closed error', async () => {
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('certificate rejected'), {
        code: 'SNI_CERT_FAILED',
      }),
    );
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(buildConfig('https://api.example.com/v1')),
    ).rejects.toMatchObject({
      code: 'SNI_CERT_FAILED',
    });

    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('skips IP speed test when proxy preflight is active', async () => {
    mockedIsProxyActiveForUrl.mockResolvedValue(true);

    await expect(
      testIpSpeed('93.184.216.34', 'example.com', '/health'),
    ).resolves.toBe(Infinity);

    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('keeps legacy IP speed test when proxy preflight capability is missing', async () => {
    mockedIsProxyActiveForUrl.mockResolvedValue(null);
    mockedSniRequest.mockResolvedValue({
      statusCode: 204,
      headers: {},
      body: '',
    });

    await expect(
      testIpSpeed('93.184.216.34', 'example.com', '/health'),
    ).resolves.not.toBe(Infinity);

    expect(mockedSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '93.184.216.34',
        hostname: 'wallet.example.com',
      }),
    );
  });
});

describe('ipTableAdapter fail-open on domain network failures', () => {
  const BUILTIN_CN_IPS = [
    '104.18.20.233',
    '104.18.21.233',
    '216.19.3.115',
    '216.19.2.116',
    '216.19.4.106',
  ];

  let originalAdapter: typeof axios.defaults.adapter;
  let fallbackAdapter: jest.Mock<
    Promise<AxiosResponse>,
    [InternalAxiosRequestConfig]
  >;
  let consoleErrorSpy: jest.SpyInstance;

  function networkError() {
    // Transport-level failure: no HTTP response attached.
    return Object.assign(new Error('timeout of 30000ms exceeded'), {
      code: 'ECONNABORTED',
    });
  }

  function httpError(status: number) {
    return Object.assign(new Error(`Request failed with status ${status}`), {
      response: { status },
    });
  }

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    originalAdapter = axios.defaults.adapter;
    fallbackAdapter = jest.fn(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    axios.defaults.adapter = fallbackAdapter;

    mockedIsSniSupported.mockReturnValue(true);
    mockedIsProxyActiveForUrl.mockResolvedValue(false);
    mockedSniRequest.mockReset();
    mockedGetRequestHeaders.mockResolvedValue({});
    mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
      settings: {},
    } as never);
    // Simulate the main runtime / cold-start window: no config installed.
    mockedRequestHelper.getIpTableConfig.mockResolvedValue(null as never);
    resetAdapterFailoverStatesForTesting();
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    consoleErrorSpy.mockRestore();
    resetAdapterFailoverStatesForTesting();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  async function failNTimes(n: number) {
    fallbackAdapter.mockImplementation(async () => {
      throw networkError();
    });
    for (let i = 0; i < n; i += 1) {
      await expect(
        createIpTableAdapter({})(
          buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
        ),
      ).rejects.toMatchObject({ code: 'ECONNABORTED' });
    }
  }

  test('activates fail-open after 3 consecutive network errors and routes next request via builtin ip', async () => {
    await failNTimes(3);
    expect(mockedSniRequest).not.toHaveBeenCalled();

    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });

    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ status: 200, data: { ok: true } });

    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    const sniArgs = mockedSniRequest.mock.calls[0][0] as {
      ip: string;
      hostname: string;
    };
    expect(BUILTIN_CN_IPS).toContain(sniArgs.ip);
    expect(sniArgs.hostname).toBe('wallet.onekeycn.com');
  });

  test('does not replay the failing request itself', async () => {
    await failNTimes(3);
    // Every one of the 3 failing requests must reject; no hidden retry via SNI.
    expect(fallbackAdapter).toHaveBeenCalledTimes(3);
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('http error responses do not count as network failures', async () => {
    fallbackAdapter.mockImplementation(async () => {
      throw httpError(500);
    });
    for (let i = 0; i < 3; i += 1) {
      await expect(
        createIpTableAdapter({})(
          buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
        ),
      ).rejects.toMatchObject({ response: { status: 500 } });
    }

    // Next request still goes direct domain: fail-open must not be active.
    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('a success resets the consecutive failure counter', async () => {
    await failNTimes(2);
    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await createIpTableAdapter({})(
      buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
    );
    await failNTimes(2);

    // 2 + reset + 2 consecutive failures: threshold (3) not reached.
    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('fail-open expires after its TTL window', async () => {
    await failNTimes(3);

    const realNow = Date.now();
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(realNow + 5 * 60_000 + 1);

    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  test('kill switch disables fail-open entirely', async () => {
    mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
      enabled: true,
      settings: { disableIpTableFailover: true },
    } as never);

    await failNTimes(3);

    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('flipping the kill switch while fail-open is active takes effect immediately', async () => {
    await failNTimes(3);

    // Circuit is open now; turn the kill switch on afterwards.
    mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
      enabled: true,
      settings: { disableIpTableFailover: true },
    } as never);

    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('cancellations do not count as transport failures', async () => {
    fallbackAdapter.mockImplementation(async () => {
      throw Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' });
    });
    for (let i = 0; i < 3; i += 1) {
      await expect(
        createIpTableAdapter({})(
          buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
        ),
      ).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    }

    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('errors without an allowlisted transport code do not count', async () => {
    fallbackAdapter.mockImplementation(async () => {
      throw Object.assign(
        new OneKeyLocalError('something exploded internally'),
        {
          code: 'SOME_INTERNAL_ERROR',
        },
      );
    });
    for (let i = 0; i < 3; i += 1) {
      await expect(
        createIpTableAdapter({})(
          buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
        ),
      ).rejects.toMatchObject({ message: 'something exploded internally' });
    }

    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('a domain success on another hostname does not close the circuit', async () => {
    // wallet.* opens the circuit.
    await failNTimes(3);

    // While the circuit is open, utility.* goes via SNI too; make its SNI
    // attempt fail ambiguously (GET is idempotent -> falls back to domain)
    // and let the domain succeed. That domain success comes from a hostname
    // that did NOT open the circuit, so the circuit must stay open.
    fallbackAdapter.mockImplementation(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    mockedSniRequest.mockRejectedValueOnce(
      Object.assign(new Error('sni timeout'), { code: 'SNI_TIMEOUT' }),
    );
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://utility.onekeycn.com/utility/v1/something'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });

    // wallet traffic must still route via SNI (circuit still open).
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ status: 200, data: { ok: true } });
    const lastSniCall = mockedSniRequest.mock.calls.at(-1)?.[0] as {
      hostname: string;
    };
    expect(lastSniCall.hostname).toBe('wallet.onekeycn.com');
  });

  test('a late success from a request started before activation does not close the circuit', async () => {
    // One shared implementation routed by URL marker so the in-flight stale
    // request is unaffected when the failing behavior is exercised.
    let resolveStale: (() => void) | undefined;
    const stalePending = new Promise<void>((resolve) => {
      resolveStale = resolve;
    });
    fallbackAdapter.mockImplementation(async (config) => {
      if (config.url?.includes('stale-probe')) {
        await stalePending;
        return {
          data: { stale: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      }
      throw networkError();
    });

    const staleRequest = createIpTableAdapter({})(
      buildConfig('https://wallet.onekeycn.com/wallet/v1/stale-probe'),
    );
    // Ensure the stale request's transport start timestamp precedes the
    // activation timestamp deterministically.
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });

    // Open the circuit with 3 fresh transport failures.
    for (let i = 0; i < 3; i += 1) {
      await expect(
        createIpTableAdapter({})(
          buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
        ),
      ).rejects.toMatchObject({ code: 'ECONNABORTED' });
    }

    // Let the stale request resolve successfully AFTER activation.
    resolveStale?.();
    await expect(staleRequest).resolves.toMatchObject({
      data: { stale: true },
    });

    // Circuit must still be open: next request goes via SNI.
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).resolves.toMatchObject({ status: 200, data: { ok: true } });
    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
  });
});

describe('ipTableAdapter idempotency-gated fallback after SNI started', () => {
  let originalAdapter: typeof axios.defaults.adapter;
  let fallbackAdapter: jest.Mock<
    Promise<AxiosResponse>,
    [InternalAxiosRequestConfig]
  >;
  let consoleErrorSpy: jest.SpyInstance;

  function buildMethodConfig(
    url: string,
    method: string,
  ): InternalAxiosRequestConfig {
    return {
      url,
      method,
      headers: axios.AxiosHeaders.from({}),
    } as InternalAxiosRequestConfig;
  }

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    originalAdapter = axios.defaults.adapter;
    fallbackAdapter = jest.fn(async (config) => ({
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    axios.defaults.adapter = fallbackAdapter;

    mockedIsSniSupported.mockReturnValue(true);
    mockedIsProxyActiveForUrl.mockResolvedValue(false);
    mockedSniRequest.mockReset();
    mockedGetRequestHeaders.mockResolvedValue({});
    mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
      settings: {},
    } as never);
    mockedRequestHelper.getIpTableConfig.mockResolvedValue({
      config: {
        version: 1,
        ttl_sec: 60,
        generated_at: '2026-06-30T00:00:00.000Z',
        signature: '',
        domains: {
          'example.com': {
            endpoints: [
              {
                ip: '93.184.216.34',
                provider: 'test',
                region: 'ALL',
                weight: 1,
              },
            ],
          },
        },
      },
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'example.com': '93.184.216.34',
        },
      },
    } as never);
    resetAdapterFailoverStatesForTesting();
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    consoleErrorSpy.mockRestore();
    resetAdapterFailoverStatesForTesting();
    jest.clearAllMocks();
  });

  test('GET falls back to domain after an ambiguous SNI timeout', async () => {
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('sni timeout'), { code: 'SNI_TIMEOUT' }),
    );
    await expect(
      createIpTableAdapter({})(
        buildMethodConfig('https://api.example.com/v1', 'get'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('POST does NOT fall back after an ambiguous SNI timeout (double-send risk)', async () => {
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('sni timeout'), { code: 'SNI_TIMEOUT' }),
    );
    await expect(
      createIpTableAdapter({})(
        buildMethodConfig('https://api.example.com/v1', 'post'),
      ),
    ).rejects.toMatchObject({ code: 'SNI_TIMEOUT' });
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('POST falls back when the error proves the connection was never established', async () => {
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('connection refused'), {
        code: 'SNI_CONNECTION_REFUSED',
      }),
    );
    await expect(
      createIpTableAdapter({})(
        buildMethodConfig('https://api.example.com/v1', 'post'),
      ),
    ).resolves.toMatchObject({ data: { fallback: true } });
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('POST does NOT fall back when SNI returns a null response', async () => {
    mockedSniRequest.mockResolvedValue(null);
    await expect(
      createIpTableAdapter({})(
        buildMethodConfig('https://api.example.com/v1', 'post'),
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining('not idempotent'),
    });
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });
});

import axios from 'axios';

import { OneKeyLocalError } from '../../errors';
import { EOneKeyErrorClassNames } from '../../errors/types/errorTypes';
import { getRequestHeaders } from '../Interceptor';
import requestHelper from '../requestHelper';

import {
  createIpTableAdapter,
  isIpTableTransportError,
  resetAdapterFailoverStatesForTesting,
  setReportRequestFailureCallback,
  testIpSpeed,
} from './ipTableAdapter';
import { isProxyActiveForUrl, isSniSupported, sniRequest } from './sniRequest';

import type { IAvailabilityOutcome } from '../availabilityAggregator';
import type { IApiAvailabilityTiming } from '../availabilityMetrics';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const mockAvailabilityOutcomes: IAvailabilityOutcome[] = [];

jest.mock('../availabilityAggregator', () => ({
  recordAvailabilityOutcome: (outcome: IAvailabilityOutcome) => {
    mockAvailabilityOutcomes.push(outcome);
  },
}));

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
const mockedLogger = jest.requireMock('../../logger/logger') as {
  defaultLogger: { ipTable: { request: { warn: jest.Mock } } };
};

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

  test('does no preflight work for an already aborted request', async () => {
    const adapter = createIpTableAdapter({});
    const controller = new AbortController();
    const config = buildConfig('https://api.example.com/v1');
    config.signal = controller.signal;
    controller.abort();

    await expect(adapter(config)).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });

    expect(mockedIsSniSupported).not.toHaveBeenCalled();
    expect(mockedIsProxyActiveForUrl).not.toHaveBeenCalled();
    expect(
      mockedRequestHelper.getDevSettingsPersistAtom,
    ).not.toHaveBeenCalled();
    expect(mockedRequestHelper.getIpTableConfig).not.toHaveBeenCalled();
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('aborts immediately while proxy preflight is pending', async () => {
    let resolvePreflight: ((value: boolean) => void) | undefined;
    mockedIsProxyActiveForUrl.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreflight = resolve;
        }),
    );
    const adapter = createIpTableAdapter({});
    const controller = new AbortController();
    const config = buildConfig('https://api.example.com/v1');
    config.signal = controller.signal;

    const responsePromise = adapter(config);
    controller.abort();

    await expect(responsePromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    expect(mockedRequestHelper.getIpTableConfig).not.toHaveBeenCalled();
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(fallbackAdapter).not.toHaveBeenCalled();
    resolvePreflight?.(false);
  });

  test('aborts immediately while IP selection is pending', async () => {
    let resolveDevSettings:
      | ((value: { settings: Record<string, never> }) => void)
      | undefined;
    mockedRequestHelper.getDevSettingsPersistAtom.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDevSettings = resolve;
        }) as never,
    );
    const adapter = createIpTableAdapter({});
    const controller = new AbortController();
    const config = buildConfig('https://pending.example.com/v1');
    config.signal = controller.signal;

    const responsePromise = adapter(config);
    for (let index = 0; index < 4; index += 1) {
      // Allow the resolved proxy preflight to advance into IP selection.
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    expect(mockedRequestHelper.getDevSettingsPersistAtom).toHaveBeenCalled();
    controller.abort();

    await expect(responsePromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    expect(mockedRequestHelper.getIpTableConfig).not.toHaveBeenCalled();
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(fallbackAdapter).not.toHaveBeenCalled();
    resolveDevSettings?.({ settings: {} });
    await Promise.resolve();
    await Promise.resolve();
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
    const controller = new AbortController();
    const config = buildConfig('https://api.example.com/v1');
    config.signal = controller.signal;

    await expect(adapter(config)).resolves.toMatchObject({
      status: 200,
      data: { ok: true },
    });

    expect(mockedRequestHelper.getIpTableConfig).toHaveBeenCalledTimes(1);
    expect(mockedSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '93.184.216.34',
        hostname: 'api.example.com',
      }),
      { signal: controller.signal },
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

  test('a certificate failure stays fail-closed and surfaces as an ordinary network error', async () => {
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('certificate rejected'), {
        code: 'SNI_CERT_FAILED',
      }),
    );
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(buildConfig('https://api.example.com/v1')),
    ).rejects.toMatchObject({
      name: 'AxiosError',
      code: 'ERR_NETWORK',
      message: 'Network Error',
      cause: { code: 'SNI_CERT_FAILED' },
    });

    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  describe('availability metrics context', () => {
    function buildTimedConfig(url: string) {
      const config = buildConfig(url);
      const timing: IApiAvailabilityTiming = {
        startedAt: 0,
        service: 'wallet',
        routeGroup: '/v1',
      };
      config.$oneKeyAvailabilityTiming = timing;
      return { config, timing };
    }

    beforeEach(() => {
      mockAvailabilityOutcomes.length = 0;
      resetAdapterFailoverStatesForTesting();
    });

    test('marks the route and proxy state each request takes', async () => {
      const adapter = createIpTableAdapter({});
      mockedSniRequest.mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}',
      });
      const sni = buildTimedConfig('https://metrics-sni.example.com/v1');
      await adapter(sni.config);
      expect(sni.timing).toMatchObject({ route: 'sni', proxyActive: false });

      mockedSniRequest.mockRejectedValue(new Error('connection reset'));
      const fallback = buildTimedConfig('https://metrics-fb.example.com/v1');
      await adapter(fallback.config);
      expect(fallback.timing.route).toBe('fallback');

      mockedIsProxyActiveForUrl.mockResolvedValue(true);
      const proxied = buildTimedConfig('https://metrics-proxy.example.com/v1');
      await adapter(proxied.config);
      expect(proxied.timing).toMatchObject({
        route: 'domain',
        proxyActive: true,
      });
      expect(mockAvailabilityOutcomes).toHaveLength(0);
    });

    test('records errors raised by the adapter itself with their context', async () => {
      mockedSniRequest.mockRejectedValue(
        Object.assign(new Error('certificate rejected'), {
          code: 'SNI_CERT_FAILED',
        }),
      );
      const { config, timing } = buildTimedConfig(
        'https://metrics-closed.example.com/v1',
      );

      // The caller sees the domain shape; metrics keep the native code.
      await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
        code: 'ERR_NETWORK',
      });

      expect(timing.reported).toBe(true);
      expect(mockAvailabilityOutcomes).toEqual([
        expect.objectContaining({
          source: 'api',
          status: 'network_error',
          failure: { detail: 'sni:/v1', errorCode: 'sni_cert_failed' },
        }),
        expect.objectContaining({ source: 'api_net', status: 'failed' }),
        expect.objectContaining({ source: 'api_route', target: 'sni' }),
        expect.objectContaining({ source: 'api_proxy', target: 'off' }),
        expect.objectContaining({ source: 'api_ip_table', target: 'enabled' }),
      ]);
    });

    test.each([
      [
        'noConfig',
        () => mockedRequestHelper.getIpTableConfig.mockResolvedValue(null),
      ],
      [
        'disabled',
        () =>
          mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
            settings: { disableIpTableInProd: true },
          } as never),
      ],
    ])(
      'labels proxied requests with the current IP Table state (%s)',
      async (state, arrange) => {
        arrange();
        mockedIsProxyActiveForUrl.mockResolvedValue(true);
        fallbackAdapter.mockRejectedValueOnce(new Error('offline'));
        const { config } = buildTimedConfig(
          `https://metrics-proxy-${mockAvailabilityOutcomes.length}${state.length}.example.com/v1`,
        );

        await expect(createIpTableAdapter({})(config)).rejects.toThrow(
          'offline',
        );

        expect(mockAvailabilityOutcomes).toContainEqual(
          expect.objectContaining({ source: 'api_ip_table', target: state }),
        );
      },
    );
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

describe('isIpTableTransportError', () => {
  test('recognizes the normalized Axios network error used by the global interceptor', () => {
    expect(
      isIpTableTransportError({
        code: -99_999,
        className: EOneKeyErrorClassNames.AxiosNetworkError,
        message: 'Network error',
      }),
    ).toBe(true);
  });

  test('does not treat an HTTP response as a transport failure', () => {
    expect(
      isIpTableTransportError({
        className: EOneKeyErrorClassNames.AxiosNetworkError,
        response: { status: 503 },
      }),
    ).toBe(false);
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
    expect(sniArgs.ip).toBe(BUILTIN_CN_IPS[0]);
    expect(sniArgs.hostname).toBe('wallet.onekeycn.com');
  });

  test('maps data.onekey.so fail-open to the first onekeycn.com builtin IP', async () => {
    fallbackAdapter.mockImplementation(async () => {
      throw networkError();
    });
    for (let i = 0; i < 3; i += 1) {
      await expect(
        createIpTableAdapter({})(
          buildConfig('https://data.onekey.so/config.json'),
        ),
      ).rejects.toMatchObject({ code: 'ECONNABORTED' });
    }

    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });

    await expect(
      createIpTableAdapter({})(
        buildConfig('https://data.onekey.so/config.json'),
      ),
    ).resolves.toMatchObject({ status: 200, data: { ok: true } });
    expect(mockedSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: BUILTIN_CN_IPS[0],
        hostname: 'data.onekey.so',
      }),
      { signal: undefined },
    );
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

  test('an http error response resets the consecutive failure counter', async () => {
    // 2 transport failures, then a 500 response, then 2 more transport
    // failures: without the reset this would be 4 "consecutive" failures
    // and the circuit would open despite proof the path works.
    await failNTimes(2);
    fallbackAdapter.mockImplementation(async () => {
      throw httpError(500);
    });
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
      ),
    ).rejects.toMatchObject({ response: { status: 500 } });
    await failNTimes(2);

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

  test('a late failure from a request started before a newer success does not count', async () => {
    // Both transports start in the same wall-clock millisecond. Ordering must
    // come from the runtime request sequence, not Date.now().
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    // Request A starts first and fails slowly; request B starts later and
    // succeeds before A's failure lands. B's success must leave its outcome
    // mark even though no failure entry existed yet, making A's late
    // failure stale — otherwise a recovered hostname would accumulate
    // toward fail-open.
    let releaseSlowFail: (() => void) | undefined;
    const slowFailGate = new Promise<void>((resolve) => {
      releaseSlowFail = resolve;
    });
    fallbackAdapter.mockImplementation(async (config) => {
      if (config.url?.includes('slow-fail')) {
        await slowFailGate;
        throw networkError();
      }
      if (config.url?.includes('ok-probe')) {
        return {
          data: { probe: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      }
      throw networkError();
    });

    const slowFailing = createIpTableAdapter({})(
      buildConfig('https://wallet.onekeycn.com/wallet/v1/slow-fail'),
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });

    // Later-started success completes first.
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/ok-probe'),
      ),
    ).resolves.toMatchObject({ data: { probe: true } });

    // Now the early-started failure lands: it must be ignored as stale.
    releaseSlowFail?.();
    await expect(slowFailing).rejects.toMatchObject({ code: 'ECONNABORTED' });

    // Two fresh failures: total applied failures is 2, not 3.
    for (let i = 0; i < 2; i += 1) {
      await expect(
        createIpTableAdapter({})(
          buildConfig('https://wallet.onekeycn.com/wallet/v1/health'),
        ),
      ).rejects.toMatchObject({ code: 'ECONNABORTED' });
    }

    // The circuit must still be closed: the next request goes via domain.
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/ok-probe'),
      ),
    ).resolves.toMatchObject({ data: { probe: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('a late middle success retracts a fail-open based on non-consecutive failures', async () => {
    // Request order: fail 1, success 2, fail 3, fail 4. Completion order:
    // fail 1, fail 3, fail 4, success 2. The first three completions can open
    // the circuit provisionally, but success 2 later cuts off failure 1 and
    // leaves only failures 3 and 4, below the threshold.
    let releaseLateSuccess: (() => void) | undefined;
    const lateSuccessGate = new Promise<void>((resolve) => {
      releaseLateSuccess = resolve;
    });
    fallbackAdapter.mockImplementation(async (config) => {
      if (config.url?.includes('late-success')) {
        await lateSuccessGate;
        return {
          data: { lateSuccess: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      }
      if (config.url?.includes('direct-ok')) {
        return {
          data: { direct: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      }
      throw networkError();
    });

    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/fail-1'),
      ),
    ).rejects.toMatchObject({ code: 'ECONNABORTED' });
    const lateSuccess = createIpTableAdapter({})(
      buildConfig('https://wallet.onekeycn.com/wallet/v1/late-success'),
    );
    await Promise.resolve();
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/fail-3'),
      ),
    ).rejects.toMatchObject({ code: 'ECONNABORTED' });
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/fail-4'),
      ),
    ).rejects.toMatchObject({ code: 'ECONNABORTED' });

    releaseLateSuccess?.();
    await expect(lateSuccess).resolves.toMatchObject({
      data: { lateSuccess: true },
    });

    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"sni":true}',
    });
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/direct-ok'),
      ),
    ).resolves.toMatchObject({ data: { direct: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('after recovery closes the circuit, old failures landing later stay stale', async () => {
    // Three slow requests start BEFORE anything goes wrong. The circuit then
    // opens, recovers (which must preserve the per-hostname watermark), and
    // only afterwards do the three old failures land: they must all be
    // stale — if deactivation had cleared the outcome state they would re-open
    // circuit on a link that already proved healthy.
    let releaseOldFailures: (() => void) | undefined;
    const oldFailureGate = new Promise<void>((resolve) => {
      releaseOldFailures = resolve;
    });
    fallbackAdapter.mockImplementation(async (config) => {
      if (config.url?.includes('old-slow-fail')) {
        await oldFailureGate;
        throw networkError();
      }
      if (config.url?.includes('ok-probe')) {
        return {
          data: { probe: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      }
      throw networkError();
    });

    const oldSlowFailures = [1, 2, 3].map((i) =>
      createIpTableAdapter({})(
        buildConfig(`https://wallet.onekeycn.com/wallet/v1/old-slow-fail-${i}`),
      ),
    );
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

    // Recover: circuit is open, so the probe goes SNI first; an ambiguous
    // timeout on a GET falls back to the domain, and that domain success
    // (activated hostname, started after activation) closes the circuit.
    mockedSniRequest.mockRejectedValueOnce(
      Object.assign(new Error('sni timeout'), { code: 'SNI_TIMEOUT' }),
    );
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/ok-probe'),
      ),
    ).resolves.toMatchObject({ data: { probe: true } });

    // Old failures land only now — after recovery.
    releaseOldFailures?.();
    for (const pending of oldSlowFailures) {
      await expect(pending).rejects.toMatchObject({ code: 'ECONNABORTED' });
    }

    // Circuit must still be closed: next request goes via domain, not SNI.
    mockedSniRequest.mockClear();
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/ok-probe'),
      ),
    ).resolves.toMatchObject({ data: { probe: true } });
    expect(mockedSniRequest).not.toHaveBeenCalled();
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

  test('one recovered hostname does not close fail-open for another activated hostname', async () => {
    let releaseWalletFailures: (() => void) | undefined;
    let releaseUtilityFailures: (() => void) | undefined;
    let markAllRequestsStarted: (() => void) | undefined;
    const walletFailureGate = new Promise<void>((resolve) => {
      releaseWalletFailures = resolve;
    });
    const utilityFailureGate = new Promise<void>((resolve) => {
      releaseUtilityFailures = resolve;
    });
    const allRequestsStarted = new Promise<void>((resolve) => {
      markAllRequestsStarted = resolve;
    });
    let startedRequests = 0;

    fallbackAdapter.mockImplementation(async (config) => {
      startedRequests += 1;
      if (startedRequests === 6) {
        markAllRequestsStarted?.();
      }
      const hostname = config.url ? new URL(config.url).hostname : '';
      if (hostname === 'wallet.onekeycn.com') {
        await walletFailureGate;
      } else {
        await utilityFailureGate;
      }
      throw networkError();
    });

    // Start both hostnames while the circuit is closed, then let each group
    // independently reach the threshold under the same root domain.
    const walletFailures = Array.from({ length: 3 }, (_, index) =>
      createIpTableAdapter({})(
        buildConfig(`https://wallet.onekeycn.com/wallet/v1/fail-${index}`),
      ),
    );
    const utilityFailures = Array.from({ length: 3 }, (_, index) =>
      createIpTableAdapter({})(
        buildConfig(`https://utility.onekeycn.com/utility/v1/fail-${index}`),
      ),
    );
    await allRequestsStarted;

    releaseWalletFailures?.();
    for (const pending of walletFailures) {
      await expect(pending).rejects.toMatchObject({ code: 'ECONNABORTED' });
    }
    releaseUtilityFailures?.();
    for (const pending of utilityFailures) {
      await expect(pending).rejects.toMatchObject({ code: 'ECONNABORTED' });
    }

    // Recover only wallet.* through the domain fallback. utility.* still has
    // its own threshold of failures and must keep the root-domain circuit open.
    mockedSniRequest.mockRejectedValueOnce(
      Object.assign(new Error('sni timeout'), { code: 'SNI_TIMEOUT' }),
    );
    fallbackAdapter.mockImplementation(async (config) => ({
      data: { recovered: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://wallet.onekeycn.com/wallet/v1/recover'),
      ),
    ).resolves.toMatchObject({ data: { recovered: true } });

    mockedSniRequest.mockClear();
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"utility":true}',
    });
    await expect(
      createIpTableAdapter({})(
        buildConfig('https://utility.onekeycn.com/utility/v1/health'),
      ),
    ).resolves.toMatchObject({ data: { utility: true } });
    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(mockedSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'utility.onekeycn.com' }),
      { signal: undefined },
    );
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
    ).rejects.toMatchObject({
      code: 'ECONNABORTED',
      cause: { code: 'SNI_TIMEOUT' },
    });
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

  test('POST does NOT fall back on SNI_NETWORK_UNREACHABLE (iOS maps connection-lost to it)', async () => {
    // NSURLErrorNetworkConnectionLost — which can fire after the body was
    // sent — maps to SNI_NETWORK_UNREACHABLE on iOS, so this code cannot
    // prove the request was never written.
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('network unreachable'), {
        code: 'SNI_NETWORK_UNREACHABLE',
      }),
    );
    await expect(
      createIpTableAdapter({})(
        buildMethodConfig('https://api.example.com/v1', 'post'),
      ),
    ).rejects.toMatchObject({
      code: 'ERR_NETWORK',
      cause: { code: 'SNI_NETWORK_UNREACHABLE' },
    });
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('POST does NOT fall back when SNI returns a null response', async () => {
    mockedSniRequest.mockResolvedValue(null);
    await expect(
      createIpTableAdapter({})(
        buildMethodConfig('https://api.example.com/v1', 'post'),
      ),
    ).rejects.toMatchObject({
      code: 'ERR_NETWORK',
      cause: { message: expect.stringContaining('not idempotent') },
    });
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('one sni attempt reports at most one ip failure (null response + blocked fallback)', async () => {
    // The null-response branch reports an ip failure, then throws for
    // non-idempotent requests; the outer catch must not report the same
    // failure a second time.
    const failureSpy = jest.fn();
    setReportRequestFailureCallback(failureSpy);
    try {
      mockedSniRequest.mockResolvedValue(null);
      await expect(
        createIpTableAdapter({})(
          buildMethodConfig('https://api.example.com/v1', 'post'),
        ),
      ).rejects.toMatchObject({ code: 'ERR_NETWORK' });
      expect(failureSpy).toHaveBeenCalledTimes(1);
      expect(failureSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestType: 'ip',
          target: '93.184.216.34',
          requestSequence: expect.any(Number),
        }),
      );
    } finally {
      setReportRequestFailureCallback(() => undefined);
    }
  });

  describe('TLS failures and the selected IP stepping aside', () => {
    const SNI_BYPASS_TTL_MS = 60_000;

    function tlsError() {
      return Object.assign(
        new Error('TLS handshake failed: SSL connect error'),
        { code: 'SNI_TLS_FAILED' },
      );
    }

    function request(method: string, timing?: IApiAvailabilityTiming) {
      const config = buildMethodConfig('https://api.example.com/v1', method);
      if (timing) {
        config.$oneKeyAvailabilityTiming = timing;
      }
      return createIpTableAdapter({})(config);
    }

    async function failPostsOverSni(n: number) {
      mockedSniRequest.mockRejectedValue(tlsError());
      for (let i = 0; i < n; i += 1) {
        await expect(request('post')).rejects.toMatchObject({
          code: 'ERR_NETWORK',
        });
      }
    }

    // Holds the next domain request until the test settles it.
    function holdNextDomainRequest() {
      const held: { succeed?: () => void; fail?: () => void } = {};
      fallbackAdapter.mockImplementationOnce(
        (config) =>
          new Promise((resolve, reject) => {
            held.succeed = () =>
              resolve({
                data: { fallback: true },
                status: 200,
                statusText: 'OK',
                headers: {},
                config,
                request: {},
              });
            held.fail = () =>
              reject(
                Object.assign(new Error('Network Error'), {
                  code: 'ERR_NETWORK',
                }),
              );
          }),
      );
      return held;
    }

    async function waitForDomainRequests(n: number) {
      for (let i = 0; i < 50 && fallbackAdapter.mock.calls.length < n; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      expect(fallbackAdapter).toHaveBeenCalledTimes(n);
    }

    test('GET falls back to the domain after a TLS failure on the selected IP', async () => {
      mockedSniRequest.mockRejectedValue(tlsError());
      await expect(request('get')).resolves.toMatchObject({
        data: { fallback: true },
      });
      expect(fallbackAdapter).toHaveBeenCalledTimes(1);
      expect(
        mockedLogger.defaultLogger.ipTable.request.warn,
      ).toHaveBeenCalledWith({
        info: expect.stringMatching(
          /event=sni_fail_closed .*code=SNI_TLS_FAILED .*decision=fallback_domain/,
        ),
      });
    });

    test.each(['SNI_TLS_FAILED', 'SNI_CERT_FAILED', 'SNI_RESPONSE_FAILED'])(
      'a POST failing with %s counts against the IP and never leaks transport text',
      async (code) => {
        const failureSpy = jest.fn();
        setReportRequestFailureCallback(failureSpy);
        try {
          mockedSniRequest.mockRejectedValue(
            Object.assign(new Error(`native detail for ${code}`), { code }),
          );
          await expect(request('post')).rejects.toMatchObject({
            name: 'AxiosError',
            code: 'ERR_NETWORK',
            message: 'Network Error',
          });
          expect(fallbackAdapter).not.toHaveBeenCalled();
          expect(failureSpy).toHaveBeenCalledTimes(1);
          expect(failureSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              requestType: 'ip',
              target: '93.184.216.34',
            }),
          );
        } finally {
          setReportRequestFailureCallback(() => undefined);
        }
      },
    );

    test('after 3 consecutive failures requests skip the SNI transport', async () => {
      await failPostsOverSni(3);

      const timing: IApiAvailabilityTiming = {
        startedAt: 0,
        service: 'wallet',
        routeGroup: '/v1',
      };
      await expect(request('post', timing)).resolves.toMatchObject({
        data: { fallback: true },
      });
      expect(mockedSniRequest).toHaveBeenCalledTimes(3);
      expect(timing.route).toBe('bypass');
    });

    test('the kill switch keeps every request on the selected IP', async () => {
      mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
        settings: { disableIpTableFailover: true },
      } as never);
      await failPostsOverSni(4);

      expect(mockedSniRequest).toHaveBeenCalledTimes(4);
      expect(fallbackAdapter).not.toHaveBeenCalled();

      // Failures seen while it was on do not count once it is lifted.
      mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
        settings: {},
      } as never);
      await failPostsOverSni(2);
      expect(mockedSniRequest).toHaveBeenCalledTimes(6);
      expect(fallbackAdapter).not.toHaveBeenCalled();
    });

    test('after the window only an idempotent request probes the IP, and its success restores it', async () => {
      await failPostsOverSni(3);
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValue(Date.now() + SNI_BYPASS_TTL_MS + 1);
      try {
        await expect(request('post')).resolves.toMatchObject({
          data: { fallback: true },
        });
        expect(mockedSniRequest).toHaveBeenCalledTimes(3);

        mockedSniRequest.mockResolvedValue({
          statusCode: 200,
          headers: {},
          body: '{"sni":true}',
        });
        await expect(request('get')).resolves.toMatchObject({
          data: { sni: true },
        });
        await expect(request('post')).resolves.toMatchObject({
          data: { sni: true },
        });
        expect(mockedSniRequest).toHaveBeenCalledTimes(5);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('a failed probe reopens the window at once', async () => {
      await failPostsOverSni(3);
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValue(Date.now() + SNI_BYPASS_TTL_MS + 1);
      try {
        await expect(request('get')).resolves.toMatchObject({
          data: { fallback: true },
        });
        expect(mockedSniRequest).toHaveBeenCalledTimes(4);

        await expect(request('get')).resolves.toMatchObject({
          data: { fallback: true },
        });
        expect(mockedSniRequest).toHaveBeenCalledTimes(4);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('a domain failure during the window is reported and hands requests back to the IP', async () => {
      await failPostsOverSni(3);
      const failureSpy = jest.fn();
      setReportRequestFailureCallback(failureSpy);
      try {
        fallbackAdapter.mockRejectedValueOnce(
          Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }),
        );
        await expect(request('post')).rejects.toMatchObject({
          code: 'ERR_NETWORK',
        });
        expect(mockedSniRequest).toHaveBeenCalledTimes(3);
        expect(failureSpy).toHaveBeenCalledWith(
          expect.objectContaining({ requestType: 'domain' }),
        );

        await expect(request('post')).rejects.toMatchObject({
          code: 'ERR_NETWORK',
        });
        expect(mockedSniRequest).toHaveBeenCalledTimes(4);
      } finally {
        setReportRequestFailureCallback(() => undefined);
      }
    });

    test.each<[string, boolean]>([
      ['the newer success lands first', true],
      ['the older failure lands first', false],
    ])(
      'a newer domain success outweighs an older domain failure (%s)',
      async (_order, successFirst) => {
        await failPostsOverSni(3);
        const older = holdNextDomainRequest();
        const olderRequest = request('post');
        await waitForDomainRequests(1);
        const newer = holdNextDomainRequest();
        const newerRequest = request('post');
        await waitForDomainRequests(2);

        const settleNewer = async () => {
          newer.succeed?.();
          await expect(newerRequest).resolves.toMatchObject({
            data: { fallback: true },
          });
        };
        const settleOlder = async () => {
          older.fail?.();
          await expect(olderRequest).rejects.toMatchObject({
            code: 'ERR_NETWORK',
          });
        };
        if (successFirst) {
          await settleNewer();
          await settleOlder();
        } else {
          await settleOlder();
          await settleNewer();
        }

        await expect(request('post')).resolves.toMatchObject({
          data: { fallback: true },
        });
        expect(mockedSniRequest).toHaveBeenCalledTimes(3);
      },
    );

    test.each<[string, boolean]>([
      ['the probe fails first', true],
      ['the domain request fails first', false],
    ])(
      'a failed probe outweighs an older domain failure (%s)',
      async (_order, probeFirst) => {
        await failPostsOverSni(3);
        const inFlight = holdNextDomainRequest();
        const domainRequest = request('post');
        await waitForDomainRequests(1);
        const nowSpy = jest
          .spyOn(Date, 'now')
          .mockReturnValue(Date.now() + SNI_BYPASS_TTL_MS + 1);
        try {
          // The probe fails on the IP and falls back to the domain.
          const failProbe = async () => {
            await expect(request('get')).resolves.toMatchObject({
              data: { fallback: true },
            });
          };
          const failDomainRequest = async () => {
            inFlight.fail?.();
            await expect(domainRequest).rejects.toMatchObject({
              code: 'ERR_NETWORK',
            });
          };
          if (probeFirst) {
            await failProbe();
            await failDomainRequest();
          } else {
            await failDomainRequest();
            await failProbe();
          }
          expect(mockedSniRequest).toHaveBeenCalledTimes(4);

          await expect(request('post')).resolves.toMatchObject({
            data: { fallback: true },
          });
          expect(mockedSniRequest).toHaveBeenCalledTimes(4);
        } finally {
          nowSpy.mockRestore();
        }
      },
    );
  });
});

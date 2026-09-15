import axios from 'axios';

import { OneKeyLocalError } from '../../errors';
import { EOneKeyErrorClassNames } from '../../errors/types/errorTypes';
import platformEnv from '../../platformEnv';
import {
  getAvailabilityIpTableState,
  getAvailabilityNetworkType,
  getAvailabilityProxyState,
  noteAvailabilityProxyPreflight,
  resetAvailabilityContextForTest,
  setAvailabilityIpTableState,
} from '../availabilityContext';
import { createApiAvailabilityTiming } from '../availabilityMetrics';
import { getRequestHeaders } from '../Interceptor';
import requestHelper from '../requestHelper';

import {
  createIpTableAdapter,
  isIpTableTransportError,
  resetAdapterFailoverStatesForTesting,
  resetIpTableAvailabilityStateRefreshForTesting,
  setReportRequestFailureCallback,
  testIpSpeed,
} from './ipTableAdapter';
import { isProxyActiveForUrl, isSniSupported, sniRequest } from './sniRequest';

import type {
  IAvailabilityOutcome,
  IAvailabilitySource,
} from '../availabilityAggregator';
import type {
  IAvailabilityProxyState,
  IAvailabilityRoute,
} from '../availabilityContext';
import type { IApiAvailabilityStatus } from '../availabilityMetrics';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const mockRecordAvailabilityOutcome = jest.fn();

// The real report helpers run (so timing idempotency is exercised); only the
// aggregator sink is replaced to capture what would actually be counted.
jest.mock('../availabilityAggregator', () => ({
  normalizeAvailabilityToken: jest.fn(),
  recordAvailabilityOutcome: (...args: unknown[]) => {
    mockRecordAvailabilityOutcome(...args);
  },
  startAvailabilityFlow: jest.fn(),
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
    // These tests count the request path's dev settings / config reads; keep
    // the background IP Table state refresh from adding its own.
    resetIpTableAvailabilityStateRefreshForTesting({ fresh: true });
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
    resetIpTableAvailabilityStateRefreshForTesting();
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
    resetIpTableAvailabilityStateRefreshForTesting();
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
    ).rejects.toMatchObject({ code: 'SNI_NETWORK_UNREACHABLE' });
    expect(fallbackAdapter).not.toHaveBeenCalled();
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
      ).rejects.toMatchObject({
        message: expect.stringContaining('not idempotent'),
      });
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
});

describe('ipTableAdapter availability metrics', () => {
  const METRICS_URL = 'https://wallet.onekeycn.com/wallet/v1/health';
  const METRICS_HOSTNAME = 'wallet.onekeycn.com';

  const mutablePlatformEnv = platformEnv as {
    isDesktop?: boolean;
    isNative?: boolean;
  };
  const originalIsDesktop = mutablePlatformEnv.isDesktop;
  const originalIsNative = mutablePlatformEnv.isNative;

  let originalAdapter: typeof axios.defaults.adapter;
  let fallbackAdapter: jest.Mock<
    Promise<AxiosResponse>,
    [InternalAxiosRequestConfig]
  >;
  let consoleErrorSpy: jest.SpyInstance;

  function buildMetricsConfig(
    method: string,
    signal?: AbortSignal,
  ): InternalAxiosRequestConfig {
    const config = {
      url: METRICS_URL,
      method,
      headers: axios.AxiosHeaders.from({}),
      signal,
    } as InternalAxiosRequestConfig;
    // Attached by the axios request interceptor in production.
    config.$oneKeyAvailabilityTiming = createApiAvailabilityTiming({
      url: METRICS_URL,
    });
    return config;
  }

  function buildFallbackResponse(
    config: InternalAxiosRequestConfig,
  ): AxiosResponse {
    return {
      data: { fallback: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    };
  }

  function sniError(code: string) {
    return Object.assign(new Error(`${code}: sni request failed`), { code });
  }

  function sniTimeoutError() {
    return Object.assign(new Error('SNI_TIMEOUT: request timeout'), {
      code: 'SNI_TIMEOUT',
    });
  }

  function axiosNetworkError(config: InternalAxiosRequestConfig) {
    return new axios.AxiosError(
      'Network Error',
      axios.AxiosError.ERR_NETWORK,
      config,
    );
  }

  function axiosTimeoutError(config: InternalAxiosRequestConfig) {
    return new axios.AxiosError(
      'timeout of 30000ms exceeded',
      axios.AxiosError.ECONNABORTED,
      config,
    );
  }

  function axiosCanceledError(config: InternalAxiosRequestConfig) {
    return Object.assign(new axios.CanceledError('canceled'), { config });
  }

  function outcomesOf(source: IAvailabilitySource) {
    return mockRecordAvailabilityOutcome.mock.calls
      .map((call: unknown[]) => call[0] as IAvailabilityOutcome)
      .filter((outcome) => outcome.source === source);
  }

  function sniOutcome(status: string, errorCode?: string) {
    return {
      source: 'sni',
      target: 'wallet',
      status,
      durationMs: expect.any(Number) as number,
      detail: '/wallet/v1/health',
      errorCode,
    };
  }

  function apiOutcome(
    status: string,
    errorCode: string,
    route: IAvailabilityRoute,
  ) {
    return {
      source: 'api',
      target: 'wallet',
      status,
      durationMs: expect.any(Number) as number,
      detail: `${route}:/wallet/v1/health`,
      errorCode,
    };
  }

  // Settled breakdowns bucket server answers (api_error / http_error) as
  // `error` and unsettled transports (network_error / timeout) as `failed`;
  // cancelled outcomes carry only the route.
  function expectApiBreakdowns({
    route,
    status,
    proxy,
  }: {
    route: IAvailabilityRoute;
    status: Exclude<IApiAvailabilityStatus, 'ok'>;
    proxy?: IAvailabilityProxyState;
  }) {
    expect(outcomesOf('api_route')).toEqual([
      {
        source: 'api_route',
        target: route,
        status,
        durationMs: expect.any(Number) as number,
      },
    ]);
    if (status === 'cancelled') {
      expect(outcomesOf('api_net')).toEqual([]);
      expect(outcomesOf('api_proxy')).toEqual([]);
      expect(outcomesOf('api_ip_table')).toEqual([]);
      return;
    }
    const settledStatus =
      status === 'api_error' || status === 'http_error' ? 'error' : 'failed';
    expect(outcomesOf('api_net')).toEqual([
      {
        source: 'api_net',
        target: getAvailabilityNetworkType(),
        status: settledStatus,
      },
    ]);
    expect(outcomesOf('api_proxy')).toEqual([
      { source: 'api_proxy', target: proxy, status: settledStatus },
    ]);
    expect(outcomesOf('api_ip_table')).toEqual([
      { source: 'api_ip_table', target: 'enabled', status: settledStatus },
    ]);
  }

  function expectNoApiOutcomes() {
    expect(outcomesOf('api')).toEqual([]);
    expect(outcomesOf('api_route')).toEqual([]);
    expect(outcomesOf('api_net')).toEqual([]);
    expect(outcomesOf('api_proxy')).toEqual([]);
    expect(outcomesOf('api_ip_table')).toEqual([]);
  }

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    originalAdapter = axios.defaults.adapter;
    fallbackAdapter = jest.fn(async (config) => buildFallbackResponse(config));
    axios.defaults.adapter = fallbackAdapter;
    // Route, proxy and IP Table breakdowns are recorded only where IP Table
    // can run.
    mutablePlatformEnv.isDesktop = true;

    mockRecordAvailabilityOutcome.mockReset();
    resetAvailabilityContextForTest();
    // The per-request IP Table state refresh is fire-and-forget and would race
    // the reported outcomes, so pin the state; its own tests re-arm it.
    resetIpTableAvailabilityStateRefreshForTesting({ fresh: true });
    setAvailabilityIpTableState('enabled');
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
          'onekeycn.com': {
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
          'onekeycn.com': '93.184.216.34',
        },
      },
    } as never);
    resetAdapterFailoverStatesForTesting();
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    consoleErrorSpy.mockRestore();
    mutablePlatformEnv.isDesktop = originalIsDesktop;
    mutablePlatformEnv.isNative = originalIsNative;
    resetAdapterFailoverStatesForTesting();
    jest.clearAllMocks();
  });

  test('SNI success records ok and leaves the api outcome to the interceptor', async () => {
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: '{"ok":true}',
    });
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
      data: { ok: true },
    });

    expect(outcomesOf('sni')).toEqual([sniOutcome('ok')]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.reported).toBeUndefined();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('sni');
    expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('off');
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('GET SNI error with a successful domain fallback records fallback_ok', async () => {
    mockedSniRequest.mockRejectedValue(sniTimeoutError());
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
      data: { fallback: true },
    });

    expect(outcomesOf('sni')).toEqual([
      sniOutcome('fallback_ok', 'sni_timeout'),
    ]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('fallback');
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('GET SNI error with a failed domain fallback records fallback_failed', async () => {
    mockedSniRequest.mockRejectedValue(sniTimeoutError());
    fallbackAdapter.mockImplementation(async (config) => {
      throw axiosNetworkError(config);
    });
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'ERR_NETWORK',
    });

    expect(outcomesOf('sni')).toEqual([
      sniOutcome('fallback_failed', 'sni_timeout-err_network'),
    ]);
    // The fallback AxiosError carries config: the interceptor records it.
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.reported).toBeUndefined();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('fallback');
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('GET SNI error with a domain fallback HTTP error response records fallback_ok', async () => {
    mockedSniRequest.mockRejectedValue(sniTimeoutError());
    fallbackAdapter.mockImplementation(async (config) => {
      throw new axios.AxiosError(
        'Request failed with status code 502',
        axios.AxiosError.ERR_BAD_RESPONSE,
        config,
        undefined,
        {
          data: '<html>bad gateway</html>',
          status: 502,
          statusText: 'Bad Gateway',
          headers: {},
          config,
        },
      );
    });
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'ERR_BAD_RESPONSE',
    });

    // The domain path answered: transport-level success, like SNI 502 -> ok.
    expect(outcomesOf('sni')).toEqual([
      sniOutcome('fallback_ok', 'sni_timeout'),
    ]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('fallback');
  });

  test('GET SNI error with a fallback aborted by the caller records cancelled', async () => {
    const controller = new AbortController();
    mockedSniRequest.mockRejectedValue(sniTimeoutError());
    fallbackAdapter.mockImplementation(async (config) => {
      controller.abort();
      throw axiosCanceledError(config);
    });
    const config = buildMetricsConfig('get', controller.signal);

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'ERR_CANCELED',
    });

    expect(outcomesOf('sni')).toEqual([sniOutcome('cancelled', 'sni_timeout')]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('fallback');
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('POST SNI timeout records blocked and an api timeout for the adapter error', async () => {
    mockedSniRequest.mockRejectedValue(sniTimeoutError());
    const config = buildMetricsConfig('post');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'SNI_TIMEOUT',
    });

    expect(outcomesOf('sni')).toEqual([sniOutcome('blocked', 'sni_timeout')]);
    expect(outcomesOf('api')).toEqual([
      apiOutcome('timeout', 'sni_timeout', 'sni'),
    ]);
    expectApiBreakdowns({ route: 'sni', status: 'timeout', proxy: 'off' });
    expect(config.$oneKeyAvailabilityTiming?.reported).toBe(true);
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('sni');
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('a runtime without IP Table records only api and api_net for an adapter error', async () => {
    mutablePlatformEnv.isDesktop = false;
    mutablePlatformEnv.isNative = false;
    mockedSniRequest.mockRejectedValue(sniTimeoutError());
    const config = buildMetricsConfig('post');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'SNI_TIMEOUT',
    });

    expect(outcomesOf('sni')).toEqual([sniOutcome('blocked', 'sni_timeout')]);
    expect(outcomesOf('api')).toEqual([
      apiOutcome('timeout', 'sni_timeout', 'sni'),
    ]);
    expect(outcomesOf('api_net')).toEqual([
      {
        source: 'api_net',
        target: getAvailabilityNetworkType(),
        status: 'failed',
      },
    ]);
    expect(
      mockRecordAvailabilityOutcome.mock.calls.map(
        (call: unknown[]) => (call[0] as IAvailabilityOutcome).source,
      ),
    ).toEqual(['sni', 'api', 'api_net']);
    expect(config.$oneKeyAvailabilityTiming?.reported).toBe(true);
  });

  test('an adapter error after the caller aborted records a cancelled api outcome', async () => {
    const controller = new AbortController();
    mockedSniRequest.mockImplementation(async () => {
      controller.abort();
      throw sniTimeoutError();
    });
    const config = buildMetricsConfig('post', controller.signal);

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'SNI_TIMEOUT',
    });

    expect(outcomesOf('sni')).toEqual([sniOutcome('blocked', 'sni_timeout')]);
    expect(outcomesOf('api')).toEqual([
      apiOutcome('cancelled', 'sni_timeout', 'sni'),
    ]);
    expectApiBreakdowns({ route: 'sni', status: 'cancelled' });
  });

  test('GET null SNI response with a successful domain fallback records fallback_ok', async () => {
    mockedSniRequest.mockResolvedValue(null);
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
      data: { fallback: true },
    });

    expect(outcomesOf('sni')).toEqual([
      sniOutcome('fallback_ok', 'null_response'),
    ]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('fallback');
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('GET null SNI response records the final result of the repeated domain fallback', async () => {
    // Pre-existing routing: a failed null-response fallback lands in the SNI
    // catch, which falls back to the domain a second time. The recorded SNI
    // outcome must describe that second, final attempt.
    mockedSniRequest.mockResolvedValue(null);
    fallbackAdapter
      .mockImplementationOnce(async (config) => {
        throw axiosNetworkError(config);
      })
      .mockImplementationOnce(async (config) => buildFallbackResponse(config));
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
      data: { fallback: true },
    });

    expect(outcomesOf('sni')).toEqual([
      sniOutcome('fallback_ok', 'null_response'),
    ]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('fallback');
    expect(fallbackAdapter).toHaveBeenCalledTimes(2);
  });

  test('GET null SNI response with both domain fallbacks failing records the last fallback error', async () => {
    mockedSniRequest.mockResolvedValue(null);
    fallbackAdapter
      .mockImplementationOnce(async (config) => {
        throw axiosNetworkError(config);
      })
      .mockImplementationOnce(async (config) => {
        throw axiosTimeoutError(config);
      });
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'ECONNABORTED',
    });

    expect(outcomesOf('sni')).toEqual([
      sniOutcome('fallback_failed', 'null_response-econnaborted'),
    ]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('fallback');
    expect(fallbackAdapter).toHaveBeenCalledTimes(2);
  });

  test('GET null SNI response with the fallback aborted by the caller records cancelled', async () => {
    const controller = new AbortController();
    mockedSniRequest.mockResolvedValue(null);
    fallbackAdapter.mockImplementation(async (config) => {
      controller.abort();
      throw axiosCanceledError(config);
    });
    const config = buildMetricsConfig('get', controller.signal);

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'ERR_CANCELED',
    });

    expect(outcomesOf('sni')).toEqual([
      sniOutcome('cancelled', 'null_response'),
    ]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('fallback');
    expect(fallbackAdapter).toHaveBeenCalledTimes(2);
  });

  test('POST null SNI response records blocked and an api outcome for the adapter error', async () => {
    mockedSniRequest.mockResolvedValue(null);
    const config = buildMetricsConfig('post');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      message: expect.stringContaining('not idempotent') as string,
    });

    expect(outcomesOf('sni')).toEqual([sniOutcome('blocked', 'null_response')]);
    expect(outcomesOf('api')).toEqual([
      apiOutcome('network_error', 'onekeylocalerror', 'sni'),
    ]);
    expectApiBreakdowns({
      route: 'sni',
      status: 'network_error',
      proxy: 'off',
    });
    expect(config.$oneKeyAvailabilityTiming?.reported).toBe(true);
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('sni');
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('SNI_CANCELLED records cancelled for both sni and api', async () => {
    mockedSniRequest.mockRejectedValue(sniError('SNI_CANCELLED'));
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });

    expect(outcomesOf('sni')).toEqual([
      sniOutcome('cancelled', 'sni_cancelled'),
    ]);
    expect(outcomesOf('api')).toEqual([
      apiOutcome('cancelled', 'sni_cancelled', 'sni'),
    ]);
    expectApiBreakdowns({ route: 'sni', status: 'cancelled' });
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('other SNI fail-closed errors record fail_closed and an api outcome', async () => {
    mockedSniRequest.mockRejectedValue(sniError('SNI_CERT_FAILED'));
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'SNI_CERT_FAILED',
    });

    expect(outcomesOf('sni')).toEqual([
      sniOutcome('fail_closed', 'sni_cert_failed'),
    ]);
    expect(outcomesOf('api')).toEqual([
      apiOutcome('network_error', 'sni_cert_failed', 'sni'),
    ]);
    expectApiBreakdowns({
      route: 'sni',
      status: 'network_error',
      proxy: 'off',
    });
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('sni');
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('a fail-closed proxy preflight error records only an api outcome', async () => {
    // A cached state from an earlier preflight of the same host must not
    // describe this request.
    noteAvailabilityProxyPreflight(METRICS_HOSTNAME, true);
    expect(getAvailabilityProxyState(METRICS_HOSTNAME)).toBe('on');
    mockedIsProxyActiveForUrl.mockRejectedValue(
      sniError('SNI_SECURITY_POLICY_FAILED'),
    );
    const config = buildMetricsConfig('get');
    expect(config.$oneKeyAvailabilityTiming?.hostname).toBe(METRICS_HOSTNAME);

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'SNI_SECURITY_POLICY_FAILED',
    });

    expect(outcomesOf('sni')).toEqual([]);
    // Nothing was dispatched, and this request's proxy state is unknown.
    expect(outcomesOf('api')).toEqual([
      apiOutcome('network_error', 'sni_security_policy_failed', 'none'),
    ]);
    expectApiBreakdowns({
      route: 'none',
      status: 'network_error',
      proxy: 'unknown',
    });
    expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('unknown');
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  test('an already aborted request records a cancelled api outcome', async () => {
    const controller = new AbortController();
    controller.abort();
    const config = buildMetricsConfig('get', controller.signal);

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });

    expect(outcomesOf('sni')).toEqual([]);
    expect(outcomesOf('api')).toEqual([
      apiOutcome('cancelled', 'sni_cancelled', 'none'),
    ]);
    expectApiBreakdowns({ route: 'none', status: 'cancelled' });
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('none');
  });

  test('a domain error that carries config is left to the interceptor', async () => {
    mockedIsProxyActiveForUrl.mockResolvedValue(true);
    fallbackAdapter.mockImplementation(async (config) => {
      throw axiosNetworkError(config);
    });
    const config = buildMetricsConfig('get');

    await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
      code: 'ERR_NETWORK',
    });

    expect(outcomesOf('sni')).toEqual([]);
    expectNoApiOutcomes();
    expect(config.$oneKeyAvailabilityTiming?.reported).toBeUndefined();
    // Marked for the interceptor, which reports the AxiosError.
    expect(config.$oneKeyAvailabilityTiming?.route).toBe('domain');
    expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('on');
  });

  describe('route and proxy marks', () => {
    test('an aborted request while IP selection is pending keeps route none', async () => {
      let resolveDevSettings:
        | ((value: { settings: Record<string, never> }) => void)
        | undefined;
      const devSettingsGate = new Promise<{ settings: Record<string, never> }>(
        (resolve) => {
          resolveDevSettings = resolve;
        },
      );
      mockedRequestHelper.getDevSettingsPersistAtom.mockImplementation(
        () => devSettingsGate as never,
      );
      const controller = new AbortController();
      const config = buildMetricsConfig('get', controller.signal);

      const responsePromise = createIpTableAdapter({})(config);
      for (let index = 0; index < 4; index += 1) {
        // Allow the resolved proxy preflight to advance into IP selection.
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
      }
      expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('off');
      controller.abort();

      await expect(responsePromise).rejects.toMatchObject({
        code: 'SNI_CANCELLED',
      });
      expect(config.$oneKeyAvailabilityTiming?.route).toBe('none');
      expect(outcomesOf('api')).toEqual([
        apiOutcome('cancelled', 'sni_cancelled', 'none'),
      ]);
      expectApiBreakdowns({ route: 'none', status: 'cancelled' });
      expect(mockedSniRequest).not.toHaveBeenCalled();
      expect(fallbackAdapter).not.toHaveBeenCalled();
      resolveDevSettings?.({ settings: {} });
    });

    test('no IP mapping takes the domain route', async () => {
      mockedRequestHelper.getIpTableConfig.mockResolvedValue({
        config: {
          version: 1,
          ttl_sec: 60,
          generated_at: '2026-06-30T00:00:00.000Z',
          signature: '',
          domains: {},
        },
        runtime: {
          enabled: true,
          lastUpdated: 0,
          lastRegionCheck: 0,
          selections: {},
        },
      } as never);
      const config = buildMetricsConfig('get');

      await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
        data: { fallback: true },
      });

      expect(config.$oneKeyAvailabilityTiming?.route).toBe('domain');
      expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('off');
      expect(mockedSniRequest).not.toHaveBeenCalled();
      expect(fallbackAdapter).toHaveBeenCalledTimes(1);
      expect(outcomesOf('sni')).toEqual([]);
    });

    test('an unsupported SNI platform takes the domain route without a proxy mark', async () => {
      mockedIsSniSupported.mockReturnValue(false);
      const config = buildMetricsConfig('get');

      await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
        data: { fallback: true },
      });

      expect(config.$oneKeyAvailabilityTiming?.route).toBe('domain');
      expect(config.$oneKeyAvailabilityTiming?.proxy).toBeUndefined();
      expect(mockedIsProxyActiveForUrl).not.toHaveBeenCalled();
      expect(mockedSniRequest).not.toHaveBeenCalled();
      expect(fallbackAdapter).toHaveBeenCalledTimes(1);
    });

    test('an active proxy marks proxy on and takes the domain route', async () => {
      mockedIsProxyActiveForUrl.mockResolvedValue(true);
      const config = buildMetricsConfig('get');

      await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
        data: { fallback: true },
      });

      expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('on');
      expect(config.$oneKeyAvailabilityTiming?.route).toBe('domain');
      expect(mockedSniRequest).not.toHaveBeenCalled();
      expect(mockedIsProxyActiveForUrl).toHaveBeenCalledTimes(1);
    });

    test('an inactive proxy marks proxy off', async () => {
      mockedSniRequest.mockResolvedValue({
        statusCode: 200,
        statusText: 'OK',
        headers: {},
        body: '{"ok":true}',
      });
      const config = buildMetricsConfig('get');

      await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
        data: { ok: true },
      });

      expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('off');
      expect(config.$oneKeyAvailabilityTiming?.route).toBe('sni');
      expect(mockedIsProxyActiveForUrl).toHaveBeenCalledTimes(1);
    });

    test('a legacy preflight without proxy capability marks proxy unknown', async () => {
      mockedIsProxyActiveForUrl.mockResolvedValue(null);
      mockedSniRequest.mockResolvedValue({
        statusCode: 200,
        statusText: 'OK',
        headers: {},
        body: '{"ok":true}',
      });
      const config = buildMetricsConfig('get');

      await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
        data: { ok: true },
      });

      expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('unknown');
      expect(config.$oneKeyAvailabilityTiming?.route).toBe('sni');
    });

    test('a proxy preflight error marks proxy unknown and takes the domain route', async () => {
      mockedIsProxyActiveForUrl.mockRejectedValue(
        new Error('preflight failed'),
      );
      const config = buildMetricsConfig('get');

      await expect(createIpTableAdapter({})(config)).resolves.toMatchObject({
        data: { fallback: true },
      });

      expect(config.$oneKeyAvailabilityTiming?.proxy).toBe('unknown');
      expect(config.$oneKeyAvailabilityTiming?.route).toBe('domain');
      expect(mockedIsProxyActiveForUrl).toHaveBeenCalledTimes(1);
      expect(mockedSniRequest).not.toHaveBeenCalled();
    });

    test('marks are no-ops without an availability timing', async () => {
      mockedSniRequest.mockRejectedValue(sniTimeoutError());
      const config = buildMetricsConfig('post');
      config.$oneKeyAvailabilityTiming = undefined;

      await expect(createIpTableAdapter({})(config)).rejects.toMatchObject({
        code: 'SNI_TIMEOUT',
      });

      expect(config.$oneKeyAvailabilityTiming).toBeUndefined();
      expectNoApiOutcomes();
    });
  });

  describe('IP Table state refresh', () => {
    function buildIpTableConfig(runtimeEnabled: boolean) {
      return {
        config: {
          version: 1,
          ttl_sec: 60,
          generated_at: '2026-06-30T00:00:00.000Z',
          signature: '',
          domains: {},
        },
        runtime: {
          enabled: runtimeEnabled,
          lastUpdated: 0,
          lastRegionCheck: 0,
          selections: {},
        },
      } as never;
    }

    // The refresh is fire-and-forget; let its promise chain settle.
    function flushRefresh() {
      return new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }

    // With an active proxy the request path reads neither dev settings nor
    // the IP Table config, so every such read comes from the refresh.
    async function sendProxiedRequest() {
      await expect(
        createIpTableAdapter({})(buildMetricsConfig('get')),
      ).resolves.toMatchObject({ data: { fallback: true } });
    }

    beforeEach(() => {
      // Undo the pinned state: these tests observe the refresh their own
      // requests start (the outer beforeEach already runs as desktop).
      resetAvailabilityContextForTest();
      resetIpTableAvailabilityStateRefreshForTesting();
      mockedIsProxyActiveForUrl.mockResolvedValue(true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('records enabled when a config is present and enabled', async () => {
      await sendProxiedRequest();
      await flushRefresh();

      expect(getAvailabilityIpTableState()).toBe('enabled');
      expect(mockedRequestHelper.getIpTableConfig).toHaveBeenCalledTimes(1);
    });

    test('records disabled when the runtime is explicitly disabled', async () => {
      mockedRequestHelper.getIpTableConfig.mockResolvedValue(
        buildIpTableConfig(false),
      );

      await sendProxiedRequest();
      await flushRefresh();

      expect(getAvailabilityIpTableState()).toBe('disabled');
    });

    test('records disabled when dev settings turn IP Table off', async () => {
      mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
        settings: { disableIpTableInProd: true },
      } as never);

      await sendProxiedRequest();
      await flushRefresh();

      expect(getAvailabilityIpTableState()).toBe('disabled');
      expect(mockedRequestHelper.getIpTableConfig).not.toHaveBeenCalled();
    });

    test('records no_config when this runtime has no config', async () => {
      mockedRequestHelper.getIpTableConfig.mockResolvedValue(null as never);

      await sendProxiedRequest();
      await flushRefresh();

      expect(getAvailabilityIpTableState()).toBe('no_config');
    });

    test('refreshes at most once per interval', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

      await sendProxiedRequest();
      await flushRefresh();
      expect(getAvailabilityIpTableState()).toBe('enabled');

      mockedRequestHelper.getIpTableConfig.mockResolvedValue(null as never);
      nowSpy.mockReturnValue(1_000_000 + 29_999);
      await sendProxiedRequest();
      await flushRefresh();
      expect(mockedRequestHelper.getIpTableConfig).toHaveBeenCalledTimes(1);
      expect(getAvailabilityIpTableState()).toBe('enabled');

      nowSpy.mockReturnValue(1_000_000 + 30_000);
      await sendProxiedRequest();
      await flushRefresh();
      expect(mockedRequestHelper.getIpTableConfig).toHaveBeenCalledTimes(2);
      expect(getAvailabilityIpTableState()).toBe('no_config');
    });

    test('never blocks requests and shares one in-flight refresh', async () => {
      let releaseConfig: (() => void) | undefined;
      const configGate = new Promise<void>((resolve) => {
        releaseConfig = resolve;
      });
      mockedRequestHelper.getIpTableConfig.mockImplementation(async () => {
        await configGate;
        return buildIpTableConfig(true);
      });

      await Promise.all([sendProxiedRequest(), sendProxiedRequest()]);
      await flushRefresh();
      expect(mockedRequestHelper.getIpTableConfig).toHaveBeenCalledTimes(1);
      expect(getAvailabilityIpTableState()).toBe('unknown');

      releaseConfig?.();
      await flushRefresh();
      expect(getAvailabilityIpTableState()).toBe('enabled');
    });

    test('a superseded refresh does not overwrite a newer state', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      let releaseFirst: (() => void) | undefined;
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      mockedRequestHelper.getIpTableConfig.mockImplementationOnce(async () => {
        await firstGate;
        return buildIpTableConfig(true);
      });
      await sendProxiedRequest();

      nowSpy.mockReturnValue(1_000_000 + 30_000);
      mockedRequestHelper.getIpTableConfig.mockResolvedValue(null as never);
      await sendProxiedRequest();
      await flushRefresh();
      expect(getAvailabilityIpTableState()).toBe('no_config');

      releaseFirst?.();
      await flushRefresh();
      expect(getAvailabilityIpTableState()).toBe('no_config');
    });

    test('a failing read keeps the previous state and never affects the request', async () => {
      mockedRequestHelper.getIpTableConfig.mockRejectedValue(
        new Error('config unavailable'),
      );
      await sendProxiedRequest();
      await flushRefresh();
      expect(getAvailabilityIpTableState()).toBe('unknown');

      resetIpTableAvailabilityStateRefreshForTesting();
      mockedRequestHelper.getIpTableConfig.mockImplementation(() => {
        throw new OneKeyLocalError('config getter threw synchronously');
      });
      await sendProxiedRequest();
      await flushRefresh();
      expect(getAvailabilityIpTableState()).toBe('unknown');
      expect(fallbackAdapter).toHaveBeenCalledTimes(2);
    });

    test('an already aborted request does not refresh', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        createIpTableAdapter({})(buildMetricsConfig('get', controller.signal)),
      ).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
      await flushRefresh();

      expect(
        mockedRequestHelper.getDevSettingsPersistAtom,
      ).not.toHaveBeenCalled();
      expect(mockedRequestHelper.getIpTableConfig).not.toHaveBeenCalled();
      expect(getAvailabilityIpTableState()).toBe('unknown');
    });
  });
});

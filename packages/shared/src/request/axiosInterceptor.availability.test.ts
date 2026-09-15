import axios, { AxiosError } from 'axios';

import { OneKeyError, OneKeyServerApiError } from '../errors';
import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import platformEnv from '../platformEnv';

import {
  noteAvailabilityProxyPreflight,
  resetAvailabilityContextForTest,
  setAvailabilityIpTableState,
} from './availabilityContext';
import {
  AVAILABILITY_TRACKED_FETCH_OPTION,
  markApiAvailabilityProxy,
  markApiAvailabilityRoute,
} from './availabilityMetrics';

import type {
  IAvailabilityIpTableState,
  IAvailabilityProxyState,
  IAvailabilityRoute,
} from './availabilityContext';
import type {
  IApiAvailabilityStatus,
  IApiAvailabilityTiming,
} from './availabilityMetrics';
import type {
  AxiosAdapter,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

const mockRecordAvailabilityOutcome = jest.fn();

jest.mock('./availabilityAggregator', () => ({
  normalizeAvailabilityToken: jest.fn(),
  recordAvailabilityOutcome: (...args: unknown[]) => {
    mockRecordAvailabilityOutcome(...args);
  },
  startAvailabilityFlow: jest.fn(() => ({ finish: jest.fn() })),
}));

function mockIsOneKeyUrl(url: string | undefined) {
  return /^https:\/\/[a-z]+\.onekeycn\.com(\/|$)/.test(url ?? '');
}

jest.mock('./requestHelper', () => ({
  __esModule: true,
  default: {
    checkIsOneKeyDomain: jest.fn(async (url: string) => mockIsOneKeyUrl(url)),
  },
}));

jest.mock('./Interceptor', () => ({
  HEADER_REQUEST_ID_KEY: 'x-onekey-request-id',
  checkRequestIsOneKeyDomain: jest.fn(
    async ({ config }: { config: InternalAxiosRequestConfig }) =>
      mockIsOneKeyUrl(config.baseURL) || mockIsOneKeyUrl(config.url),
  ),
  getRequestHeaders: jest.fn(async () => ({
    'x-onekey-request-id': 'request-id',
  })),
}));

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: {
      network: {
        end: jest.fn(),
        error: jest.fn(),
        start: jest.fn(),
      },
    },
  },
}));

jest.mock('../logger/scopes/app/scenes/networkFilter', () => ({
  isEnableLogNetwork: jest.fn(() => false),
}));

jest.mock('../locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: jest.fn(({ id }: { id: string }) => id),
    },
  },
}));

jest.mock('../utils/systemTimeUtils', () => ({
  __esModule: true,
  default: {
    handleServerResponseDate: jest.fn(async () => undefined),
  },
}));

jest.mock('../modules/NetworkThrottle', () => ({
  __esModule: true,
  NATIVE_SLOW_4G_LATENCY_MS: 0,
  default: {
    getNetworkThrottle: jest.fn(),
    setNetworkThrottle: jest.fn(),
  },
  getNetworkThrottleRuntimeConfig: jest.fn(() => ({ enabled: false })),
}));

jest.mock('../storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: { getBoolean: jest.fn() },
  },
}));

jest.mock('../storage/instance/devSettingSyncStorageInstance', () => ({
  devSettingSyncStorage: { getBoolean: jest.fn() },
}));

// The network error path schedules a debounced NetInfo refresh; run it
// synchronously so no timer outlives the suite.
jest.mock('lodash', () => ({
  ...jest.requireActual<typeof import('lodash')>('lodash'),
  debounce: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { RefreshNetInfo: 'RefreshNetInfo' },
  appEventBus: { emit: jest.fn() },
}));

const WALLET_HOSTNAME = 'wallet.onekeycn.com';
const WALLET_URL = `https://${WALLET_HOSTNAME}/wallet/v1/network/list`;
const THIRD_PARTY_URL = 'https://api.hyperliquid.xyz/info';
// A sibling OneKey host: proxy preflight results are cached per exact
// hostname, not per registrable domain.
const SWAP_URL = 'https://swap.onekeycn.com/swap/v1/quote';

const mutablePlatformEnv = platformEnv as {
  isDesktop?: boolean;
  isNative?: boolean;
};

// Requests that never pass through the IP Table adapter report the direct route.
const WALLET_DIRECT_OUTCOME = {
  detail: 'direct:/wallet/v1/network',
  target: 'wallet',
};
const THIRD_PARTY_DIRECT_OUTCOME = {
  detail: 'direct:/info',
  target: 'hyperliquid',
};

type IFetchStub = jest.Mock<
  Promise<Response>,
  [RequestInfo | URL, RequestInit | undefined]
>;

const stubFetch: IFetchStub = jest.fn();
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function buildResponse(
  config: InternalAxiosRequestConfig,
  { data, status }: { data: unknown; status: number },
): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    request: {},
    status,
    statusText: '',
  };
}

function resolvingAdapter(response: {
  data: unknown;
  status: number;
}): AxiosAdapter {
  return async (config) => buildResponse(config, response);
}

function rejectingAdapter(
  createError: (config: InternalAxiosRequestConfig) => unknown,
): AxiosAdapter {
  return async (config) => {
    throw createError(config);
  };
}

function createClient(config: AxiosRequestConfig) {
  return axios.create(config);
}

function getRecordedOutcomes() {
  return mockRecordAvailabilityOutcome.mock.calls.map(
    ([outcome]) => outcome as Record<string, unknown>,
  );
}

// Context breakdowns bucket settled requests by whether the server answered.
const CONTEXT_STATUS: Record<
  Exclude<IApiAvailabilityStatus, 'cancelled'>,
  'error' | 'failed' | 'ok'
> = {
  api_error: 'error',
  http_error: 'error',
  network_error: 'failed',
  ok: 'ok',
  timeout: 'failed',
};

function expectApiOutcomes({
  detail,
  errorCode,
  ipTableContext,
  status,
  target,
}: {
  detail: string;
  errorCode?: string;
  /**
   * Route, proxy and IP Table breakdowns. Pass only for tests running as an
   * IP Table runtime (desktop / native); other runtimes must not record them.
   */
  ipTableContext?: {
    ipTable: IAvailabilityIpTableState;
    proxy: IAvailabilityProxyState;
    route: IAvailabilityRoute;
  };
  status: IApiAvailabilityStatus;
  target: string;
}) {
  const recorded = getRecordedOutcomes();
  // Whichever of the axios interceptor and the patched fetch observes a
  // request, it must produce exactly one API outcome.
  expect(recorded.filter(({ source }) => source === 'api')).toHaveLength(1);

  const durationMs = expect.any(Number) as number;
  const expected: Record<string, unknown>[] = [
    { source: 'api', target, status, durationMs, detail, errorCode },
  ];
  if (ipTableContext) {
    expected.push({
      source: 'api_route',
      target: ipTableContext.route,
      status,
      durationMs,
    });
  }
  if (status !== 'cancelled') {
    const contextStatus = CONTEXT_STATUS[status];
    // The node test runtime exposes no connection type.
    expected.push({
      source: 'api_net',
      target: 'unknown',
      status: contextStatus,
    });
    if (ipTableContext) {
      expected.push(
        {
          source: 'api_proxy',
          target: ipTableContext.proxy,
          status: contextStatus,
        },
        {
          source: 'api_ip_table',
          target: ipTableContext.ipTable,
          status: contextStatus,
        },
      );
    }
  }
  expect(recorded).toEqual(expected);
}

function getAbortedWalletRequest() {
  const controller = new AbortController();
  const client = createClient({
    adapter: (config) =>
      new Promise((_resolve, reject) => {
        config.signal?.addEventListener?.('abort', () => {
          // axios converts adapter rejections on an aborted signal into
          // CanceledError, as with a native fetch AbortError.
          reject(new Error('aborted'));
        });
        controller.abort();
      }),
  });
  return client.get(WALLET_URL, { signal: controller.signal });
}

describe('axiosInterceptor availability metrics', () => {
  const originalIsDesktop = mutablePlatformEnv.isDesktop;
  const originalIsNative = mutablePlatformEnv.isNative;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    // fetchInterceptor captures and patches the global fetch at module load.
    globalThis.fetch = stubFetch;
    await import('./fetchInterceptor');
    await import('./axiosInterceptor');
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    mutablePlatformEnv.isDesktop = originalIsDesktop;
    mutablePlatformEnv.isNative = originalIsNative;
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Web-like runtime by default: no IP Table adapter can run, so outcomes
    // record only api and api_net.
    mutablePlatformEnv.isDesktop = false;
    mutablePlatformEnv.isNative = false;
    resetAvailabilityContextForTest();
    mockRecordAvailabilityOutcome.mockClear();
    stubFetch.mockReset();
  });

  describe('axios fetch adapter through the patched global fetch', () => {
    const requestSupportCases: Array<{
      env: AxiosRequestConfig['env'];
      name: string;
    }> = [
      { env: undefined, name: 'Request supported' },
      {
        // axios treats a non-function Request as unsupported and calls
        // fetch(url, init) instead of fetch(request, fetchOptions).
        env: { Request: null } as unknown as AxiosRequestConfig['env'],
        name: 'Request not supported',
      },
    ];

    it('uses the patched global fetch', () => {
      expect(globalThis.fetch).not.toBe(stubFetch);
      expect(
        Reflect.get(globalThis.fetch, 'isNormalizedByOneKey') as unknown,
      ).toBe(true);
    });

    it.each(requestSupportCases)(
      'counts a OneKey API request once ($name)',
      async ({ env }) => {
        stubFetch.mockResolvedValue(jsonResponse({ code: 0, data: [] }));
        const client = createClient({ adapter: 'fetch', env });

        const response = await client.get(WALLET_URL);

        expect(response.data).toEqual({ code: 0, data: [] });
        expect(stubFetch).toHaveBeenCalledTimes(1);
        const [resource, init] = stubFetch.mock.calls[0];
        if (env) {
          expect(resource).toBe(WALLET_URL);
        } else {
          expect(resource).toBeInstanceOf(Request);
          expect((resource as Request).url).toBe(WALLET_URL);
        }
        expect(init).toBeDefined();
        expect(Object.keys(init ?? {})).not.toContain(
          AVAILABILITY_TRACKED_FETCH_OPTION,
        );
        expectApiOutcomes({ ...WALLET_DIRECT_OUTCOME, status: 'ok' });
      },
    );

    it.each(requestSupportCases)(
      'counts an HTTP error response once ($name)',
      async ({ env }) => {
        stubFetch.mockResolvedValue(jsonResponse({ message: 'down' }, 500));
        const client = createClient({ adapter: 'fetch', env });

        await expect(client.get(WALLET_URL)).rejects.toBeInstanceOf(
          OneKeyServerApiError,
        );

        expect(stubFetch).toHaveBeenCalledTimes(1);
        expectApiOutcomes({
          ...WALLET_DIRECT_OUTCOME,
          errorCode: 'http_500',
          status: 'http_error',
        });
      },
    );

    it('still counts a plain fetch call once', async () => {
      stubFetch.mockResolvedValue(jsonResponse({ code: 0 }));

      await globalThis.fetch(WALLET_URL);

      expect(stubFetch).toHaveBeenCalledTimes(1);
      expectApiOutcomes({ ...WALLET_DIRECT_OUTCOME, status: 'ok' });
    });

    it('skips fetch calls already tracked by axios and strips the marker', async () => {
      stubFetch.mockResolvedValue(jsonResponse({ code: 0 }));
      const init = { [AVAILABILITY_TRACKED_FETCH_OPTION]: true } as RequestInit;

      await globalThis.fetch(WALLET_URL, init);

      expect(mockRecordAvailabilityOutcome).not.toHaveBeenCalled();
      const [, forwardedInit] = stubFetch.mock.calls[0];
      expect(Object.keys(forwardedInit ?? {})).not.toContain(
        AVAILABILITY_TRACKED_FETCH_OPTION,
      );
      // The caller-owned init object is left untouched.
      expect(init).toEqual({ [AVAILABILITY_TRACKED_FETCH_OPTION]: true });
    });
  });

  describe('outcome mapping', () => {
    it('maps OneKey code 0 to ok', async () => {
      const client = createClient({
        adapter: resolvingAdapter({ data: { code: 0 }, status: 200 }),
      });

      await expect(client.get(WALLET_URL)).resolves.toMatchObject({
        data: { code: 0 },
      });

      expectApiOutcomes({ ...WALLET_DIRECT_OUTCOME, status: 'ok' });
    });

    it('maps a non-zero OneKey code to api_error', async () => {
      const client = createClient({
        adapter: resolvingAdapter({
          data: { code: 40_001, message: 'bad' },
          status: 200,
        }),
      });

      await expect(client.get(WALLET_URL)).rejects.toMatchObject({
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: 40_001,
      });

      expectApiOutcomes({
        ...WALLET_DIRECT_OUTCOME,
        errorCode: 'api_40001',
        status: 'api_error',
      });
    });

    it('maps a rejected HTTP 500 to http_error', async () => {
      const client = createClient({
        adapter: rejectingAdapter(
          (config) =>
            new AxiosError(
              'Request failed with status code 500',
              AxiosError.ERR_BAD_RESPONSE,
              config,
              {},
              buildResponse(config, { data: '', status: 500 }),
            ),
        ),
      });

      await expect(client.get(WALLET_URL)).rejects.toMatchObject({
        code: 500,
        httpStatusCode: 500,
      });

      expectApiOutcomes({
        ...WALLET_DIRECT_OUTCOME,
        errorCode: 'http_500',
        status: 'http_error',
      });
    });

    it('maps an aborted request to cancelled', async () => {
      await expect(getAbortedWalletRequest()).rejects.toBeInstanceOf(
        axios.CanceledError,
      );

      expectApiOutcomes({
        ...WALLET_DIRECT_OUTCOME,
        errorCode: 'err_canceled',
        status: 'cancelled',
      });
    });

    it.each([
      { code: AxiosError.ECONNABORTED, errorCode: 'econnaborted' },
      { code: AxiosError.ETIMEDOUT, errorCode: 'etimedout' },
    ])('maps $code to timeout', async ({ code, errorCode }) => {
      const client = createClient({
        adapter: rejectingAdapter(
          (config) =>
            new AxiosError('timeout of 30000ms exceeded', code, config),
        ),
      });

      await expect(client.get(WALLET_URL)).rejects.toMatchObject({ code });

      expectApiOutcomes({
        ...WALLET_DIRECT_OUTCOME,
        errorCode,
        status: 'timeout',
      });
    });

    it('maps a network failure to network_error', async () => {
      const client = createClient({
        adapter: rejectingAdapter(
          (config) =>
            new AxiosError('Network Error', AxiosError.ERR_NETWORK, config),
        ),
      });

      const error: unknown = await client
        .get(WALLET_URL)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OneKeyError);
      expect(error).toMatchObject({
        className: EOneKeyErrorClassNames.AxiosNetworkError,
      });
      expectApiOutcomes({
        ...WALLET_DIRECT_OUTCOME,
        errorCode: 'err_network',
        status: 'network_error',
      });
    });

    describe('responses resolved without validateStatus (SNI adapter)', () => {
      it('maps a resolved OneKey 502 to http_error', async () => {
        const client = createClient({
          adapter: resolvingAdapter({ data: '<html>', status: 502 }),
        });

        const error: unknown = await client
          .get(WALLET_URL)
          .catch((e: unknown) => e);

        // Business behavior is unchanged: the body has no OneKey code.
        expect(error).toBeInstanceOf(OneKeyServerApiError);
        expect(error).toMatchObject({ httpStatusCode: 502 });
        expectApiOutcomes({
          ...WALLET_DIRECT_OUTCOME,
          errorCode: 'http_502',
          status: 'http_error',
        });
      });

      it('records a resolved OneKey 502 with a null body before the pre-existing TypeError', async () => {
        const client = createClient({
          adapter: resolvingAdapter({ data: null, status: 502 }),
        });

        await expect(client.get(WALLET_URL)).rejects.toBeInstanceOf(TypeError);

        expectApiOutcomes({
          ...WALLET_DIRECT_OUTCOME,
          errorCode: 'http_502',
          status: 'http_error',
        });
      });

      it('records a 200 OneKey response with a null body as api_error', async () => {
        const client = createClient({
          adapter: resolvingAdapter({ data: null, status: 200 }),
        });

        await expect(client.get(WALLET_URL)).rejects.toBeInstanceOf(TypeError);

        expectApiOutcomes({
          ...WALLET_DIRECT_OUTCOME,
          errorCode: 'api_unknown',
          status: 'api_error',
        });
      });

      it('maps a resolved third-party 502 to http_error', async () => {
        const client = createClient({
          adapter: resolvingAdapter({ data: '<html>', status: 502 }),
        });

        await expect(client.get(THIRD_PARTY_URL)).resolves.toMatchObject({
          status: 502,
        });

        expectApiOutcomes({
          ...THIRD_PARTY_DIRECT_OUTCOME,
          errorCode: 'http_502',
          status: 'http_error',
        });
      });
    });

    it('maps a third-party 2xx to ok regardless of body', async () => {
      const client = createClient({
        adapter: resolvingAdapter({ data: null, status: 200 }),
      });

      await expect(client.get(THIRD_PARTY_URL)).resolves.toMatchObject({
        data: null,
      });

      expectApiOutcomes({ ...THIRD_PARTY_DIRECT_OUTCOME, status: 'ok' });
    });

    it('honours a caller validateStatus that accepts the status', async () => {
      const client = createClient({
        adapter: resolvingAdapter({ data: { code: 0 }, status: 404 }),
        validateStatus: () => true,
      });

      await expect(client.get(WALLET_URL)).resolves.toMatchObject({
        status: 404,
      });

      expectApiOutcomes({ ...WALLET_DIRECT_OUTCOME, status: 'ok' });
    });

    it('does not record hosts outside the availability allowlist', async () => {
      const client = createClient({
        adapter: resolvingAdapter({ data: { code: 0 }, status: 200 }),
      });

      await client.get('https://example.com/private/path');

      expect(mockRecordAvailabilityOutcome).not.toHaveBeenCalled();
    });
  });

  describe('IP Table runtime (desktop)', () => {
    const directContext = {
      ipTable: 'enabled',
      proxy: 'unknown',
      route: 'direct',
    } as const;

    const settledCases: Array<{
      adapter: AxiosAdapter;
      errorCode?: string;
      status: IApiAvailabilityStatus;
    }> = [
      {
        adapter: resolvingAdapter({ data: { code: 0 }, status: 200 }),
        status: 'ok',
      },
      {
        adapter: resolvingAdapter({ data: '<html>', status: 502 }),
        errorCode: 'http_502',
        status: 'http_error',
      },
      {
        adapter: rejectingAdapter(
          (config) =>
            new AxiosError(
              'timeout of 30000ms exceeded',
              AxiosError.ETIMEDOUT,
              config,
            ),
        ),
        errorCode: 'etimedout',
        status: 'timeout',
      },
    ];

    beforeEach(() => {
      mutablePlatformEnv.isDesktop = true;
      setAvailabilityIpTableState('enabled');
    });

    it.each(settledCases)(
      'records route, proxy and IP Table breakdowns for a direct $status',
      async ({ adapter, errorCode, status }) => {
        const client = createClient({ adapter });

        await client.get(WALLET_URL).catch(() => undefined);

        expectApiOutcomes({
          ...WALLET_DIRECT_OUTCOME,
          errorCode,
          ipTableContext: directContext,
          status,
        });
      },
    );

    it('records only the route breakdown for a cancelled request', async () => {
      await expect(getAbortedWalletRequest()).rejects.toBeInstanceOf(
        axios.CanceledError,
      );

      expectApiOutcomes({
        ...WALLET_DIRECT_OUTCOME,
        errorCode: 'err_canceled',
        ipTableContext: directContext,
        status: 'cancelled',
      });
    });

    describe('route and proxy marked by the adapter', () => {
      beforeEach(() => {
        noteAvailabilityProxyPreflight(WALLET_HOSTNAME, true);
      });

      it('reports the SNI route and the request proxy state of a resolved request', async () => {
        let adapterTiming: IApiAvailabilityTiming | undefined;
        const adapter: AxiosAdapter = async (config) => {
          adapterTiming = config.$oneKeyAvailabilityTiming;
          markApiAvailabilityRoute(adapterTiming, 'sni');
          markApiAvailabilityProxy(adapterTiming, false);
          return buildResponse(config, { data: { code: 0 }, status: 200 });
        };
        const client = createClient({ adapter });

        await expect(client.get(WALLET_URL)).resolves.toMatchObject({
          data: { code: 0 },
        });

        // The timing the adapter marked is the one the interceptor reported.
        expect(adapterTiming).toMatchObject({
          hostname: WALLET_HOSTNAME,
          proxy: 'off',
          reported: true,
          route: 'sni',
        });
        // The request's own preflight wins over the cached hostname state.
        expectApiOutcomes({
          detail: 'sni:/wallet/v1/network',
          ipTableContext: { ipTable: 'enabled', proxy: 'off', route: 'sni' },
          status: 'ok',
          target: 'wallet',
        });
      });

      it('reports the marked route of a rejected request with the cached proxy state of its hostname', async () => {
        const adapter: AxiosAdapter = async (config) => {
          markApiAvailabilityRoute(
            config.$oneKeyAvailabilityTiming,
            'fallback',
          );
          throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
        };
        const client = createClient({ adapter });

        await expect(client.get(WALLET_URL)).rejects.toMatchObject({
          className: EOneKeyErrorClassNames.AxiosNetworkError,
        });

        expectApiOutcomes({
          detail: 'fallback:/wallet/v1/network',
          errorCode: 'err_network',
          ipTableContext: {
            ipTable: 'enabled',
            proxy: 'on',
            route: 'fallback',
          },
          status: 'network_error',
          target: 'wallet',
        });
      });

      it('does not apply a cached proxy state to a different hostname', async () => {
        const client = createClient({
          adapter: resolvingAdapter({ data: { code: 0 }, status: 200 }),
        });

        await expect(client.get(SWAP_URL)).resolves.toMatchObject({
          data: { code: 0 },
        });

        expectApiOutcomes({
          detail: 'direct:/swap/v1/quote',
          ipTableContext: directContext,
          status: 'ok',
          target: 'swap',
        });
      });
    });
  });
});

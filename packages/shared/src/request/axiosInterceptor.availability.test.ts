import { AVAILABILITY_COUNTED_FETCH_OPTION } from './requestConst';

import type { IAvailabilityOutcome } from './availabilityAggregator';
import type {
  AxiosAdapter,
  AxiosStatic,
  InternalAxiosRequestConfig,
} from 'axios';

const mockOutcomes: IAvailabilityOutcome[] = [];

jest.mock('./availabilityAggregator', () => ({
  recordAvailabilityOutcome: (outcome: IAvailabilityOutcome) => {
    mockOutcomes.push(outcome);
  },
}));

jest.mock('./requestHelper', () => ({
  __esModule: true,
  default: { checkIsOneKeyDomain: jest.fn(async () => true) },
}));

jest.mock('./Interceptor', () => ({
  HEADER_REQUEST_ID_KEY: 'x-onekey-request-id',
  checkRequestIsOneKeyDomain: jest.fn(async () => true),
  getRequestHeaders: jest.fn(async () => ({})),
}));

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: { network: { end: jest.fn(), error: jest.fn(), start: jest.fn() } },
  },
}));

jest.mock('../logger/scopes/app/scenes/networkFilter', () => ({
  isEnableLogNetwork: () => false,
}));

jest.mock('../locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: ({ id }: { id: string }) => id } },
}));

jest.mock('../utils/systemTimeUtils', () => ({
  __esModule: true,
  default: { handleServerResponseDate: async () => undefined },
}));

jest.mock('../modules/NetworkThrottle', () => ({
  __esModule: true,
  NATIVE_SLOW_4G_LATENCY_MS: 0,
  default: { getNetworkThrottle: jest.fn(), setNetworkThrottle: jest.fn() },
  getNetworkThrottleRuntimeConfig: () => ({ enabled: false }),
}));

jest.mock('../storage/appStorage', () => ({
  __esModule: true,
  default: { syncStorage: { getBoolean: jest.fn() } },
}));

jest.mock('../storage/instance/devSettingSyncStorageInstance', () => ({
  devSettingSyncStorage: { getBoolean: jest.fn() },
}));

jest.mock('lodash', () => ({
  ...jest.requireActual<typeof import('lodash')>('lodash'),
  debounce: <T>(fn: T) => fn,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { RefreshNetInfo: 'RefreshNetInfo' },
  appEventBus: { emit: jest.fn() },
}));

const WALLET_URL = 'https://wallet.onekeycn.com/wallet/v1/network/list';
const stubFetch = jest.fn<Promise<Response>, [unknown, RequestInit?]>();
let axios: AxiosStatic;

function apiOutcomes() {
  return mockOutcomes.filter(({ source }) => source === 'api');
}

function adapterOf(
  result: (config: InternalAxiosRequestConfig) => unknown,
): AxiosAdapter {
  return async (config) => {
    const value = result(config);
    if (value instanceof Error) throw value;
    return value as Awaited<ReturnType<AxiosAdapter>>;
  };
}

describe('API availability counting in request interceptors', () => {
  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    // Extension service worker load order: polyfills (XHR shim) first, then
    // the request interceptors, which patch the global fetch.
    await import('../polyfills/xhrShim/xhrShimV1');
    globalThis.fetch = stubFetch as typeof fetch;
    await import('./fetchInterceptor');
    axios = (await import('axios')).default;
    await import('./axiosInterceptor');
  });

  beforeEach(() => {
    mockOutcomes.length = 0;
    stubFetch.mockReset();
    stubFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ code: 0 }), {
          headers: { 'content-type': 'application/json' },
        }),
    );
  });

  it('counts an axios request sent through the XHR shim once', async () => {
    const response = await axios.create().get(WALLET_URL);

    expect(response.data).toEqual({ code: 0 });
    expect(apiOutcomes()).toEqual([
      expect.objectContaining({ target: 'wallet', status: 'ok' }),
    ]);
    // Proves the request really went through the shim and the patched fetch.
    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(stubFetch.mock.calls[0][1]).toHaveProperty(
      AVAILABILITY_COUNTED_FETCH_OPTION,
      true,
    );
  });

  it('counts a plain fetch call once', async () => {
    await globalThis.fetch(WALLET_URL);

    expect(apiOutcomes()).toEqual([
      expect.objectContaining({ target: 'wallet', status: 'ok' }),
    ]);
  });

  it('records an API error before the interceptor throws on it', async () => {
    const client = axios.create({
      adapter: adapterOf((config) => ({
        config,
        data: null,
        headers: {},
        status: 200,
        statusText: 'OK',
      })),
    });

    await expect(client.get(WALLET_URL)).rejects.toThrow();

    expect(apiOutcomes()).toEqual([
      expect.objectContaining({
        status: 'api_error',
        failure: {
          detail: 'direct:/wallet/v1/network',
          errorCode: 'api_unknown',
        },
      }),
    ]);
  });

  it('records transport failures but not cancellations', async () => {
    const failing = axios.create({
      adapter: adapterOf(
        (config) =>
          new axios.AxiosError('Network Error', 'ERR_NETWORK', config),
      ),
    });
    await expect(failing.get(WALLET_URL)).rejects.toThrow();

    const controller = new AbortController();
    controller.abort();
    await expect(
      failing.get(WALLET_URL, { signal: controller.signal }),
    ).rejects.toThrow();

    expect(apiOutcomes()).toEqual([
      expect.objectContaining({
        status: 'network_error',
        failure: {
          detail: 'direct:/wallet/v1/network',
          errorCode: 'err_network',
        },
      }),
    ]);
  });
});

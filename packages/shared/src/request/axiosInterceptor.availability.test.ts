import platformEnv from '../platformEnv';

import { DESKTOP_CUSTOM_UA_HEADER } from './customUA';
import { AVAILABILITY_COUNTED_FETCH_OPTION } from './requestConst';
import requestHelper from './requestHelper';

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
  default: {
    checkIsOneKeyDomain: jest.fn(async () => true),
    getDevSettingsPersistAtom: jest.fn(async () => ({
      enabled: false,
      settings: {},
    })),
  },
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
  default: {
    getNetworkThrottle: jest.fn(async () => ({ enabled: false })),
    setNetworkThrottle: jest.fn(),
  },
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

  it('counts a plain fetch call once, after its body arrives', async () => {
    await globalThis.fetch(WALLET_URL);
    await new Promise((resolve) => setImmediate(resolve));

    expect(apiOutcomes()).toEqual([
      expect.objectContaining({ target: 'wallet', status: 'ok' }),
    ]);
  });

  it('leaves event streams to their owner and counts HTTP errors at headers', async () => {
    await globalThis.fetch(WALLET_URL, {
      headers: { Accept: 'text/event-stream' },
    });
    stubFetch.mockImplementation(
      async () => new Response('bad gateway', { status: 502 }),
    );
    await globalThis.fetch(WALLET_URL);

    expect(apiOutcomes()).toEqual([
      expect.objectContaining({ status: 'http_error' }),
    ]);
  });

  it('counts a timeout carried by a Request as a timeout, not a cancellation', async () => {
    // The signal lives on the Request, not in the options.
    const controller = new AbortController();
    controller.abort({ name: 'TimeoutError' });
    stubFetch.mockImplementation(async () => {
      throw Object.assign(new Error('The operation was aborted'), {
        name: 'AbortError',
      });
    });

    await expect(
      globalThis.fetch(new Request(WALLET_URL, { signal: controller.signal })),
    ).rejects.toThrow();

    expect(apiOutcomes()).toEqual([
      expect.objectContaining({ status: 'timeout' }),
    ]);
  });

  it('records an API error before the interceptor throws on it', async () => {
    const client = axios.create({
      adapter: adapterOf((config) => ({
        config,
        data: { code: 4001 },
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
          errorCode: 'api_4001',
        },
      }),
    ]);
  });

  it('records an abort by a timeout signal as a timeout', async () => {
    const client = axios.create({
      adapter: (config) =>
        new Promise((_resolve, reject) => {
          config.signal?.addEventListener?.('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    });

    await expect(
      client.get(WALLET_URL, { signal: AbortSignal.timeout(1) }),
    ).rejects.toThrow();

    expect(apiOutcomes()).toEqual([
      expect.objectContaining({ status: 'timeout' }),
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

  describe('custom UA on ordinary domain requests', () => {
    const originalPlatform = { ...platformEnv };
    const originalDesktopApi = globalThis.desktopApi;

    beforeEach(() => {
      globalThis.desktopApi = {
        ...originalDesktopApi,
        supportsCustomUserAgent: true,
      };
      Object.assign(platformEnv, {
        isDesktop: false,
        isNative: true,
        appPlatform: 'android',
        version: '6.7.0',
        isDesktopMac: false,
      });
      jest.mocked(requestHelper.checkIsOneKeyDomain).mockResolvedValue(true);
      jest.mocked(requestHelper.getDevSettingsPersistAtom).mockResolvedValue({
        enabled: false,
        settings: {},
      });
    });

    afterEach(() => {
      Object.assign(platformEnv, originalPlatform);
      globalThis.desktopApi = originalDesktopApi;
    });

    function createDomainClient() {
      return axios.create({
        baseURL: 'https://wallet.onekeycn.com',
        adapter: adapterOf((config) => ({
          config,
          data: { code: 0 },
          headers: {},
          status: 200,
          statusText: 'OK',
        })),
      });
    }

    it.each([
      ['ios', 'iOS'],
      ['android', 'Android'],
    ] as const)(
      'adds UA to %s axios domain requests',
      async (platform, label) => {
        platformEnv.appPlatform = platform;
        const response = await createDomainClient().get(
          '/wallet/v1/network/list',
        );
        expect(response.config.headers.get('User-Agent')).toBe(
          `OneKey ${label} 6.7.0`,
        );
        expect(response.config.headers.has(DESKTOP_CUSTOM_UA_HEADER)).toBe(
          false,
        );
      },
    );

    it('adds a desktop bridge header to axios domain requests', async () => {
      platformEnv.isDesktop = true;
      platformEnv.isNative = false;
      platformEnv.isDesktopMac = true;
      const response = await createDomainClient().get(
        '/wallet/v1/network/list',
      );
      expect(response.config.headers.get(DESKTOP_CUSTOM_UA_HEADER)).toBe(
        JSON.stringify(['https://wallet.onekeycn.com', 'OneKey macOS 6.7.0']),
      );
    });

    it('keeps axios and fetch compatible with older desktop shells', async () => {
      platformEnv.isDesktop = true;
      platformEnv.isNative = false;
      globalThis.desktopApi = {
        ...globalThis.desktopApi,
        supportsCustomUserAgent: undefined,
      };
      const response = await createDomainClient().get(
        '/wallet/v1/network/list',
      );
      expect(response.config.headers.has(DESKTOP_CUSTOM_UA_HEADER)).toBe(false);
      expect(response.config.headers.has('User-Agent')).toBe(false);
      await globalThis.fetch(WALLET_URL);
      const headers = new Headers(stubFetch.mock.calls.at(-1)?.[1]?.headers);
      expect(headers.has(DESKTOP_CUSTOM_UA_HEADER)).toBe(false);
      expect(headers.has('User-Agent')).toBe(false);
    });

    it('preserves axios caller UA and explicit false opt-out', async () => {
      const client = createDomainClient();
      const explicit = await client.get(WALLET_URL, {
        headers: { 'uSeR-aGeNt': 'caller-explicit' },
      });
      expect(explicit.config.headers.get('User-Agent')).toBe('caller-explicit');
      const disabled = await client.get(WALLET_URL, {
        headers: { 'User-Agent': false },
      });
      expect(disabled.config.headers.get('User-Agent')).toBe(false);
    });

    it('honors the developer disable switch for axios and fetch', async () => {
      jest.mocked(requestHelper.getDevSettingsPersistAtom).mockResolvedValue({
        enabled: true,
        settings: { disableCustomUA: true },
      });
      const response = await createDomainClient().get(WALLET_URL);
      expect(response.config.headers.has('User-Agent')).toBe(false);
      await globalThis.fetch(WALLET_URL);
      expect(
        new Headers(stubFetch.mock.calls[0][1]?.headers).has('User-Agent'),
      ).toBe(false);
    });

    it('adds UA to native fetch domain requests', async () => {
      await globalThis.fetch(WALLET_URL);
      expect(
        new Headers(stubFetch.mock.calls[0][1]?.headers).get('User-Agent'),
      ).toBe('OneKey Android 6.7.0');
    });

    it.each([
      { 'uSeR-aGeNt': 'caller-explicit' },
      new Headers({ 'User-Agent': 'caller-explicit' }),
      [['User-Agent', 'caller-explicit']],
    ] as HeadersInit[])(
      'preserves explicit fetch UA in header form %#',
      async (headers) => {
        await globalThis.fetch(WALLET_URL, { headers });
        expect(
          new Headers(stubFetch.mock.calls[0][1]?.headers).get('User-Agent'),
        ).toBe('caller-explicit');
      },
    );

    it('preserves Request headers and gives explicit fetch options priority', async () => {
      await globalThis.fetch(
        new Request(WALLET_URL, {
          headers: { 'User-Agent': 'request-UA', 'X-Test': 'keep' },
        }),
        { headers: new Headers({ 'user-agent': 'options-UA' }) },
      );
      const headers = new Headers(stubFetch.mock.calls[0][1]?.headers);
      expect(headers.get('User-Agent')).toBe('options-UA');
      expect(headers.get('X-Test')).toBe('keep');
    });

    it('leaves non-whitelisted requests without custom UA', async () => {
      jest.mocked(requestHelper.checkIsOneKeyDomain).mockResolvedValue(false);
      const response = await createDomainClient().get('https://example.com/x');
      expect(response.config.headers.has('User-Agent')).toBe(false);
      await globalThis.fetch('https://example.com/x');
      expect(
        new Headers(stubFetch.mock.calls[0][1]?.headers).has('User-Agent'),
      ).toBe(false);
    });

    it.each(['web', 'extension'] as const)(
      'leaves %s default UA unchanged',
      async (platform) => {
        platformEnv.isNative = false;
        platformEnv.appPlatform = platform;
        const response = await createDomainClient().get(WALLET_URL);
        expect(response.config.headers.has('User-Agent')).toBe(false);
        await globalThis.fetch(WALLET_URL);
        expect(
          new Headers(stubFetch.mock.calls[0][1]?.headers).has('User-Agent'),
        ).toBe(false);
      },
    );
  });
});

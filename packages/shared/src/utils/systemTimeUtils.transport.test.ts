import type {
  AxiosAdapter,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

const ENDPOINT = 'https://wallet.onekeycn.com';
const SERVER_TIME = Date.UTC(2030, 0, 1);
const mockPlatform = { isDesktop: true, isDev: false, isExtension: false };
const mockSniSupported = jest.fn(() => false);
const mockSniRequest = jest.fn<
  Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  } | null>,
  unknown[]
>();
const mockIpTableConfig = jest.fn<
  Promise<{
    config: { domains: Record<string, { endpoints: { ip: string }[] }> };
    runtime: { enabled: boolean; selections: Record<string, string> };
  }>,
  []
>();

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: mockPlatform,
}));
jest.mock('../config/endpointsMap', () => ({
  endpointsMap: {
    prod: { wallet: 'https://wallet.onekeycn.com' },
    test: { wallet: 'https://wallet.onekeytest.com' },
  },
  getEndpointByServiceName: async () => 'https://wallet.onekeycn.com',
}));
jest.mock('../storage/appStorage', () => ({
  __esModule: true,
  default: { syncStorage: { getNumber: () => undefined, set: jest.fn() } },
}));
jest.mock('../eventBus/appEventBus', () => ({
  appEventBus: { emit: jest.fn() },
  EAppEventBusNames: {},
}));
jest.mock('../request/requestHelper', () => ({
  __esModule: true,
  default: {
    checkIsOneKeyDomain: async () => true,
    getDevSettingsPersistAtom: async () => ({ settings: {} }),
    getIpTableConfig: () => mockIpTableConfig(),
  },
}));
jest.mock('../request/Interceptor', () => ({
  getRequestHeaders: async () => ({}),
}));
jest.mock('../request/helpers/sniRequest', () => ({
  isSniSupported: () => mockSniSupported(),
  isProxyActiveForUrl: async () => false,
  sniRequest: (...args: unknown[]) => mockSniRequest(...args),
}));
jest.mock('../travelMode/runtimeNetworkAdapter', () => ({
  createRuntimeNetworkAdapter: (adapter: AxiosAdapter) => adapter,
}));
jest.mock('./ipTableUtils', () => ({ isSupportIpTablePlatform: () => true }));
jest.mock('../logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      metrics: {
        endpointSwitched: jest.fn(),
        adapterFailover: jest.fn(),
        configVerifyFailed: jest.fn(),
      },
    },
  },
}));

describe('hardware time through the configured Axios and IP-table transports', () => {
  let axios: typeof import('axios').default;
  let client: AxiosInstance;
  let systemTimeUtils: typeof import('./systemTimeUtils').default;
  let sentRequests: { url: string; config: InternalAxiosRequestConfig }[];
  let responseUrl: string | undefined;
  let responseQueryError: 'missing' | 'changed' | undefined;
  let responseAge: string | undefined;
  let responseDate: string | undefined;
  const previousProxy = process.env.ONEKEY_PROXY;
  const previousLocation = Object.getOwnPropertyDescriptor(
    globalThis,
    'location',
  );

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.ONEKEY_PROXY;
    Object.assign(mockPlatform, {
      isDesktop: true,
      isDev: false,
      isExtension: false,
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'http://localhost:3001' },
    });
    mockSniSupported.mockReturnValue(false);
    mockSniRequest.mockResolvedValue({
      statusCode: 200,
      headers: { date: new Date(SERVER_TIME).toUTCString() },
      body: '{}',
    });
    mockIpTableConfig.mockResolvedValue({
      config: {
        domains: { 'onekeycn.com': { endpoints: [{ ip: '93.184.216.34' }] } },
      },
      runtime: {
        enabled: true,
        selections: { 'onekeycn.com': '93.184.216.34' },
      },
    });
    jest.spyOn(Date, 'now').mockReturnValue(SERVER_TIME);
    jest.spyOn(performance, 'now').mockReturnValue(1000);
    sentRequests = [];
    responseUrl = undefined;
    responseQueryError = undefined;
    responseAge = undefined;
    responseDate = new Date(SERVER_TIME).toUTCString();
    axios = (await import('axios')).default;
    // Keep the real client and IP-table adapter; replace only the wire transport.
    axios.defaults.adapter = async (config) => {
      const url = new URL(axios.getUri(config), globalThis.location.origin)
        .href;
      sentRequests.push({ url, config });
      const finalUrl = new URL(responseUrl ?? url);
      finalUrl.search = new URL(url).search;
      if (responseQueryError === 'missing')
        finalUrl.searchParams.delete('nonce');
      if (responseQueryError === 'changed')
        finalUrl.searchParams.set('nonce', 'changed');
      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: { date: responseDate, age: responseAge },
        config,
        request: { responseURL: finalUrl.href },
      };
    };
  });

  afterEach(() => {
    if (previousProxy === undefined) delete process.env.ONEKEY_PROXY;
    else process.env.ONEKEY_PROXY = previousProxy;
    if (previousLocation)
      Object.defineProperty(globalThis, 'location', previousLocation);
    else Reflect.deleteProperty(globalThis, 'location');
    jest.restoreAllMocks();
  });

  async function loadClient() {
    const { appApiClient } = await import('../appApiClient/appApiClient');
    const { EServiceEndpointEnum } = await import('../../types/endpoint');
    client = await appApiClient.getClient({
      endpoint: ENDPOINT,
      name: EServiceEndpointEnum.Wallet,
    });
    systemTimeUtils = (await import('./systemTimeUtils')).default;
  }

  function expectTimeQuery(url: string, origin: string) {
    const parsed = new URL(url, ENDPOINT);
    expect(parsed.origin).toBe(origin);
    expect(parsed.pathname).toBe('/wallet/v1/health');
    expect(parsed.searchParams.get('_')).toBe('hardware_verification');
    expect(parsed.searchParams.get('nonce')).toMatch(/^[0-9A-Za-z]{12}$/);
    return parsed.searchParams.get('nonce');
  }

  it('sends a fresh nonce through the normal domain transport on every attempt', async () => {
    await loadClient();
    expect(await systemTimeUtils.getHardwareVerificationTime()).toBe(
      SERVER_TIME,
    );
    expect(await systemTimeUtils.getHardwareVerificationTime()).toBe(
      SERVER_TIME,
    );
    const first = expectTimeQuery(sentRequests[0].url, ENDPOINT);
    expect(expectTimeQuery(sentRequests[1].url, ENDPOINT)).not.toBe(first);
  });

  it.each([false, true])(
    'preserves the query in selected-IP SNI and its fallback (fallback=%s)',
    async (fallback) => {
      mockSniSupported.mockReturnValue(true);
      if (fallback) mockSniRequest.mockResolvedValue(null);
      await loadClient();
      expect(await systemTimeUtils.getHardwareVerificationTime()).toBe(
        SERVER_TIME,
      );
      expect(mockSniRequest).toHaveBeenCalledTimes(1);
      const request = mockSniRequest.mock.calls[0][0] as {
        hostname: string;
        path: string;
      };
      expect(request.hostname).toBe('wallet.onekeycn.com');
      const nonce = expectTimeQuery(`${ENDPOINT}${request.path}`, ENDPOINT);
      if (fallback)
        expect(expectTimeQuery(sentRequests[0].url, ENDPOINT)).toBe(nonce);
      else expect(sentRequests).toHaveLength(0);
    },
  );

  it.each([false, true])(
    'uses the configured development proxy (extension=%s)',
    async (isExtension) => {
      Object.assign(mockPlatform, { isDev: true, isExtension });
      process.env.ONEKEY_PROXY = 'true';
      await loadClient();
      expect(await systemTimeUtils.getHardwareVerificationTime()).toBe(
        SERVER_TIME,
      );
      expectTimeQuery(
        sentRequests[0].url,
        isExtension ? 'http://localhost:3180' : 'http://localhost:3001',
      );
      expect(sentRequests[0].config.headers.get('X-OneKey-Dev-Proxy')).toBe(
        ENDPOINT,
      );
    },
  );

  it.each([
    'http://localhost:9999',
    'https://other.example.com',
    'https://wallet.onekeytest.com',
  ])('rejects a cached client on an unexpected route: %s', async (baseURL) => {
    await loadClient();
    client.defaults.baseURL = baseURL;
    expect(await systemTimeUtils.getHardwareVerificationTime()).toBeUndefined();
    expect(sentRequests).toHaveLength(0);
  });

  it('does not enable a proxy exception in production', async () => {
    process.env.ONEKEY_PROXY = 'true';
    await loadClient();
    client.defaults.baseURL = 'http://localhost:3180';
    client.defaults.headers['X-OneKey-Dev-Proxy'] = ENDPOINT;
    expect(await systemTimeUtils.getHardwareVerificationTime()).toBeUndefined();
    expect(sentRequests).toHaveLength(0);
  });

  it('rejects a proxy pointing at an unapproved upstream', async () => {
    Object.assign(mockPlatform, { isDev: true, isExtension: true });
    process.env.ONEKEY_PROXY = 'true';
    await loadClient();
    client.defaults.headers['X-OneKey-Dev-Proxy'] = 'https://other.example.com';
    expect(await systemTimeUtils.getHardwareVerificationTime()).toBeUndefined();
    expect(sentRequests).toHaveLength(0);
  });

  it.each([
    'http://localhost:3181/wallet/v1/health',
    'http://localhost.evil.example:3180/wallet/v1/health',
    'https://other.example.com/wallet/v1/health',
  ])(
    'rejects proxy redirects outside its configured origin: %s',
    async (url) => {
      Object.assign(mockPlatform, { isDev: true, isExtension: true });
      process.env.ONEKEY_PROXY = 'true';
      responseUrl = url;
      await loadClient();
      expect(
        await systemTimeUtils.getHardwareVerificationTime(),
      ).toBeUndefined();
    },
  );

  it.each(['date', 'age'])(
    'preserves response validation on the proxy route: %s',
    async (invalid) => {
      Object.assign(mockPlatform, { isDev: true, isExtension: true });
      process.env.ONEKEY_PROXY = 'true';
      if (invalid === 'date') responseDate = 'invalid';
      else responseAge = '10';
      await loadClient();
      expect(
        await systemTimeUtils.getHardwareVerificationTime(),
      ).toBeUndefined();
    },
  );
  it.each(['missing', 'changed'] as const)(
    'rejects a proxy response whose nonce is %s',
    async (error) => {
      Object.assign(mockPlatform, { isDev: true, isExtension: true });
      process.env.ONEKEY_PROXY = 'true';
      responseQueryError = error;
      await loadClient();
      expect(
        await systemTimeUtils.getHardwareVerificationTime(),
      ).toBeUndefined();
    },
  );

  it('rejects a same-origin proxy redirect away from the health route', async () => {
    Object.assign(mockPlatform, { isDev: true, isExtension: true });
    process.env.ONEKEY_PROXY = 'true';
    responseUrl = 'http://localhost:3180/other';
    await loadClient();
    expect(await systemTimeUtils.getHardwareVerificationTime()).toBeUndefined();
  });

  it('rejects a web proxy response from a different page origin', async () => {
    mockPlatform.isDev = true;
    process.env.ONEKEY_PROXY = 'true';
    responseUrl = 'http://localhost:3002/wallet/v1/health';
    await loadClient();
    expect(await systemTimeUtils.getHardwareVerificationTime()).toBeUndefined();
  });

  it('does not infer a proxy origin in a runtime without a page origin', async () => {
    mockPlatform.isDev = true;
    process.env.ONEKEY_PROXY = 'true';
    Reflect.deleteProperty(globalThis, 'location');
    await loadClient();
    expect(await systemTimeUtils.getHardwareVerificationTime()).toBeUndefined();
    expect(sentRequests).toHaveLength(0);
  });
});

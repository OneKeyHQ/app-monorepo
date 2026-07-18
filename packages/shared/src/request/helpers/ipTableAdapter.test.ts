import axios from 'axios';

import { getRequestHeaders } from '../Interceptor';
import requestHelper from '../requestHelper';

import { createIpTableAdapter, testIpSpeed } from './ipTableAdapter';
import { isProxyActiveForUrl, isSniSupported, sniRequest } from './sniRequest';

import type { IIpTableRequestConfig } from './ipTableAdapter';
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

function buildConfig(
  url: string,
  overrides: IIpTableRequestConfig = {},
): InternalAxiosRequestConfig {
  return {
    url,
    method: 'get',
    headers: axios.AxiosHeaders.from({}),
    ...overrides,
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
      adapter(
        buildConfig('https://api.example.com/v1', {
          ipTableFailClosedAfterSniAttempt: true,
        }),
      ),
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

  test('keeps the default fallback after an ambiguous SNI failure', async () => {
    mockedSniRequest.mockRejectedValue(new Error('connection reset'));
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(buildConfig('https://api.example.com/v1')),
    ).resolves.toMatchObject({
      status: 200,
      data: { fallback: true },
    });

    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('keeps the default fallback when an SNI attempt returns no response', async () => {
    mockedSniRequest.mockResolvedValue(null);
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(buildConfig('https://api.example.com/v1')),
    ).resolves.toMatchObject({
      status: 200,
      data: { fallback: true },
    });

    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(fallbackAdapter).toHaveBeenCalledTimes(1);
  });

  test('fails closed after an ambiguous SNI error when requested', async () => {
    const sniError = new Error('connection reset');
    mockedSniRequest.mockRejectedValue(sniError);
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(
        buildConfig('https://api.example.com/v1', {
          data: { amount: '1' },
          headers: axios.AxiosHeaders.from({ 'X-Test': 'value' }),
          ipTableFailClosedAfterSniAttempt: true,
          method: 'post',
        }),
      ),
    ).rejects.toBe(sniError);

    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    const sniConfig = mockedSniRequest.mock.calls[0][0];
    expect(sniConfig).toMatchObject({
      body: '{"amount":"1"}',
      headers: { 'X-Test': 'value', 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(sniConfig).not.toHaveProperty('ipTableFailClosedAfterSniAttempt');
    expect(sniConfig.headers).not.toHaveProperty(
      'ipTableFailClosedAfterSniAttempt',
    );
    expect(sniConfig.body).not.toContain('ipTableFailClosedAfterSniAttempt');
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });

  test('fails closed when an SNI attempt returns no response', async () => {
    mockedSniRequest.mockResolvedValue(null);
    const adapter = createIpTableAdapter({});

    await expect(
      adapter(
        buildConfig('https://api.example.com/v1', {
          ipTableFailClosedAfterSniAttempt: true,
        }),
      ),
    ).rejects.toThrow('SNI request outcome is unknown');

    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(fallbackAdapter).not.toHaveBeenCalled();
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

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

import axios from 'axios';

import requestHelper from '../requestHelper';

import { createIpTableAdapter } from './ipTableAdapter';
import { isProxyActiveForUrl, isSniSupported, sniRequest } from './sniRequest';

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

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
  let fallbackAdapter: jest.Mock<Promise<AxiosResponse>, [InternalAxiosRequestConfig]>;
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

    await expect(adapter(buildConfig('https://api.example.com/v1'))).resolves.toMatchObject({
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

  test('does not fallback after SNI starts and returns a fail-closed error', async () => {
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('certificate rejected'), {
        code: 'SNI_CERT_FAILED',
      }),
    );
    const adapter = createIpTableAdapter({});

    await expect(adapter(buildConfig('https://api.example.com/v1'))).rejects.toMatchObject({
      code: 'SNI_CERT_FAILED',
    });

    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(fallbackAdapter).not.toHaveBeenCalled();
  });
});

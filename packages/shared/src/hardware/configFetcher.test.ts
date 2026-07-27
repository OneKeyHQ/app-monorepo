import axios from 'axios';

import {
  getMappedDomainForIpLookup,
  isIpTableTransportError,
} from '../request/helpers/ipTableAdapter';
import {
  isProxyActiveForUrl,
  isSniSupported,
  sniRequest,
} from '../request/helpers/sniRequest';
import requestHelper from '../request/requestHelper';

import { createConfigFetcher } from './configFetcher';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isDesktop: false,
  },
}));

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: jest.fn(),
      },
    },
  },
}));

jest.mock('../request/requestHelper', () => ({
  __esModule: true,
  default: {
    getIpTableConfig: jest.fn(),
  },
}));

jest.mock('../request/helpers/ipTableAdapter', () => ({
  getMappedDomainForIpLookup: jest.fn(),
  isIpTableTransportError: jest.fn(),
  reportIpTableRequestFailure: jest.fn(),
  reportIpTableRequestSuccess: jest.fn(),
}));

jest.mock('../request/helpers/sniRequest', () => ({
  isProxyActiveForUrl: jest.fn(),
  isSniSupported: jest.fn(),
  sniRequest: jest.fn(),
}));

const mockedAxios = jest.mocked(axios);
const mockedRequestHelper = requestHelper as jest.Mocked<typeof requestHelper>;
const mockedGetMappedDomainForIpLookup =
  getMappedDomainForIpLookup as jest.Mock;
const mockedIsIpTableTransportError = isIpTableTransportError as jest.Mock;
const mockedIsProxyActiveForUrl = isProxyActiveForUrl as jest.Mock;
const mockedIsSniSupported = isSniSupported as jest.Mock;
const mockedSniRequest = sniRequest as jest.Mock;

const CONFIG_URL = 'https://data.onekey.so/config.json?noCache=1';
const BUILTIN_FIRST_IP = '104.18.20.233';

function buildRemoteConfig(): RemoteConfigResponse {
  const deviceConfig = { firmware: [], ble: [] };
  return {
    bridge: {} as RemoteConfigResponse['bridge'],
    classic: deviceConfig,
    classic1s: deviceConfig,
    classicpure: deviceConfig,
    mini: deviceConfig,
    touch: deviceConfig,
    pro: deviceConfig,
    pro2: deviceConfig,
  };
}

function transportError(code = 'ECONNABORTED') {
  return Object.assign(new Error(code), { code });
}

describe('firmware config fetcher', () => {
  const directGet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({ get: directGet });
    mockedGetMappedDomainForIpLookup.mockResolvedValue('onekeycn.com');
    mockedIsIpTableTransportError.mockImplementation(
      (error: { code?: string }) =>
        ['ECONNABORTED', 'SNI_TIMEOUT', 'SNI_CONNECTION_REFUSED'].includes(
          error?.code ?? '',
        ),
    );
    mockedIsSniSupported.mockReturnValue(true);
    mockedIsProxyActiveForUrl.mockResolvedValue(false);
    mockedRequestHelper.getIpTableConfig.mockResolvedValue(null);
  });

  it('returns a valid direct-domain response without SNI', async () => {
    const config = buildRemoteConfig();
    directGet.mockResolvedValue({ data: config });
    const fetchConfig = await createConfigFetcher();

    await expect(fetchConfig?.(CONFIG_URL)).resolves.toBe(config);
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  it('uses the first builtin candidate on a cold-start transport failure', async () => {
    const config = buildRemoteConfig();
    directGet.mockRejectedValue(transportError());
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(config),
    });
    const fetchConfig = await createConfigFetcher();

    await expect(fetchConfig?.(CONFIG_URL)).resolves.toEqual(config);
    expect(mockedSniRequest).toHaveBeenCalledWith({
      ip: BUILTIN_FIRST_IP,
      hostname: 'data.onekey.so',
      path: '/config.json?noCache=1',
      method: 'GET',
      headers: {},
      body: null,
      timeout: 7000,
    });
  });

  it.each([
    [
      'HTTP response',
      Object.assign(new Error('HTTP 500'), { response: { status: 500 } }),
    ],
    [
      'cancellation',
      Object.assign(new Error('cancelled'), { code: 'ERR_CANCELED' }),
    ],
  ])('does not start an SNI waterfall after a %s', async (_name, error) => {
    directGet.mockRejectedValue(error);
    const fetchConfig = await createConfigFetcher();

    await expect(fetchConfig?.(CONFIG_URL)).resolves.toBeNull();
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  it('does not bypass an active proxy', async () => {
    directGet.mockRejectedValue(transportError());
    mockedIsProxyActiveForUrl.mockResolvedValue(true);
    const fetchConfig = await createConfigFetcher();

    await expect(fetchConfig?.(CONFIG_URL)).resolves.toBeNull();
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  it('tries selection, last-best, then builtin without duplicates', async () => {
    const config = buildRemoteConfig();
    directGet.mockRejectedValue(transportError());
    mockedRequestHelper.getIpTableConfig.mockResolvedValue({
      config: {
        version: 2,
        ttl_sec: 60,
        generated_at: '2026-07-27T00:00:00.000Z',
        signature: '',
        domains: {
          'onekeycn.com': {
            endpoints: [
              {
                ip: '1.1.1.1',
                provider: 'test',
                region: 'ALL',
                weight: 1,
              },
              {
                ip: '2.2.2.2',
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
        selections: { 'onekeycn.com': '1.1.1.1' },
        lastBestIp: { 'onekeycn.com': '2.2.2.2' },
      },
    });
    mockedSniRequest
      .mockRejectedValueOnce(transportError('SNI_TIMEOUT'))
      .mockRejectedValueOnce(transportError('SNI_CONNECTION_REFUSED'))
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: JSON.stringify(config),
      });
    const fetchConfig = await createConfigFetcher();

    await expect(fetchConfig?.(CONFIG_URL)).resolves.toEqual(config);
    expect(
      mockedSniRequest.mock.calls.map(
        ([request]) => (request as { ip: string }).ip,
      ),
    ).toEqual(['1.1.1.1', '2.2.2.2', BUILTIN_FIRST_IP]);
  });
});

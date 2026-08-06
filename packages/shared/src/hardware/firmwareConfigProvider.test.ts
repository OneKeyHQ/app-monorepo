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

import { fetchFirmwareConfig } from './firmwareConfigProvider';

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
const PRE_RELEASE_CONFIG_URL =
  'https://data.onekey.so/pre-config.json?noCache=1';
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

describe('firmware config provider', () => {
  const directGet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1);
    mockedAxios.create.mockReturnValue({
      get: directGet,
    } as unknown as ReturnType<typeof axios.create>);
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a valid direct-domain response without SNI', async () => {
    const config = buildRemoteConfig();
    directGet.mockResolvedValue({ data: config });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toBe(
      config,
    );
    expect(directGet).toHaveBeenCalledWith(CONFIG_URL, { timeout: 7000 });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  it('uses the pre-release URL selected by the App', async () => {
    const config = buildRemoteConfig();
    directGet.mockResolvedValue({ data: config });

    await expect(fetchFirmwareConfig({ preRelease: true })).resolves.toBe(
      config,
    );
    expect(directGet).toHaveBeenCalledWith(PRE_RELEASE_CONFIG_URL, {
      timeout: 7000,
    });
  });

  it('normalizes a stable config published before the Pro2 manifest', async () => {
    const { pro2: _pro2, ...stableConfig } = buildRemoteConfig();
    directGet.mockResolvedValue({ data: stableConfig });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toEqual({
      ...stableConfig,
      pro2: {
        firmware: [],
        ble: [],
      },
    });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  it('uses SNI fallback after confirming the system proxy is inactive', async () => {
    const config = buildRemoteConfig();
    directGet.mockRejectedValue(transportError());
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(config),
    });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toEqual(
      config,
    );
    expect(mockedIsProxyActiveForUrl).toHaveBeenCalledWith(CONFIG_URL);
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

  it('keeps one SNI fallback when the system proxy is active', async () => {
    const config = buildRemoteConfig();
    directGet.mockRejectedValue(transportError());
    mockedIsProxyActiveForUrl.mockResolvedValue(true);
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(config),
    });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toEqual(
      config,
    );
    expect(mockedIsProxyActiveForUrl).toHaveBeenCalledWith(CONFIG_URL);
    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
  });

  it('limits SNI fallback to one candidate when the proxy preflight fails', async () => {
    directGet.mockRejectedValue(transportError());
    mockedIsProxyActiveForUrl.mockRejectedValue(
      new Error('proxy preflight failed'),
    );
    mockedSniRequest.mockRejectedValue(transportError('SNI_TIMEOUT'));

    await expect(
      fetchFirmwareConfig({ preRelease: false }),
    ).resolves.toBeNull();
    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps SNI fallback for legacy binaries without proxy preflight support', async () => {
    const config = buildRemoteConfig();
    directGet.mockRejectedValue(transportError());
    mockedIsProxyActiveForUrl.mockResolvedValue(null);
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(config),
    });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toEqual(
      config,
    );
    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
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

    await expect(
      fetchFirmwareConfig({ preRelease: false }),
    ).resolves.toBeNull();
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

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toEqual(
      config,
    );
    expect(
      mockedSniRequest.mock.calls.map(
        ([request]) => (request as { ip: string }).ip,
      ),
    ).toEqual(['1.1.1.1', '2.2.2.2', BUILTIN_FIRST_IP]);
  });

  it('continues after non-2xx and invalid SNI responses', async () => {
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
      .mockResolvedValueOnce({
        statusCode: 404,
        headers: {},
        body: 'not found',
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: '{invalid json',
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: JSON.stringify(config),
      });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toEqual(
      config,
    );
    expect(
      mockedSniRequest.mock.calls.map(
        ([request]) => (request as { ip: string }).ip,
      ),
    ).toEqual(['1.1.1.1', '2.2.2.2', BUILTIN_FIRST_IP]);
  });
});

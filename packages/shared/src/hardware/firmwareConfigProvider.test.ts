import axios from 'axios';

import { defaultLogger } from '../logger/logger';
import {
  getMappedDomainForIpLookup,
  isIpTableTransportError,
  reportIpTableRequestSuccess,
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
    jest.useFakeTimers({ now: 1 });
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
    jest.useRealTimers();
  });

  it('returns a valid direct-domain response without SNI', async () => {
    const config = buildRemoteConfig();
    directGet.mockResolvedValue({ data: config });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toBe(
      config,
    );
    expect(directGet).toHaveBeenCalledWith(CONFIG_URL, {
      timeout: 15_000,
      signal: expect.any(AbortSignal),
    });
    expect(mockedSniRequest).not.toHaveBeenCalled();
  });

  it('uses the pre-release URL selected by the App', async () => {
    const config = buildRemoteConfig();
    directGet.mockResolvedValue({ data: config });

    await expect(fetchFirmwareConfig({ preRelease: true })).resolves.toBe(
      config,
    );
    expect(directGet).toHaveBeenCalledWith(PRE_RELEASE_CONFIG_URL, {
      timeout: 15_000,
      signal: expect.any(AbortSignal),
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
      timeout: 15_000,
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

  it('accepts a domain response that takes longer than seven seconds', async () => {
    const config = buildRemoteConfig();
    directGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: config }), 9000);
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(9000);

    await expect(result).resolves.toBe(config);
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('allows a slow SNI response after the domain attempt times out', async () => {
    const config = buildRemoteConfig();
    directGet.mockImplementation(
      (_url: string, { timeout }: { timeout: number }) =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(transportError()), timeout);
        }),
    );
    mockedSniRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                statusCode: 200,
                headers: {},
                body: JSON.stringify(config),
              }),
            9000,
          );
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(24_000);

    await expect(result).resolves.toEqual(config);
    expect(mockedSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 15_000 }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('shares the remaining total budget across SNI candidates', async () => {
    directGet.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(transportError()), 15_000);
        }),
    );
    mockedSniRequest.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(transportError('SNI_TIMEOUT')), 10_000);
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toBeNull();
    expect(mockedSniRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ timeout: 15_000 }),
    );
    expect(mockedSniRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ timeout: 5000 }),
    );
    await jest.advanceTimersByTimeAsync(10_000);
    expect(mockedSniRequest).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts a stalled domain request at the total deadline', async () => {
    let requestSignal: AbortSignal | undefined;
    directGet.mockImplementation(
      (_url: string, { signal }: { signal: AbortSignal }) => {
        requestSignal = signal;
        return new Promise(() => {});
      },
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toBeNull();
    expect(requestSignal?.aborted).toBe(true);
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not start SNI when proxy preflight exhausts the total budget', async () => {
    directGet.mockRejectedValue(transportError());
    mockedIsProxyActiveForUrl.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(false), 31_000);
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(30_000);
    await expect(result).resolves.toBeNull();
    await jest.advanceTimersByTimeAsync(1000);

    expect(mockedRequestHelper.getIpTableConfig).not.toHaveBeenCalled();
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores a successful SNI response after the total deadline', async () => {
    const config = buildRemoteConfig();
    const logInfoSpy = jest.spyOn(defaultLogger.ipTable.request, 'info');
    directGet.mockRejectedValue(transportError());
    mockedSniRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                statusCode: 200,
                headers: {},
                body: JSON.stringify(config),
              }),
            31_000,
          );
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(30_000);
    await expect(result).resolves.toBeNull();
    await jest.advanceTimersByTimeAsync(1000);

    expect(reportIpTableRequestSuccess).not.toHaveBeenCalled();
    expect(logInfoSpy).not.toHaveBeenCalledWith({
      info: expect.stringContaining('outcome=success'),
    });
    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
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

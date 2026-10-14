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
// Cloudflare endpoints lead the builtin table but are skipped for this host.
const BUILTIN_FIRST_IP = '216.19.3.115';
// The builtin fill alternates between the two non-Cloudflare providers.
const BUILTIN_SECOND_IP = '43.168.19.96';
const BUILTIN_THIRD_IP = '216.19.2.116';

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

type IIpTableConfigWithRuntime = NonNullable<
  Awaited<ReturnType<typeof requestHelper.getIpTableConfig>>
>;

// `provider` is optional here because the remote shape guard only checks `ip`.
function mockActiveIpTable({
  domain = 'onekeycn.com',
  endpoints,
  selection,
  lastBestIp,
}: {
  domain?: string;
  endpoints: Array<{ ip: string; provider?: string }>;
  selection: string;
  lastBestIp: string;
}) {
  mockedRequestHelper.getIpTableConfig.mockResolvedValue({
    config: {
      version: 2,
      ttl_sec: 60,
      generated_at: '2026-07-27T00:00:00.000Z',
      signature: '',
      domains: {
        [domain]: {
          endpoints: endpoints.map((endpoint) => ({
            region: 'ALL',
            weight: 100,
            ...endpoint,
          })),
        },
      },
    },
    runtime: {
      enabled: true,
      lastUpdated: 0,
      lastRegionCheck: 0,
      selections: { [domain]: selection },
      lastBestIp: { [domain]: lastBestIp },
    },
  } as IIpTableConfigWithRuntime);
}

function getSniRequestIps(): string[] {
  return mockedSniRequest.mock.calls.map(
    ([request]) => (request as { ip: string }).ip,
  );
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
      timeout: 10_000,
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
      timeout: 10_000,
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
      timeout: 10_000,
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
    await jest.advanceTimersByTimeAsync(19_000);

    await expect(result).resolves.toEqual(config);
    expect(mockedSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 10_000 }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['timeout', 'null'])(
    'reaches the third builtin after timed-out attempts return %s',
    async (failureMode) => {
      const config = buildRemoteConfig();
      directGet.mockImplementation(
        (_url: string, { timeout }: { timeout: number }) =>
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(transportError()), timeout);
          }),
      );
      mockedIsProxyActiveForUrl.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(false), 4000);
          }),
      );
      mockedSniRequest.mockImplementation(
        ({ ip, timeout }: { ip: string; timeout: number }) =>
          new Promise((resolve, reject) => {
            const isLastCandidate = ip === BUILTIN_THIRD_IP;
            setTimeout(
              () => {
                if (isLastCandidate) {
                  resolve({
                    statusCode: 200,
                    headers: {},
                    body: JSON.stringify(config),
                  });
                } else if (failureMode === 'timeout') {
                  reject(transportError('SNI_TIMEOUT'));
                } else {
                  resolve(null);
                }
              },
              isLastCandidate ? 9000 : timeout,
            );
          }),
      );

      const result = fetchFirmwareConfig({ preRelease: false });
      await jest.advanceTimersByTimeAsync(43_000);

      await expect(result).resolves.toEqual(config);
      expect(
        mockedSniRequest.mock.calls.map(
          ([request]) => (request as { ip: string }).ip,
        ),
      ).toEqual([BUILTIN_FIRST_IP, BUILTIN_SECOND_IP, BUILTIN_THIRD_IP]);
      expect(mockedSniRequest).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ timeout: 10_000 }),
      );
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('finishes all three SNI timeouts before the total deadline', async () => {
    directGet.mockImplementation(
      (_url: string, { timeout }: { timeout: number }) =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(transportError()), timeout);
        }),
    );
    mockedSniRequest.mockImplementation(
      ({ timeout }: { timeout: number }) =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(transportError('SNI_TIMEOUT')), timeout);
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBeNull();
    expect(mockedSniRequest).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('caps SNI attempts to the budget remaining after slow preflight', async () => {
    directGet.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(transportError()), 10_000);
        }),
    );
    mockedIsProxyActiveForUrl.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(false), 20_000);
        }),
    );
    mockedSniRequest.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(transportError('SNI_TIMEOUT')), 10_000);
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(45_000);

    await expect(result).resolves.toBeNull();
    expect(mockedSniRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ timeout: 10_000 }),
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
    expect(requestSignal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(15_000);

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
          setTimeout(() => resolve(false), 46_000);
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(45_000);
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
            46_000,
          );
        }),
    );

    const result = fetchFirmwareConfig({ preRelease: false });
    await jest.advanceTimersByTimeAsync(45_000);
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

  it('skips Cloudflare endpoints, including a Cloudflare runtime selection', async () => {
    const config = buildRemoteConfig();
    directGet.mockRejectedValue(transportError());
    mockActiveIpTable({
      endpoints: [
        { ip: '9.9.9.9', provider: 'Cloudflare' },
        { ip: '1.1.1.1', provider: 'test' },
      ],
      selection: '9.9.9.9',
      lastBestIp: '1.1.1.1',
    });
    mockedSniRequest
      .mockRejectedValueOnce(transportError('SNI_TIMEOUT'))
      .mockRejectedValueOnce(transportError('SNI_TIMEOUT'))
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: JSON.stringify(config),
      });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toEqual(
      config,
    );
    expect(getSniRequestIps()).toEqual([
      '1.1.1.1',
      BUILTIN_FIRST_IP,
      BUILTIN_SECOND_IP,
    ]);
  });

  it('follows a preferred endpoint with a different provider', async () => {
    const config = buildRemoteConfig();
    directGet.mockRejectedValue(transportError());
    mockActiveIpTable({
      endpoints: [{ ip: BUILTIN_THIRD_IP, provider: 'volcengine' }],
      selection: '',
      lastBestIp: BUILTIN_THIRD_IP,
    });
    mockedSniRequest
      .mockRejectedValueOnce(transportError('SNI_TIMEOUT'))
      .mockRejectedValueOnce(transportError('SNI_TIMEOUT'))
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: JSON.stringify(config),
      });

    await expect(fetchFirmwareConfig({ preRelease: false })).resolves.toEqual(
      config,
    );
    expect(getSniRequestIps()).toEqual([
      BUILTIN_THIRD_IP,
      BUILTIN_SECOND_IP,
      BUILTIN_FIRST_IP,
    ]);
  });

  it('tries a selection that is also last-best and builtin only once', async () => {
    directGet.mockRejectedValue(transportError());
    mockActiveIpTable({
      endpoints: [{ ip: BUILTIN_FIRST_IP, provider: 'volcengine' }],
      selection: BUILTIN_FIRST_IP,
      lastBestIp: BUILTIN_FIRST_IP,
    });
    mockedSniRequest.mockRejectedValue(transportError('SNI_TIMEOUT'));

    await expect(
      fetchFirmwareConfig({ preRelease: false }),
    ).resolves.toBeNull();
    expect(getSniRequestIps()).toEqual([
      BUILTIN_FIRST_IP,
      BUILTIN_SECOND_IP,
      BUILTIN_THIRD_IP,
    ]);
  });

  it('resolves provider labels from the active table first, then the builtin one', async () => {
    directGet.mockRejectedValue(transportError());
    mockActiveIpTable({
      endpoints: [
        // No label here: the builtin table labels it Cloudflare.
        { ip: '104.18.20.233' },
        // The active label overrides the builtin one.
        { ip: BUILTIN_FIRST_IP, provider: 'cloudflare' },
        // No label in either table: still usable.
        { ip: '5.5.5.5' },
      ],
      selection: '104.18.20.233',
      lastBestIp: '5.5.5.5',
    });
    mockedSniRequest.mockRejectedValue(transportError('SNI_TIMEOUT'));

    await expect(
      fetchFirmwareConfig({ preRelease: false }),
    ).resolves.toBeNull();
    expect(getSniRequestIps()).toEqual([
      '5.5.5.5',
      BUILTIN_THIRD_IP,
      BUILTIN_SECOND_IP,
    ]);
  });

  it('uses only the non-Cloudflare builtin endpoints of the test API table', async () => {
    mockedGetMappedDomainForIpLookup.mockResolvedValue('onekeytest.com');
    directGet.mockRejectedValue(transportError());
    mockedSniRequest.mockRejectedValue(transportError('SNI_TIMEOUT'));

    await expect(
      fetchFirmwareConfig({ preRelease: false }),
    ).resolves.toBeNull();
    expect(getSniRequestIps()).toEqual(['43.168.24.171', '43.168.19.96']);
  });

  it('makes no SNI attempt when only Cloudflare endpoints are known', async () => {
    mockedGetMappedDomainForIpLookup.mockResolvedValue(null);
    directGet.mockRejectedValue(transportError());
    mockActiveIpTable({
      domain: 'onekey.so',
      endpoints: [{ ip: '9.9.9.9', provider: 'cloudflare' }],
      selection: '9.9.9.9',
      lastBestIp: '9.9.9.9',
    });

    await expect(
      fetchFirmwareConfig({ preRelease: false }),
    ).resolves.toBeNull();
    expect(mockedSniRequest).not.toHaveBeenCalled();
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

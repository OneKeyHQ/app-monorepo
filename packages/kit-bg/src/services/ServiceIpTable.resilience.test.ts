/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import axios from 'axios';

import { sniRequest } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import type { IIpTableRemoteConfig } from '@onekeyhq/shared/src/request/types/ipTable';
import { createEffectiveIpTableConfig } from '@onekeyhq/shared/src/utils/ipTableUtils';

import ServiceIpTable from './ServiceIpTable';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/utils/ipTableUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/ipTableUtils')
  >('@onekeyhq/shared/src/utils/ipTableUtils');

  return {
    ...actual,
    isSupportIpTablePlatform: jest.fn(() => true),
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      metrics: {
        endpointSwitched: jest.fn(),
        configVerifyFailed: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/request/helpers/ipTableAdapter', () => ({
  getSelectedIpForHost: Object.assign(jest.fn(), { clear: jest.fn() }),
  setReportRequestFailureCallback: jest.fn(),
  setReportRequestSuccessCallback: jest.fn(),
  testDomainSpeed: jest.fn(),
  testIpSpeed: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/request/helpers/sniRequest', () => ({
  isProxyActiveForUrl: jest.fn(async () => false),
  isSniSupported: jest.fn(() => true),
  sniRequest: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  getRequestHeaders: jest.fn(async () => ({})),
}));

jest.mock('../states/jotai/atoms', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: false, settings: {} })),
  },
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBaseMock {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

const DOMAIN = 'onekeycn.com';

function buildConfig(ip: string, version = 1): IIpTableRemoteConfig {
  return {
    version,
    ttl_sec: 300,
    generated_at: `2026-07-${String(version).padStart(2, '0')}T00:00:00.000Z`,
    signature: `signature-${version}`,
    domains: {
      [DOMAIN]: {
        endpoints: [
          {
            ip,
            provider: 'test',
            region: 'ALL',
            weight: 1,
          },
        ],
      },
    },
  };
}

function createService() {
  const ipTableDb = {
    getConfig: jest.fn(),
    commitSpeedTestResult: jest.fn(async () => 'applied'),
    updateLastBestIp: jest.fn(async () => undefined),
    updateSelection: jest.fn(async () => undefined),
  };
  const service = new ServiceIpTable({
    backgroundApi: { simpleDb: { ipTable: ipTableDb } },
  });
  return { service, ipTableDb };
}

describe('ServiceIpTable resilience', () => {
  const mockedSniRequest = sniRequest as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSniRequest.mockReset();
  });

  it.each([
    ['empty', null],
    ['invalid shape', '<html>captive portal</html>'],
  ])(
    'uses SNI fallback for an HTTP 200 %s CDN response',
    async (_name, data) => {
      const { service } = createService();
      const fallbackConfig = buildConfig('1.1.1.1');
      const fallbackSpy = jest
        .spyOn(service as any, 'fetchRemoteConfigViaSniFallback')
        .mockResolvedValue(fallbackConfig);
      const axiosGetSpy = jest.spyOn(axios, 'get').mockResolvedValue({
        data,
        headers: { 'content-type': 'application/json' },
      });

      await expect((service as any).fetchRemoteConfig()).resolves.toEqual(
        fallbackConfig,
      );
      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(axiosGetSpy).not.toHaveBeenCalled();
      fallbackSpy.mockRestore();
      axiosGetSpy.mockRestore();
    },
  );

  it('tries ordered SNI candidates before the canonical domain', async () => {
    const { service } = createService();
    const config = buildConfig('1.1.1.1');
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      config: createEffectiveIpTableConfig({
        rawConfig: config,
        source: 'signed-remote',
      }),
      rawSignedConfig: config,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: { [DOMAIN]: '1.1.1.1' },
      },
    });
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    });
    const axiosGetSpy = jest.spyOn(axios, 'get');

    await expect((service as any).fetchRemoteConfig()).resolves.toEqual(config);
    expect(mockedSniRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '1.1.1.1',
        hostname: 'config.onekeycn.com',
        timeout: 3000,
      }),
    );
    expect(axiosGetSpy).not.toHaveBeenCalled();
    axiosGetSpy.mockRestore();
  });

  it('shares one wall-clock deadline between candidate and canonical routes', async () => {
    const { service } = createService();
    const config = buildConfig('1.1.1.1');
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      config: createEffectiveIpTableConfig({
        rawConfig: config,
        source: 'signed-remote',
      }),
      runtime: undefined,
    });
    let now = 1000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockedSniRequest.mockImplementation(async () => {
      now += 2500;
      throw Object.assign(new Error('network unavailable'), {
        code: 'SNI_NETWORK_UNREACHABLE',
      });
    });
    const axiosGetSpy = jest.spyOn(axios, 'get').mockResolvedValue({
      data: JSON.stringify(config),
      headers: { 'content-type': 'application/json' },
    });

    await expect((service as any).fetchRemoteConfig()).resolves.toEqual(config);
    const canonicalTimeout = (
      axiosGetSpy.mock.calls[0]?.[1] as { timeout?: number } | undefined
    )?.timeout;
    expect(canonicalTimeout).toBeGreaterThan(0);
    expect(canonicalTimeout).toBeLessThan(10_000);
    expect(mockedSniRequest.mock.calls.length).toBeLessThanOrEqual(3);
    nowSpy.mockRestore();
    axiosGetSpy.mockRestore();
  });

  it('does not fall back to another route after a certificate failure', async () => {
    const { service } = createService();
    const config = buildConfig('1.1.1.1');
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      config: createEffectiveIpTableConfig({
        rawConfig: config,
        source: 'signed-remote',
      }),
      runtime: undefined,
    });
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('certificate rejected'), {
        code: 'SNI_CERT_FAILED',
      }),
    );
    const axiosGetSpy = jest.spyOn(axios, 'get');

    await expect((service as any).fetchRemoteConfig()).resolves.toBeNull();
    expect(axiosGetSpy).not.toHaveBeenCalled();
    axiosGetSpy.mockRestore();
  });

  it('discards and queues a rerun when the atomic commit sees a new signed config', async () => {
    const { service, ipTableDb } = createService();
    const originalConfig = buildConfig('1.1.1.1', 1);

    jest.spyOn(service as any, 'isIpTableEnabled').mockResolvedValue(true);
    jest
      .spyOn(service as any, 'testMultipleTimes')
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(20);
    jest.spyOn(service, 'getConfig').mockResolvedValueOnce({
      config: createEffectiveIpTableConfig({
        rawConfig: originalConfig,
        source: 'signed-remote',
      }),
      runtime: undefined,
    });
    ipTableDb.commitSpeedTestResult.mockResolvedValueOnce('stale_config');

    await (service as any).selectBestEndpointForDomainInternal(DOMAIN, {
      trigger: 'periodic',
    });

    expect(ipTableDb.updateLastBestIp).not.toHaveBeenCalled();
    expect(ipTableDb.updateSelection).not.toHaveBeenCalled();
    expect(ipTableDb.commitSpeedTestResult).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: DOMAIN,
        measuredEndpointIps: ['1.1.1.1'],
        lastBestIp: '1.1.1.1',
        selection: '1.1.1.1',
      }),
    );
    expect((service as any).pendingConfigChangeRerun.get(DOMAIN)).toBe(
      'periodic',
    );
  });

  it('starts the queued config-change rerun after the stale round settles', async () => {
    const { service } = createService();
    const internalSpy = jest
      .spyOn(service as any, 'selectBestEndpointForDomainInternal')
      .mockImplementationOnce(async () => {
        (service as any).pendingConfigChangeRerun.set(DOMAIN, 'ip_failure');
      })
      .mockResolvedValueOnce(undefined);

    await service.selectBestEndpointForDomain(DOMAIN, {
      trigger: 'ip_failure',
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    expect(internalSpy).toHaveBeenCalledTimes(2);
    expect(internalSpy).toHaveBeenNthCalledWith(2, DOMAIN, {
      trigger: 'ip_failure',
    });
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import type { IIpTableRemoteConfig } from '@onekeyhq/shared/src/request/types/ipTable';

import ServiceIpTable from './ServiceIpTable';

const mockAxiosGet = jest.fn();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

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
  createAxiosWithIpTable: jest.fn(() => ({ get: mockAxiosGet })),
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['empty', null],
    ['invalid shape', '<html>captive portal</html>'],
  ])(
    'uses SNI fallback for an HTTP 200 %s CDN response',
    async (_name, data) => {
      const { service } = createService();
      const fallbackConfig = buildConfig('1.1.1.1');
      mockAxiosGet.mockResolvedValueOnce({ data });
      const fallbackSpy = jest
        .spyOn(service as any, 'fetchRemoteConfigViaSniFallback')
        .mockResolvedValue(fallbackConfig);

      await expect((service as any).fetchRemoteConfig()).resolves.toEqual(
        fallbackConfig,
      );
      expect(fallbackSpy).toHaveBeenCalledTimes(1);
    },
  );

  it('discards and queues a rerun when the atomic commit sees a new signed config', async () => {
    const { service, ipTableDb } = createService();
    const originalConfig = buildConfig('1.1.1.1', 1);

    jest.spyOn(service as any, 'isIpTableEnabled').mockResolvedValue(true);
    jest
      .spyOn(service as any, 'testMultipleTimes')
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(20);
    jest.spyOn(service, 'getConfig').mockResolvedValueOnce({
      config: originalConfig,
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

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { recordAvailabilityOutcome } from '@onekeyhq/shared/src/request/availabilityAggregator';
import {
  testDomainSpeed,
  testIpSpeed,
} from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';
import { sniRequest } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import type { IIpTableRemoteConfig } from '@onekeyhq/shared/src/request/types/ipTable';
import { verifyIpTableConfigSignatureDetailed } from '@onekeyhq/shared/src/utils/ipTableUtils';

import ServiceIpTable from './ServiceIpTable';

const mockAxiosGet = jest.fn();

jest.mock('@onekeyhq/shared/src/request/availabilityAggregator', () => ({
  AVAILABILITY_SLOW_MS: 3000,
  recordAvailabilityOutcome: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/ipTableUtils', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/ipTableUtils')
  >('@onekeyhq/shared/src/utils/ipTableUtils'),
  isSupportIpTablePlatform: () => true,
  verifyIpTableConfigSignatureDetailed: jest.fn(),
}));

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
const mockedTestDomainSpeed = testDomainSpeed as jest.Mock;
const mockedTestIpSpeed = testIpSpeed as jest.Mock;

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
    saveConfig: jest.fn(async (): Promise<void> => undefined),
    getConfig: jest.fn(),
    commitSpeedTestResult: jest.fn(async () => 'applied'),
    updateLastBestIp: jest.fn(async () => undefined),
    updateSelection: jest.fn(async () => true),
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('broadcasts invalidation only after the replacement table is stored', async () => {
    const { service, ipTableDb } = createService();
    const emit = jest.spyOn(appEventBus, 'emit');
    const config = buildConfig('2.2.2.2');
    let finishWrite: (() => void) | undefined;
    ipTableDb.saveConfig.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );
    const saving = service.saveConfig(config);
    expect(emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.IpTableConfigChanged,
      undefined,
    );
    finishWrite?.();
    await saving;
    expect(ipTableDb.saveConfig).toHaveBeenCalledWith(config);
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.IpTableConfigChanged,
      undefined,
    );
  });

  it('does not broadcast invalidation when saving the table fails', async () => {
    const { service, ipTableDb } = createService();
    const emit = jest.spyOn(appEventBus, 'emit');
    ipTableDb.saveConfig.mockRejectedValueOnce(new Error('storage failed'));
    await expect(service.saveConfig(buildConfig('2.2.2.2'))).rejects.toThrow(
      'storage failed',
    );
    expect(emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.IpTableConfigChanged,
      undefined,
    );
  });

  it('broadcasts invalidation after applying a verified CDN table', async () => {
    const { service, ipTableDb } = createService();
    const emit = jest.spyOn(appEventBus, 'emit');
    const logError = jest.spyOn(defaultLogger.ipTable.request, 'error');
    const config = buildConfig('2.2.2.2', 2);
    const internal = service as unknown as {
      fetchRemoteConfig(): Promise<IIpTableRemoteConfig | null>;
    };
    jest.spyOn(internal, 'fetchRemoteConfig').mockResolvedValue(config);
    jest.mocked(verifyIpTableConfigSignatureDetailed).mockResolvedValueOnce({
      ok: true,
      recoveredAddress: '0x0000000000000000000000000000000000000001',
    });
    ipTableDb.getConfig.mockResolvedValue({ config: buildConfig('1.1.1.1') });
    const applied = await service.fetchAndApplyRemoteConfig();
    expect(logError).not.toHaveBeenCalled();
    expect(applied).toBe(true);
    expect(ipTableDb.saveConfig).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ payloadHash: expect.any(String) }),
    );
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.IpTableConfigChanged,
      undefined,
    );
  });

  it('does not announce a fast failover rejected by the current signed table', async () => {
    const { service, ipTableDb } = createService();
    const switched = jest.spyOn(
      defaultLogger.ipTable.metrics,
      'endpointSwitched',
    );
    const internal = service as unknown as {
      isIpTableEnabled(): Promise<boolean>;
      getDomainHealth(domain: string): { lastSpeedTestTime: number };
    };
    jest.spyOn(internal, 'isIpTableEnabled').mockResolvedValue(true);
    internal.getDomainHealth(DOMAIN).lastSpeedTestTime = Date.now();
    ipTableDb.getConfig.mockResolvedValue({
      config: buildConfig('1.1.1.1'),
      runtime: {
        enabled: true,
        selections: { [DOMAIN]: '' },
        lastBestIp: { [DOMAIN]: '1.1.1.1' },
      },
    });
    ipTableDb.updateSelection.mockResolvedValue(false);
    for (const sequence of [1, 2, 3]) {
      // eslint-disable-next-line no-await-in-loop
      await service.reportRequestFailure(
        DOMAIN,
        'domain',
        'wallet.onekeycn.com',
        sequence,
      );
    }
    expect(ipTableDb.updateSelection).toHaveBeenCalledWith(DOMAIN, '1.1.1.1');
    expect(switched).not.toHaveBeenCalled();
  });

  it('attributes config fallback attempts to endorsed IPs, including a failed first attempt', async () => {
    const { service, ipTableDb } = createService();
    const config = buildConfig('1.1.1.1');
    config.domains[DOMAIN].endpoints.push({
      ip: '2.2.2.2',
      provider: 'test',
      region: 'ALL',
      weight: 1,
    });
    ipTableDb.getConfig.mockResolvedValue({
      config,
      runtime: {
        selections: { [DOMAIN]: '203.0.113.1' },
        lastBestIp: { [DOMAIN]: '203.0.113.1' },
      },
    });
    jest
      .mocked(sniRequest)
      .mockRejectedValueOnce({ code: 'SNI_CERT_FAILED' })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: JSON.stringify(config),
      });
    const internal = service as unknown as {
      fetchRemoteConfigViaSniFallback(): Promise<IIpTableRemoteConfig | null>;
    };
    await expect(internal.fetchRemoteConfigViaSniFallback()).resolves.toEqual(
      config,
    );
    expect(
      jest.mocked(sniRequest).mock.calls.map(([request]) => request.ip),
    ).toEqual(['1.1.1.1', '2.2.2.2']);
    const outcomes = jest
      .mocked(recordAvailabilityOutcome)
      .mock.calls.map(([outcome]) => outcome);
    expect(outcomes.filter(({ source }) => source === 'api_ip')).toEqual([
      expect.objectContaining({ target: '1.1.1.1', status: 'failed' }),
      expect.objectContaining({ target: '2.2.2.2', status: 'ok' }),
    ]);
    expect(
      outcomes.find(({ source, failure }) => source === 'api' && failure)
        ?.failure?.ip,
    ).toBe('1.1.1.1');
  });

  it.each([
    ['malformed JSON', '{'],
    ['invalid shape', JSON.stringify({ domains: {} })],
    ['empty body', ''],
  ])(
    'rejects an HTTP 200 %s SNI body without counting success',
    async (_name, body) => {
      const { service, ipTableDb } = createService();
      const config = buildConfig('1.1.1.1');
      config.domains[DOMAIN].endpoints.push({
        ip: '2.2.2.2',
        provider: 'test',
        region: 'ALL',
        weight: 1,
      });
      ipTableDb.getConfig.mockResolvedValue({ config });
      jest
        .mocked(sniRequest)
        .mockResolvedValueOnce({ statusCode: 200, headers: {}, body })
        .mockResolvedValueOnce({
          statusCode: 200,
          headers: {},
          body: JSON.stringify(config),
        });
      const internal = service as unknown as {
        fetchRemoteConfigViaSniFallback(): Promise<IIpTableRemoteConfig | null>;
      };

      await expect(internal.fetchRemoteConfigViaSniFallback()).resolves.toEqual(
        config,
      );

      const outcomes = jest
        .mocked(recordAvailabilityOutcome)
        .mock.calls.map(([outcome]) => outcome);
      expect(outcomes.filter(({ source }) => source === 'api_ip')).toEqual([
        expect.objectContaining({ target: '1.1.1.1', status: 'error' }),
        expect.objectContaining({ target: '2.2.2.2', status: 'ok' }),
      ]);
      expect(outcomes.filter(({ source }) => source === 'api')).toEqual([
        expect.objectContaining({
          status: 'api_error',
          failure: expect.objectContaining({
            errorCode: 'invalid_response',
            ip: '1.1.1.1',
          }),
        }),
        expect.objectContaining({ status: 'ok' }),
      ]);
    },
  );

  it('rejects an HTTP error even when its SNI body has a valid config shape', async () => {
    const { service, ipTableDb } = createService();
    const config = buildConfig('1.1.1.1');
    ipTableDb.getConfig.mockResolvedValue({ config });
    jest.mocked(sniRequest).mockResolvedValueOnce({
      statusCode: 403,
      headers: {},
      body: JSON.stringify(config),
    });
    const internal = service as unknown as {
      fetchRemoteConfigViaSniFallback(): Promise<IIpTableRemoteConfig | null>;
    };

    await expect(
      internal.fetchRemoteConfigViaSniFallback(),
    ).resolves.toBeNull();
    expect(
      jest
        .mocked(recordAvailabilityOutcome)
        .mock.calls.map(([outcome]) => outcome)
        .filter(({ source }) => source === 'api_ip'),
    ).toEqual([
      expect.objectContaining({ target: '1.1.1.1', status: 'error' }),
    ]);
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

  it('scores API endpoints only with wallet health probes', async () => {
    const { service, ipTableDb } = createService();
    const config = buildConfig('1.1.1.1', 1);

    jest.spyOn(service as any, 'isIpTableEnabled').mockResolvedValue(true);
    const testMultipleTimesSpy = jest
      .spyOn(service as any, 'testMultipleTimes')
      .mockImplementation(async (...args: unknown[]) => {
        const testFn = args[0] as () => Promise<number>;
        return testFn();
      });
    jest.spyOn(service, 'getConfig').mockResolvedValue({
      config,
      runtime: undefined,
    });
    mockedTestDomainSpeed.mockResolvedValue(20);
    mockedTestIpSpeed.mockResolvedValue(25);

    await (service as any).selectBestEndpointForDomainInternal(DOMAIN, {
      trigger: 'periodic',
    });

    expect(testMultipleTimesSpy).toHaveBeenCalledTimes(2);
    expect(mockedTestDomainSpeed).toHaveBeenCalledTimes(1);
    expect(mockedTestIpSpeed).toHaveBeenCalledWith(
      '1.1.1.1',
      DOMAIN,
      expect.any(String),
      expect.any(Number),
    );
    expect(ipTableDb.commitSpeedTestResult).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: DOMAIN,
        lastBestIp: '1.1.1.1',
        selection: '',
      }),
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

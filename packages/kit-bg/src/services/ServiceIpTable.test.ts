import {
  testDomainSpeed,
  testIpSpeed,
} from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';
import type { IIpTableConfigWithRuntime } from '@onekeyhq/shared/src/request/types/ipTable';

import { devSettingsPersistAtom } from '../states/jotai/atoms';

import ServiceIpTable from './ServiceIpTable';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/request/constants/ipTableDefaults', () => ({
  IP_TABLE_INITIAL_SPEED_TEST_DELAY_MS: 0,
  IP_TABLE_PERFORMANCE_IMPROVEMENT_THRESHOLD: 0.3,
  IP_TABLE_SELECTED_IP_CACHE_MS: 1000,
  IP_TABLE_SNI_FAILURE_IN_MEMORY_QUARANTINE_MS: 10 * 1000,
  IP_TABLE_SNI_FAILURE_QUARANTINE_MS: 30 * 60 * 1000,
  IP_TABLE_SNI_QUARANTINE_FAILURE_THRESHOLD: 2,
  IP_TABLE_SNI_FAILURE_THRESHOLD: 10,
  IP_TABLE_SPEED_TEST_COOLDOWN_MS: 0,
  IP_TABLE_SPEED_TEST_DELAY_MS: 0,
  IP_TABLE_SPEED_TEST_ITERATIONS: 1,
  IP_TABLE_SPEED_TEST_TIMEOUT_MS: 3000,
}));

jest.mock('@onekeyhq/shared/src/request/helpers/ipTableAdapter', () => ({
  getSelectedIpForHost: jest.fn(),
  setReportRequestFailureCallback: jest.fn(),
  testDomainSpeed: jest.fn(),
  testIpSpeed: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/request/helpers/sniRequest', () => ({
  isSniSupported: jest.fn(() => true),
}));

jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  getRequestHeaders: jest.fn(async () => ({})),
}));

jest.mock('@onekeyhq/shared/src/utils/ipTableUtils', () => ({
  isSupportIpTablePlatform: jest.fn(() => true),
  mergeIpTableConfigs: jest.fn(),
  verifyIpTableConfigSignature: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
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

jest.mock('../states/jotai/atoms', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: true, settings: {} })),
  },
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    backgroundApi: unknown;
  },
}));

const testDomainSpeedMock = testDomainSpeed as jest.MockedFunction<
  typeof testDomainSpeed
>;
const testIpSpeedMock = testIpSpeed as jest.MockedFunction<typeof testIpSpeed>;
const devSettingsPersistAtomGetMock = devSettingsPersistAtom.get as jest.Mock;

const DOMAIN = 'onekeycn.com';
const BAD_IP = '216.19.4.106';
const GOOD_IP = '104.18.20.233';

function buildConfig(): IIpTableConfigWithRuntime {
  return {
    config: {
      version: 1,
      ttl_sec: 3600,
      generated_at: '2026-06-23T00:00:00.000Z',
      signature: 'test-signature',
      domains: {
        [DOMAIN]: {
          endpoints: [
            {
              ip: BAD_IP,
              provider: 'volcengine',
              region: 'CN',
              weight: 100,
            },
            {
              ip: GOOD_IP,
              provider: 'cloudflare',
              region: 'GLOBAL',
              weight: 100,
            },
          ],
        },
      },
    },
    runtime: {
      enabled: true,
      lastUpdated: 0,
      lastRegionCheck: 0,
      selections: {},
    },
  };
}

function buildService(config: IIpTableConfigWithRuntime = buildConfig()) {
  const backgroundApi = {
    simpleDb: {
      ipTable: {
        getConfig: jest.fn(async () => config),
        markIpQuarantined: jest.fn(async () => undefined),
        updateSelection: jest.fn(async () => undefined),
      },
    },
  };

  return {
    backgroundApi,
    service: new ServiceIpTable({ backgroundApi }),
  };
}

describe('ServiceIpTable IP quarantine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    devSettingsPersistAtomGetMock.mockResolvedValue({
      enabled: true,
      settings: {},
    });
    testDomainSpeedMock.mockResolvedValue(1000);
    testIpSpeedMock.mockImplementation(async (ip) => {
      if (ip === BAD_IP) {
        return 100;
      }
      return 200;
    });
  });

  it('keeps the original wallet-health selection flow when no IP is quarantined', async () => {
    const { backgroundApi, service } = buildService();

    await service.selectBestEndpointForDomain(DOMAIN);

    expect(testIpSpeedMock).toHaveBeenCalledWith(
      BAD_IP,
      DOMAIN,
      '/wallet/v1/health',
      3000,
    );
    expect(backgroundApi.simpleDb.ipTable.updateSelection).toHaveBeenCalledWith(
      DOMAIN,
      BAD_IP,
    );
  });

  it('skips active quarantined IPs during speed test', async () => {
    const config = buildConfig();
    config.runtime = {
      enabled: true,
      lastUpdated: 0,
      lastRegionCheck: 0,
      selections: {},
      quarantinedIps: {
        [DOMAIN]: {
          [BAD_IP]: {
            lastFailureTime: Date.now(),
            hostname: `utility.${DOMAIN}`,
            error: 'Request timeout',
          },
        },
      },
    };
    const { backgroundApi, service } = buildService(config);

    await service.selectBestEndpointForDomain(DOMAIN);

    expect(testIpSpeedMock).not.toHaveBeenCalledWith(
      BAD_IP,
      DOMAIN,
      '/wallet/v1/health',
      3000,
    );
    expect(backgroundApi.simpleDb.ipTable.updateSelection).toHaveBeenCalledWith(
      DOMAIN,
      GOOD_IP,
    );
  });

  it('quarantines a failed IP after consecutive SNI failures', async () => {
    const config = buildConfig();
    config.runtime = {
      enabled: true,
      lastUpdated: 0,
      lastRegionCheck: 0,
      selections: {
        [DOMAIN]: BAD_IP,
      },
    };
    const { backgroundApi, service } = buildService(config);
    const selectBestEndpointSpy = jest
      .spyOn(service, 'selectBestEndpointForDomain')
      .mockResolvedValue(undefined);

    await service.reportRequestFailure(DOMAIN, 'ip', BAD_IP, {
      hostname: `utility.${DOMAIN}`,
      error: 'Request timeout',
    });

    expect(
      backgroundApi.simpleDb.ipTable.markIpQuarantined,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.ipTable.updateSelection,
    ).not.toHaveBeenCalled();
    expect(selectBestEndpointSpy).not.toHaveBeenCalled();

    await service.reportRequestFailure(DOMAIN, 'ip', BAD_IP, {
      hostname: `utility.${DOMAIN}`,
      error: 'Request timeout',
    });

    expect(
      backgroundApi.simpleDb.ipTable.markIpQuarantined,
    ).toHaveBeenCalledWith(
      DOMAIN,
      BAD_IP,
      expect.objectContaining({
        hostname: `utility.${DOMAIN}`,
        error: 'Request timeout',
      }),
    );
    expect(backgroundApi.simpleDb.ipTable.updateSelection).toHaveBeenCalledWith(
      DOMAIN,
      '',
    );
    expect(selectBestEndpointSpy).toHaveBeenCalledWith(DOMAIN);
  });

  it('allows expired quarantined IPs to participate in speed test again', async () => {
    const config = buildConfig();
    config.runtime = {
      enabled: true,
      lastUpdated: 0,
      lastRegionCheck: 0,
      selections: {},
      quarantinedIps: {
        [DOMAIN]: {
          [BAD_IP]: {
            lastFailureTime: Date.now() - 31 * 60 * 1000,
            hostname: `utility.${DOMAIN}`,
            error: 'Request timeout',
          },
        },
      },
    };
    const { backgroundApi, service } = buildService(config);

    await service.selectBestEndpointForDomain(DOMAIN);

    expect(testIpSpeedMock).toHaveBeenCalledWith(
      BAD_IP,
      DOMAIN,
      '/wallet/v1/health',
      3000,
    );
    expect(backgroundApi.simpleDb.ipTable.updateSelection).toHaveBeenCalledWith(
      DOMAIN,
      BAD_IP,
    );
  });
});

import { DEFAULT_IP_TABLE_CONFIG } from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
import type { IIpTableRemoteConfig } from '@onekeyhq/shared/src/request/types/ipTable';
import { computeIpTableConfigHash } from '@onekeyhq/shared/src/utils/ipTableUtils';

import {
  type ISimpleDbIpTableData,
  SimpleDbEntityIpTable,
} from './SimpleDbEntityIpTable';

const DOMAIN = 'onekeycn.com';

function buildConfig(ip: string): IIpTableRemoteConfig {
  return {
    version: 1,
    ttl_sec: 300,
    generated_at: '2026-07-21T00:00:00.000Z',
    signature: `signature-${ip}`,
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

function setupEntity(initial: ISimpleDbIpTableData) {
  const entity = new SimpleDbEntityIpTable();
  let store = initial;
  jest.spyOn(entity, 'getRawData').mockImplementation(async () => store);
  jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
    store =
      typeof builder === 'function'
        ? await builder(store)
        : (builder as ISimpleDbIpTableData);
    return store;
  });
  return { entity, getStore: () => store };
}

describe('SimpleDbEntityIpTable speed-test commit', () => {
  it('rejects a stale result inside the same setRawData critical section', async () => {
    const originalConfig = buildConfig('1.1.1.1');
    const replacementConfig = buildConfig('2.2.2.2');
    const initial: ISimpleDbIpTableData = {
      config: replacementConfig,
      runtime: {
        enabled: true,
        lastUpdated: 1,
        lastRegionCheck: 0,
        selections: {},
      },
    };
    const { entity, getStore } = setupEntity(initial);

    await expect(
      entity.commitSpeedTestResult({
        domain: DOMAIN,
        expectedConfigHash: computeIpTableConfigHash(originalConfig),
        measuredEndpointIps: ['1.1.1.1'],
        lastBestIp: '1.1.1.1',
        selection: '1.1.1.1',
      }),
    ).resolves.toBe('stale_config');

    expect(getStore()).toBe(initial);
  });

  it('atomically writes last-best and selection for the current config', async () => {
    const config = buildConfig('1.1.1.1');
    const { entity, getStore } = setupEntity({ config });

    await expect(
      entity.commitSpeedTestResult({
        domain: DOMAIN,
        expectedConfigHash: computeIpTableConfigHash(config),
        measuredEndpointIps: ['1.1.1.1'],
        lastBestIp: '1.1.1.1',
        selection: '1.1.1.1',
      }),
    ).resolves.toBe('applied');

    expect(getStore().runtime?.lastBestIp?.[DOMAIN]).toBe('1.1.1.1');
    expect(getStore().runtime?.selections[DOMAIN]).toBe('1.1.1.1');
  });

  it('rejects a candidate outside the current endpoint set even when the hash matches', async () => {
    const config = buildConfig('2.2.2.2');
    const initial: ISimpleDbIpTableData = { config };
    const { entity, getStore } = setupEntity(initial);

    await expect(
      entity.commitSpeedTestResult({
        domain: DOMAIN,
        expectedConfigHash: computeIpTableConfigHash(config),
        measuredEndpointIps: ['1.1.1.1'],
        lastBestIp: '1.1.1.1',
      }),
    ).resolves.toBe('stale_config');

    expect(getStore()).toBe(initial);
  });
});

describe('SimpleDbEntityIpTable signed storage boundary', () => {
  const bundledGeneratedAt = Date.parse(DEFAULT_IP_TABLE_CONFIG.generated_at);
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(bundledGeneratedAt + 1000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('re-verifies the verbatim raw envelope and recomputes the effective view', async () => {
    const { entity } = setupEntity({
      rawConfig: DEFAULT_IP_TABLE_CONFIG,
      effectiveConfig: {
        version: 999,
        ttl_sec: 300,
        generated_at: DEFAULT_IP_TABLE_CONFIG.generated_at,
        domains: {},
        source: 'signed-remote',
        sourcePayloadHash: 'tampered',
      },
      highestAccepted: {
        version: DEFAULT_IP_TABLE_CONFIG.version,
        generatedAt: DEFAULT_IP_TABLE_CONFIG.generated_at,
      },
    });

    await expect(entity.getConfig()).resolves.toMatchObject({
      rawSignedConfig: DEFAULT_IP_TABLE_CONFIG,
      config: {
        version: DEFAULT_IP_TABLE_CONFIG.version,
        domains: DEFAULT_IP_TABLE_CONFIG.domains,
        source: 'signed-remote',
        sourcePayloadHash: computeIpTableConfigHash(DEFAULT_IP_TABLE_CONFIG),
      },
    });
  });

  it('fails closed to the bundled view when persisted raw data is tampered', async () => {
    const { entity } = setupEntity({
      rawConfig: {
        ...DEFAULT_IP_TABLE_CONFIG,
        domains: {
          ...DEFAULT_IP_TABLE_CONFIG.domains,
          'evil.example': {
            endpoints: [
              {
                ip: '1.1.1.1',
                provider: 'tampered',
                region: 'ALL',
                weight: 1,
              },
            ],
          },
        },
      },
    });

    const result = await entity.getConfig();
    expect(result.rawSignedConfig).toBeUndefined();
    expect(result.config.source).toBe('bundled');
    expect(result.config.domains).not.toHaveProperty('evil.example');
  });

  it('rejects replay below the highest accepted version on disk load', async () => {
    const { entity } = setupEntity({
      rawConfig: DEFAULT_IP_TABLE_CONFIG,
      highestAccepted: {
        version: DEFAULT_IP_TABLE_CONFIG.version + 1,
        generatedAt: DEFAULT_IP_TABLE_CONFIG.generated_at,
      },
    });

    const result = await entity.getConfig();
    expect(result).toMatchObject({
      config: { source: 'bundled' },
    });
    expect(result.rawSignedConfig).toBeUndefined();
  });

  it('persists raw and effective data separately and preserves the replay anchor on reset', async () => {
    const { entity, getStore } = setupEntity({});

    await entity.saveConfig(DEFAULT_IP_TABLE_CONFIG, {
      payloadHash: computeIpTableConfigHash(DEFAULT_IP_TABLE_CONFIG),
    });
    expect(getStore()).toMatchObject({
      rawConfig: DEFAULT_IP_TABLE_CONFIG,
      effectiveConfig: {
        source: 'signed-remote',
        sourcePayloadHash: computeIpTableConfigHash(DEFAULT_IP_TABLE_CONFIG),
      },
      highestAccepted: {
        version: DEFAULT_IP_TABLE_CONFIG.version,
        generatedAt: DEFAULT_IP_TABLE_CONFIG.generated_at,
      },
      version: 2,
    });
    expect(getStore().config).toBeUndefined();

    await entity.clearAll();
    expect(getStore()).toMatchObject({
      rawConfig: null,
      effectiveConfig: null,
      highestAccepted: {
        version: DEFAULT_IP_TABLE_CONFIG.version,
        generatedAt: DEFAULT_IP_TABLE_CONFIG.generated_at,
      },
      version: 2,
    });
  });
});

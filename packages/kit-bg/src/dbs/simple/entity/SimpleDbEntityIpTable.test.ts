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
  it('replaces the remote table and removes both revoked runtime references', async () => {
    const oldConfig = buildConfig('1.1.1.1');
    const replacement = buildConfig('2.2.2.2');
    const { entity, getStore } = setupEntity({
      config: oldConfig,
      runtime: {
        enabled: true,
        lastUpdated: 1,
        lastRegionCheck: 0,
        selections: { [DOMAIN]: '1.1.1.1' },
        lastBestIp: { [DOMAIN]: '1.1.1.1' },
      },
    });
    await entity.saveConfig(replacement);
    expect(getStore().config).toBe(replacement);
    expect(getStore().runtime?.selections).toEqual({});
    expect(getStore().runtime?.lastBestIp).toEqual({});

    const saved = getStore();
    // Simulate callbacks that captured the old IP before the replacement.
    await expect(entity.updateSelection(DOMAIN, '1.1.1.1')).resolves.toBe(
      false,
    );
    await expect(entity.updateLastBestIp(DOMAIN, '1.1.1.1')).resolves.toBe(
      false,
    );
    expect(getStore()).toBe(saved);
  });

  it('accepts current endpoints and the explicit domain choice', async () => {
    const { entity, getStore } = setupEntity({
      config: buildConfig('2.2.2.2'),
    });
    await expect(entity.updateSelection(DOMAIN, '2.2.2.2')).resolves.toBe(true);
    await expect(entity.updateLastBestIp(DOMAIN, '2.2.2.2')).resolves.toBe(
      true,
    );
    expect(getStore().runtime?.lastBestIp?.[DOMAIN]).toBe('2.2.2.2');
    await expect(entity.updateSelection(DOMAIN, '')).resolves.toBe(true);
    expect(getStore().runtime?.selections[DOMAIN]).toBe('');
  });

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

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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

function setupPersistedEntity(
  initial: ISimpleDbIpTableData,
  setItem: SimpleDbEntityIpTable['appStorage']['setItem'],
) {
  const entity = new SimpleDbEntityIpTable();
  entity.appStorage = {
    ...entity.appStorage,
    getItem: jest.fn(async () =>
      JSON.stringify({ data: initial, updatedAt: 1 }),
    ),
    setItem,
  };
  return entity;
}

describe('SimpleDbEntityIpTable routing invalidation', () => {
  const config = buildConfig('1.1.1.1');
  const mutations: Array<
    [string, (entity: SimpleDbEntityIpTable) => Promise<unknown>]
  > = [
    ['config', (entity) => entity.saveConfig(config)],
    ['selection', (entity) => entity.updateSelection(DOMAIN, '1.1.1.1')],
    ['last-best', (entity) => entity.updateLastBestIp(DOMAIN, '1.1.1.1')],
    [
      'speed-test result',
      (entity) =>
        entity.commitSpeedTestResult({
          domain: DOMAIN,
          expectedConfigHash: computeIpTableConfigHash(config),
          measuredEndpointIps: ['1.1.1.1'],
          lastBestIp: '1.1.1.1',
          selection: '1.1.1.1',
        }),
    ],
    ['enable switch', (entity) => entity.setEnabled(false)],
    ['reset', (entity) => entity.clearAll()],
    ['restore', (entity) => entity.saveStorageData({ config })],
    ['raw state', (entity) => entity.setRawData({ config })],
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(mutations)(
    'broadcasts %s only after storage accepts the write',
    async (_label, mutate) => {
      let finishWrite!: () => void;
      let signalStarted!: () => void;
      const writeFinished = new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
      const writeStarted = new Promise<void>((resolve) => {
        signalStarted = resolve;
      });
      const setItem = jest.fn(async () => {
        signalStarted();
        await writeFinished;
      });
      const entity = setupPersistedEntity({ config }, setItem);
      const emit = jest.spyOn(appEventBus, 'emit');
      const pending = mutate(entity);
      await writeStarted;
      expect(emit).not.toHaveBeenCalledWith(
        EAppEventBusNames.IpTableConfigChanged,
        undefined,
      );
      finishWrite();
      await pending;
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(
        EAppEventBusNames.IpTableConfigChanged,
        undefined,
      );
    },
  );

  it('does not broadcast a rejected endpoint or stale speed-test result', async () => {
    const setItem = jest.fn(async () => undefined);
    const entity = setupPersistedEntity({ config }, setItem);
    const emit = jest.spyOn(appEventBus, 'emit');
    await expect(entity.updateSelection(DOMAIN, '2.2.2.2')).resolves.toBe(
      false,
    );
    await expect(
      entity.commitSpeedTestResult({
        domain: DOMAIN,
        expectedConfigHash: computeIpTableConfigHash(buildConfig('2.2.2.2')),
        measuredEndpointIps: ['1.1.1.1'],
        selection: '1.1.1.1',
      }),
    ).resolves.toBe('stale_config');
    expect(setItem).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not broadcast a failed storage write', async () => {
    const setItem = jest.fn(async () => {
      throw new OneKeyLocalError('storage failed');
    });
    const entity = setupPersistedEntity({ config }, setItem);
    const emit = jest.spyOn(appEventBus, 'emit');
    await expect(entity.setEnabled(false)).rejects.toThrow('storage failed');
    expect(emit).not.toHaveBeenCalled();
  });
});

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

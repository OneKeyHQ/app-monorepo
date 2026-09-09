/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import ServiceNetwork from './ServiceNetwork';

// p-limit ships ESM-only which the jest transform allowlist does not cover;
// these tests never exercise the concurrency-limited paths.
jest.mock('p-limit', () => ({
  __esModule: true,
  default:
    () =>
    (fn: any, ...args: any[]) =>
      fn(...args),
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  toastIfError: () => (_t: any, _k: string, desc: any) => desc,
  checkDevOnlyPassword: jest.fn(),
}));

const cacheTtlMs = timerUtils.getTimeDurationMs({ hour: 1 });

const SERVER_CONFIG = {
  version: 2,
  byNetworkId: { 'evm--1': 90, 'evm--56': 5 },
  byImpl: {},
  standardByNetworkId: { 'evm--1': 'ERC20' },
};

type IRawData = {
  config?: typeof SERVER_CONFIG;
  syncedAt?: number;
} | null;

function buildService({
  rawData,
  fetchImpl,
}: {
  rawData: IRawData;
  fetchImpl?: () => Promise<any>;
}) {
  let stored: IRawData = rawData;
  const service = new ServiceNetwork({
    backgroundApi: {
      simpleDb: {
        receiveArrivalConfig: {
          getRawData: jest.fn(async () => stored),
          setRawData: jest.fn(async (updater: any) => {
            stored = typeof updater === 'function' ? updater(stored) : updater;
          }),
        },
      },
    },
  });
  const getMock = jest.fn(
    fetchImpl ?? (async () => ({ data: { data: SERVER_CONFIG } })),
  );
  (service as any).getClient = jest.fn(async () => ({ get: getMock }));
  return { service, getMock, getStored: () => stored };
}

async function flushBackgroundRefresh(service: ServiceNetwork) {
  await (service as any)._fetchReceiveArrivalConfigPromise;
}

describe('ServiceNetwork.getReceiveArrivalConfig', () => {
  it('fetches and caches the config when nothing is cached', async () => {
    const { service, getMock, getStored } = buildService({ rawData: null });

    const result = await service.getReceiveArrivalConfig();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith(
      '/wallet/v1/network/receive-arrival-config',
    );
    expect(result).toEqual(SERVER_CONFIG);
    expect(getStored()?.config).toEqual(SERVER_CONFIG);
    expect(typeof getStored()?.syncedAt).toBe('number');
  });

  it('returns the fresh cache without fetching', async () => {
    const { service, getMock } = buildService({
      rawData: { config: SERVER_CONFIG, syncedAt: Date.now() },
    });

    const result = await service.getReceiveArrivalConfig();

    expect(getMock).not.toHaveBeenCalled();
    expect(result).toEqual(SERVER_CONFIG);
  });

  it('returns the stale cache immediately and refreshes in background', async () => {
    const staleConfig = { ...SERVER_CONFIG, version: 1 };
    const { service, getMock, getStored } = buildService({
      rawData: {
        config: staleConfig,
        syncedAt: Date.now() - cacheTtlMs - 1,
      },
    });

    const result = await service.getReceiveArrivalConfig();

    // stale copy is served without waiting for the network
    expect(result).toEqual(staleConfig);

    await flushBackgroundRefresh(service);
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getStored()?.config).toEqual(SERVER_CONFIG);
  });

  it('returns undefined without throwing when fetch fails and nothing is cached', async () => {
    const { service, getStored } = buildService({
      rawData: null,
      fetchImpl: async () => {
        throw new OneKeyLocalError('network down');
      },
    });

    await expect(service.getReceiveArrivalConfig()).resolves.toBeUndefined();
    expect(getStored()).toBeNull();
  });

  it('keeps the stale cache when the background refresh fails', async () => {
    const staleConfig = { ...SERVER_CONFIG, version: 1 };
    const staleSyncedAt = Date.now() - cacheTtlMs - 1;
    const { service, getStored } = buildService({
      rawData: { config: staleConfig, syncedAt: staleSyncedAt },
      fetchImpl: async () => {
        throw new OneKeyLocalError('network down');
      },
    });

    const result = await service.getReceiveArrivalConfig();

    expect(result).toEqual(staleConfig);
    await flushBackgroundRefresh(service);
    expect(getStored()).toEqual({
      config: staleConfig,
      syncedAt: staleSyncedAt,
    });
  });

  it('ignores a malformed response without caching it', async () => {
    const { service, getStored } = buildService({
      rawData: null,
      fetchImpl: async () => ({ data: { data: null } }),
    });

    await expect(service.getReceiveArrivalConfig()).resolves.toBeUndefined();
    expect(getStored()).toBeNull();
  });

  it('dedupes concurrent fetches into a single request', async () => {
    const { service, getMock } = buildService({ rawData: null });

    const [a, b] = await Promise.all([
      service.getReceiveArrivalConfig(),
      service.getReceiveArrivalConfig(),
    ]);

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(SERVER_CONFIG);
    expect(b).toEqual(SERVER_CONFIG);
  });
});

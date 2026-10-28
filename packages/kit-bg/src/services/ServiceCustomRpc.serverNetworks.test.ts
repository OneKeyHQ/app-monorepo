/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  toastIfError: () => (_t: any, _k: string, desc: any) => desc,
  checkDevOnlyPassword: jest.fn(),
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }

    // Replaced per test via jest.spyOn.
    async getClient(): Promise<any> {
      return undefined;
    }
  },
}));

jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));

// eslint-disable-next-line import-js/order, import/first
import { ENetworkStatus, type IServerNetwork } from '@onekeyhq/shared/types';

// eslint-disable-next-line import-js/order, import/first
import ServiceCustomRpc from './ServiceCustomRpc';

// Server-delivered network that is not part of presetNetworks.
const robinhood = {
  id: 'evm--4663',
  status: ENetworkStatus.LISTED,
} as IServerNetwork;

const zcashDelisted = {
  id: 'zec--0',
  status: ENetworkStatus.TRASH,
} as IServerNetwork;

function buildService({
  cachedNetworks,
  lastFetchTime,
  serverNetworks,
  cachedDelistedPresetNetworkIds = [],
}: {
  cachedNetworks: IServerNetwork[];
  lastFetchTime: number | undefined;
  serverNetworks: IServerNetwork[];
  cachedDelistedPresetNetworkIds?: string[];
}) {
  const clearConfigSyncMeta = jest.fn(async () => undefined);
  const upsertServerNetworks = jest.fn(async () => undefined);
  const service = new ServiceCustomRpc({
    backgroundApi: {
      simpleDb: {
        serverNetwork: {
          getAllServerNetworks: jest.fn(async () => ({
            networks: cachedNetworks,
            lastFetchTime,
            delistedPresetNetworkIds: cachedDelistedPresetNetworkIds,
          })),
          upsertServerNetworks,
        },
        customNetwork: {
          getAllCustomNetworks: jest.fn(async () => []),
        },
        aggregateToken: { clearConfigSyncMeta },
      },
      serviceNetwork: {
        clearAllNetworksCache: jest.fn(async () => undefined),
      },
    },
  } as any);
  const get = jest.fn(async () => ({ data: { data: serverNetworks } }));
  jest
    .spyOn(service as any, 'getClient')
    .mockImplementation(async () => ({ get }));
  return { service, get, clearConfigSyncMeta, upsertServerNetworks };
}

describe('ServiceCustomRpc server networks', () => {
  it('ensureServerNetworksFetched fetches when the cache was never filled', async () => {
    const { service, get, upsertServerNetworks } = buildService({
      cachedNetworks: [],
      lastFetchTime: undefined,
      serverNetworks: [robinhood],
    });

    await service.ensureServerNetworksFetched();

    expect(get).toHaveBeenCalledTimes(1);
    expect(upsertServerNetworks).toHaveBeenCalledWith({
      networkInfos: [robinhood],
      delistedPresetNetworkIds: [],
    });
  });

  it('ensureServerNetworksFetched skips the request once the cache is filled', async () => {
    const { service, get } = buildService({
      cachedNetworks: [robinhood],
      lastFetchTime: Date.now(),
      serverNetworks: [robinhood],
    });

    await service.ensureServerNetworksFetched();

    expect(get).not.toHaveBeenCalled();
  });

  it('ensureServerNetworksFetched swallows fetch failures', async () => {
    const { service, get } = buildService({
      cachedNetworks: [],
      lastFetchTime: undefined,
      serverNetworks: [],
    });
    get.mockRejectedValueOnce(new Error('offline'));

    await expect(
      service.ensureServerNetworksFetched(),
    ).resolves.toBeUndefined();
  });

  it('isServerNetworkRegistryFilled reflects whether the cache was ever filled', async () => {
    const unfilled = buildService({
      cachedNetworks: [],
      lastFetchTime: undefined,
      serverNetworks: [],
    });
    await expect(
      unfilled.service.isServerNetworkRegistryFilled(),
    ).resolves.toBe(false);

    // Filled but holding no server networks is still authoritative.
    const filledEmpty = buildService({
      cachedNetworks: [],
      lastFetchTime: Date.now(),
      serverNetworks: [],
    });
    await expect(
      filledEmpty.service.isServerNetworkRegistryFilled(),
    ).resolves.toBe(true);
  });

  it('isServerNetworkRegistryFilled propagates storage read failures', async () => {
    // getServerNetworks swallows these and returns []; the probe must not,
    // so gating callers can fail open instead of filtering against nothing.
    const { service } = buildService({
      cachedNetworks: [robinhood],
      lastFetchTime: Date.now(),
      serverNetworks: [],
    });
    (
      service as any
    ).backgroundApi.simpleDb.serverNetwork.getAllServerNetworks.mockRejectedValueOnce(
      new Error('storage read failed'),
    );

    await expect(service.isServerNetworkRegistryFilled()).rejects.toThrow(
      'storage read failed',
    );
  });

  it('fetchNetworkFromServer shares one in-flight request', async () => {
    const { service, get } = buildService({
      cachedNetworks: [],
      lastFetchTime: undefined,
      serverNetworks: [robinhood],
    });

    await Promise.all([
      service.fetchNetworkFromServer(),
      service.fetchNetworkFromServer(),
    ]);
    await service.fetchNetworkFromServer();

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('invalidates the wallet config only when the server-network set changed', async () => {
    const changed = buildService({
      cachedNetworks: [],
      lastFetchTime: undefined,
      serverNetworks: [robinhood],
    });
    await changed.service.fetchNetworkFromServer();
    expect(changed.clearConfigSyncMeta).toHaveBeenCalledTimes(1);

    const unchanged = buildService({
      cachedNetworks: [robinhood],
      lastFetchTime: Date.now(),
      serverNetworks: [robinhood],
    });
    await unchanged.service.fetchNetworkFromServer();
    expect(unchanged.clearConfigSyncMeta).not.toHaveBeenCalled();
  });
  it('stores a TRASH preset entry as delisted and never as a server network', async () => {
    const { service, upsertServerNetworks, clearConfigSyncMeta } = buildService(
      {
        cachedNetworks: [robinhood],
        lastFetchTime: Date.now(),
        serverNetworks: [robinhood, zcashDelisted],
      },
    );

    await service.fetchNetworkFromServer();

    expect(upsertServerNetworks).toHaveBeenCalledWith({
      networkInfos: [robinhood],
      delistedPresetNetworkIds: ['zec--0'],
    });
    // Reuses the "network list changed" refresh.
    expect(clearConfigSyncMeta).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['LISTED', [{ ...zcashDelisted, status: ENetworkStatus.LISTED }]],
    ['absent', [] as IServerNetwork[]],
  ])(
    'lists a delisted preset again when its entry is %s',
    async (_label, presetEntries) => {
      const { service, upsertServerNetworks, clearConfigSyncMeta } =
        buildService({
          cachedNetworks: [robinhood],
          lastFetchTime: Date.now(),
          serverNetworks: [robinhood, ...presetEntries],
          cachedDelistedPresetNetworkIds: ['zec--0'],
        });

      await service.fetchNetworkFromServer();

      expect(upsertServerNetworks).toHaveBeenCalledWith({
        networkInfos: [robinhood],
        delistedPresetNetworkIds: [],
      });
      expect(clearConfigSyncMeta).toHaveBeenCalledTimes(1);
    },
  );

  it('does not refresh when the delisted presets are unchanged', async () => {
    const { service, clearConfigSyncMeta } = buildService({
      cachedNetworks: [robinhood],
      lastFetchTime: Date.now(),
      serverNetworks: [robinhood, zcashDelisted],
      cachedDelistedPresetNetworkIds: ['zec--0'],
    });

    await service.fetchNetworkFromServer();

    expect(clearConfigSyncMeta).not.toHaveBeenCalled();
  });

  it('never adds an unknown non-EVM server entry as a network', async () => {
    const unknownChain = {
      id: 'starknet--0x534e',
      status: ENetworkStatus.LISTED,
    } as IServerNetwork;
    const { service, upsertServerNetworks } = buildService({
      cachedNetworks: [],
      lastFetchTime: undefined,
      serverNetworks: [robinhood, unknownChain],
    });

    await service.fetchNetworkFromServer();

    expect(upsertServerNetworks).toHaveBeenCalledWith({
      networkInfos: [robinhood],
      delistedPresetNetworkIds: [],
    });
  });

  it('getServerNetworkState returns the stored delisted presets', async () => {
    const { service } = buildService({
      cachedNetworks: [robinhood],
      lastFetchTime: Date.now(),
      serverNetworks: [],
      cachedDelistedPresetNetworkIds: ['xmr--0'],
    });

    await expect(service.getServerNetworkState()).resolves.toEqual({
      networks: [robinhood],
      delistedPresetNetworkIds: ['xmr--0'],
    });
  });
});

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

function buildService({
  cachedNetworks,
  lastFetchTime,
  serverNetworks,
}: {
  cachedNetworks: IServerNetwork[];
  lastFetchTime: number | undefined;
  serverNetworks: IServerNetwork[];
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
});

import { ENetworkStatus } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import ServiceNetwork from './ServiceNetwork';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

const robinhood = {
  id: 'evm--4663',
  impl: 'evm',
  status: ENetworkStatus.LISTED,
} as IServerNetwork;

function buildService({
  serverNetworks = [robinhood],
  delistedPresetNetworkIds = [],
}: {
  serverNetworks?: IServerNetwork[];
  delistedPresetNetworkIds?: string[];
}) {
  return new ServiceNetwork({
    backgroundApi: {
      serviceCustomRpc: {
        getServerNetworkState: jest.fn(async () => ({
          networks: serverNetworks,
          delistedPresetNetworkIds,
        })),
        getAllCustomNetworks: jest.fn(async () => []),
      },
    },
  });
}

async function listNetworkIds(service: ServiceNetwork) {
  const { networks } = await service.getAllNetworks({ clearCache: true });
  return networks.map((network) => network.id);
}

describe('ServiceNetwork.getAllNetworks with server-delisted presets', () => {
  it('keeps every preset when the server delists none', async () => {
    const ids = await listNetworkIds(buildService({}));

    expect(ids).toEqual(
      expect.arrayContaining(['zec--0', 'xmr--0', 'btc--0', robinhood.id]),
    );
  });

  it('hides a preset the server marks TRASH, like a delisted EVM network', async () => {
    const ids = await listNetworkIds(
      buildService({
        serverNetworks: [
          robinhood,
          { ...robinhood, id: 'evm--999999', status: ENetworkStatus.TRASH },
        ],
        delistedPresetNetworkIds: ['zec--0'],
      }),
    );

    expect(ids).not.toContain('zec--0');
    expect(ids).not.toContain('evm--999999');
    expect(ids).toEqual(expect.arrayContaining(['xmr--0', robinhood.id]));
  });
});

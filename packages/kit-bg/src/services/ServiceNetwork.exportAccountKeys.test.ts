jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('p-limit', () => () => (fn: () => unknown) => fn());

// eslint-disable-next-line import-js/order, import/first
import type { IServerNetwork } from '@onekeyhq/shared/types';

// eslint-disable-next-line import-js/order, import/first
import ServiceNetwork from './ServiceNetwork/ServiceNetwork';

const btcNetwork = { id: 'btc--0' } as IServerNetwork;
const neuraiNetwork = { id: 'neurai--0' } as IServerNetwork;

describe('ServiceNetwork export account key networks', () => {
  it('filters exportable networks by the current hardware wallet compatibility', async () => {
    const service = new ServiceNetwork({ backgroundApi: {} });
    jest
      .spyOn(service, 'getSupportExportPublicKeyNetworks')
      .mockResolvedValue([{ network: btcNetwork }, { network: neuraiNetwork }]);
    const getCompatibleNetworks = jest
      .spyOn(service, 'getNetworkIdsCompatibleWithWalletId')
      .mockResolvedValue({
        networkIdsCompatible: [btcNetwork.id],
        networkIdsIncompatible: [neuraiNetwork.id],
      });

    await expect(
      service.getSupportExportAccountKeyNetworks({
        exportType: 'publicKey',
        walletId: 'hw-pro2-wallet',
      }),
    ).resolves.toEqual([{ network: btcNetwork }]);
    expect(getCompatibleNetworks).toHaveBeenCalledWith({
      walletId: 'hw-pro2-wallet',
      networkIds: [btcNetwork.id, neuraiNetwork.id],
    });
  });

  it('keeps the existing exportable network list when wallet context is absent', async () => {
    const service = new ServiceNetwork({ backgroundApi: {} });
    jest
      .spyOn(service, 'getSupportExportPublicKeyNetworks')
      .mockResolvedValue([{ network: btcNetwork }, { network: neuraiNetwork }]);
    const getCompatibleNetworks = jest.spyOn(
      service,
      'getNetworkIdsCompatibleWithWalletId',
    );

    await expect(
      service.getSupportExportAccountKeyNetworks({ exportType: 'publicKey' }),
    ).resolves.toEqual([{ network: btcNetwork }, { network: neuraiNetwork }]);
    expect(getCompatibleNetworks).not.toHaveBeenCalled();
  });
});

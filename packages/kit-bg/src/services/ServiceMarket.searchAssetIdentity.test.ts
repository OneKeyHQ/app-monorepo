import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import ServiceMarket from './ServiceMarket';

const mockGet = jest.fn();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    async getClient() {
      return { get: mockGet };
    }
  },
}));

const token: IMarketSearchV2Token = {
  name: 'Ethereum',
  symbol: 'ETH',
  price: '2000',
  address: '',
  network: 'evm--1',
  logoUrl: '',
  isNative: true,
  decimals: 18,
  liquidity: '0',
  volume_24h: '0',
};

it.each(['search', 'trending'] as const)(
  '%s preserves backend asset identities without inferring missing ones',
  async (entry) => {
    const service = new ServiceMarket({ backgroundApi: {} });
    const tokens = [
      { ...token, assetId: 'eth' },
      { ...token, network: 'evm--8453' },
      {
        ...token,
        symbol: 'USDC',
        address: '0xusdc',
        isNative: false,
        assetId: 'usdc',
      },
    ];
    mockGet.mockReset();
    mockGet.mockImplementation(async (path: string) => {
      if (path !== `/utility/v2/market/${entry}`)
        throw new OneKeyLocalError('asset metadata unavailable');
      return { data: { data: tokens } };
    });
    const assetList = jest
      .spyOn(service, 'fetchMarketAssetList')
      .mockRejectedValue(new Error('offline'));
    const assetDetail = jest
      .spyOn(service, 'fetchMarketAssetDetail')
      .mockRejectedValue(new Error('offline'));
    const result =
      entry === 'search'
        ? await service.searchV2Token('ETH')
        : await service.fetchTrendingV2();
    expect(result).toEqual(tokens);
    expect(assetList).not.toHaveBeenCalled();
    expect(assetDetail).not.toHaveBeenCalled();
  },
);

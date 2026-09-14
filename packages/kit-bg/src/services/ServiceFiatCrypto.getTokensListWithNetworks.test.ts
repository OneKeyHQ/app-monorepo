import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import ServiceFiatCrypto from './ServiceFiatCrypto';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  checkDevOnlyPassword: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    fiatCrypto: {
      request: {
        getTokensList: jest.fn(),
      },
    },
  },
}));

function createToken(
  networkId: string,
  symbol: string,
  address = '',
): IFiatCryptoToken {
  return {
    address,
    name: symbol,
    symbol,
    networkId,
    icon: `https://img.test/${symbol}.png`,
  };
}

function createNetwork(id: string, name: string): IServerNetwork {
  return {
    id,
    name,
    logoURI: `https://img.test/${id}.png`,
  } as IServerNetwork;
}

describe('ServiceFiatCrypto.getTokensListWithNetworks', () => {
  const btcNetwork = createNetwork('btc--0', 'Bitcoin');
  const evmNetwork = createNetwork('evm--1', 'Ethereum');

  const getNetworksByIds = jest.fn<
    Promise<{ networks: IServerNetwork[] }>,
    [{ networkIds: string[] }]
  >();
  const getVaultSettings = jest.fn<
    Promise<{ mergeDeriveAssetsEnabled?: boolean }>,
    [{ networkId: string }]
  >();
  const getNetworkIdsCompatibleWithWalletId = jest.fn<
    Promise<{ networkIdsIncompatible: string[] }>,
    [{ walletId: string }]
  >();

  function createService() {
    const service = new ServiceFiatCrypto({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds,
          getVaultSettings,
          getNetworkIdsCompatibleWithWalletId,
        },
        serviceAccount: {
          getAccountAddressForApi: jest.fn(),
        },
      },
    });
    service._getTokensList = jest
      .fn()
      .mockResolvedValue([
        createToken('btc--0', 'BTC'),
        createToken('evm--1', 'ETH'),
        createToken(
          'evm--1',
          'USDT',
          '0xdac17f958d2ee523a2206206994597c13d831ec7',
        ),
      ]) as unknown as typeof service._getTokensList;
    return service;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getNetworksByIds.mockImplementation(async ({ networkIds }) => ({
      networks: [btcNetwork, evmNetwork].filter((n) =>
        networkIds.includes(n.id),
      ),
    }));
    getVaultSettings.mockImplementation(async ({ networkId }) => ({
      mergeDeriveAssetsEnabled: networkId === 'btc--0',
    }));
    getNetworkIdsCompatibleWithWalletId.mockResolvedValue({
      networkIdsIncompatible: [],
    });
  });

  it('returns network metadata for every token network in the same response', async () => {
    const service = createService();

    const result = await service.getTokensListWithNetworks({
      networkId: 'onekeyall--0',
      type: 'buy',
      accountId: 'hd-1--m/44h/60h/0h/0/0',
    });

    expect(result.tokens.map((t) => t.symbol)).toEqual(['BTC', 'ETH', 'USDT']);
    expect(result.networksMap).toEqual({
      'btc--0': btcNetwork,
      'evm--1': evmNetwork,
    });
    expect(getNetworksByIds).toHaveBeenCalledTimes(1);
    expect(getNetworksByIds).toHaveBeenCalledWith({
      networkIds: ['btc--0', 'evm--1'],
    });
  });

  it('lists the networks whose vault merges derive assets', async () => {
    const service = createService();

    const result = await service.getTokensListWithNetworks({
      networkId: 'onekeyall--0',
      type: 'buy',
      accountId: 'hd-1--m/44h/60h/0h/0/0',
    });

    expect(result.mergeDeriveAssetsNetworkIds).toEqual(['btc--0']);
    expect(getVaultSettings).toHaveBeenCalledTimes(2);
  });

  it('keeps the token list when the network metadata lookup fails', async () => {
    // The metadata used to load separately, so a failure only left rows
    // unlabeled; folding it into this response must not hide the tokens.
    getNetworksByIds.mockRejectedValueOnce(
      new Error('network config unreadable'),
    );
    const service = createService();

    const result = await service.getTokensListWithNetworks({
      networkId: 'onekeyall--0',
      type: 'buy',
      accountId: 'hd-1--m/44h/60h/0h/0/0',
    });

    expect(result.tokens.map((t) => t.symbol)).toEqual(['BTC', 'ETH', 'USDT']);
    expect(result.networksMap).toEqual({});
    expect(result.mergeDeriveAssetsNetworkIds).toEqual(['btc--0']);
  });

  it('treats a network whose vault settings cannot be loaded as non-merging', async () => {
    getVaultSettings.mockImplementation(async ({ networkId }) => {
      if (networkId === 'btc--0') {
        throw new OneKeyLocalError('unsupported');
      }
      return { mergeDeriveAssetsEnabled: false };
    });
    const service = createService();

    const result = await service.getTokensListWithNetworks({
      networkId: 'onekeyall--0',
      type: 'buy',
      accountId: 'hd-1--m/44h/60h/0h/0/0',
    });

    expect(result.mergeDeriveAssetsNetworkIds).toEqual([]);
    expect(result.tokens).toHaveLength(3);
  });
});

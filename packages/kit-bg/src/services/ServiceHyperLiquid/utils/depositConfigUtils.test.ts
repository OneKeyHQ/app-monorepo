import type { IServerNetwork } from '@onekeyhq/shared/types';

import { buildDepositConfigFromTokensByNetwork } from './depositConfigUtils';

const makeNetwork = ({
  id,
  name,
  symbol,
  logoURI,
}: {
  id: string;
  name: string;
  symbol: string;
  logoURI: string;
}) =>
  ({
    id,
    name,
    code: symbol.toLowerCase(),
    shortcode: symbol,
    shortname: name,
    symbol,
    logoURI,
    decimals: 18,
  }) as IServerNetwork;

describe('depositConfigUtils', () => {
  it('builds deposit networks and token map from depositTokensByNetwork config', async () => {
    const networksById: Record<string, IServerNetwork> = {
      'evm--56': makeNetwork({
        id: 'evm--56',
        name: 'BNB Smart Chain',
        symbol: 'BNB',
        logoURI: 'bnb-network.png',
      }),
      'tron--0x2b6653dc': makeNetwork({
        id: 'tron--0x2b6653dc',
        name: 'Tron',
        symbol: 'TRX',
        logoURI: 'tron-network.png',
      }),
    };

    const result = await buildDepositConfigFromTokensByNetwork({
      tokensByNetwork: {
        'evm--56': [
          {
            contractAddress: '',
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
            logoURI: 'bnb.png',
            isNative: true,
            isDefault: true,
          },
          {
            contractAddress: '0x55d398326f99059ff775485246999027b3197955',
            name: 'Tether USD',
            symbol: 'USDT',
            decimals: 18,
            logoURI: 'usdt.png',
            isNative: false,
          },
        ],
        'tron--0x2b6653dc': [
          {
            contractAddress: '',
            name: 'TRON',
            symbol: 'TRX',
            decimals: 6,
            logoURI: 'trx.png',
            isNative: true,
          },
        ],
      },
      getNetworkSafe: async ({ networkId }) => networksById[networkId],
    });

    expect(result.networks.map((network) => network.networkId)).toEqual([
      'evm--56',
      'tron--0x2b6653dc',
    ]);
    expect(Object.keys(result.tokensMap)).toEqual([
      'evm--56',
      'tron--0x2b6653dc',
    ]);
    expect(result.tokensMap['evm--56']).toEqual([
      expect.objectContaining({
        networkId: 'evm--56',
        symbol: 'BNB',
        networkLogoURI: 'bnb-network.png',
        isDefault: true,
      }),
      expect.objectContaining({
        networkId: 'evm--56',
        symbol: 'USDT',
      }),
    ]);
    expect(result.tokensMap['tron--0x2b6653dc']).toEqual([
      expect.objectContaining({
        networkId: 'tron--0x2b6653dc',
        symbol: 'TRX',
        networkLogoURI: 'tron-network.png',
      }),
    ]);
    expect(result.defaultTokens).toEqual([
      expect.objectContaining({
        networkId: 'evm--56',
        symbol: 'BNB',
      }),
    ]);
  });

  it('skips networks missing local metadata', async () => {
    const result = await buildDepositConfigFromTokensByNetwork({
      tokensByNetwork: {
        'evm--56': [
          {
            contractAddress: '',
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
            logoURI: 'bnb.png',
            isNative: true,
          },
        ],
      },
      getNetworkSafe: async () => undefined,
    });

    expect(result).toEqual({
      networks: [],
      tokensMap: {},
      defaultTokens: [],
    });
  });
});

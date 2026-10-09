import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapTokenSelectorAssetNetworks,
  buildSwapTokenSelectorNetworkGroups,
} from './SwapTokenSelectorDesktop.utils';

const network = (
  networkId: string,
  name: string,
  extra?: Partial<ISwapNetwork>,
) => ({ networkId, name, symbol: name, ...extra }) as ISwapNetwork;

const token = (
  networkId: string,
  balanceParsed: string,
  fiatValue: string,
): ISwapToken =>
  ({
    networkId,
    balanceParsed,
    fiatValue,
    contractAddress: `${networkId}-token`,
    decimals: 18,
    symbol: 'TOKEN',
  }) as ISwapToken;

describe('SwapTokenSelectorDesktop.utils', () => {
  it('groups L2 networks under their server-provided parent and keeps orphan L2s flat', () => {
    const groups = buildSwapTokenSelectorNetworkGroups({
      networks: [
        network('ethereum', 'Ethereum'),
        network('arbitrum', 'Arbitrum', {
          isL2: true,
          parentNetworkId: 'ethereum',
        }),
        network('optimism', 'Optimism', {
          isL2: true,
          parentNetworkId: 'ethereum',
        }),
        network('orphan', 'Orphan L2', {
          isL2: true,
          parentNetworkId: 'missing-parent',
        }),
      ],
    });

    expect(groups.map(({ network: item }) => item.networkId)).toEqual([
      'ethereum',
      'orphan',
    ]);
    expect(
      groups
        .find(({ network: item }) => item.networkId === 'ethereum')
        ?.children.map((item) => item.networkId),
    ).toEqual(['arbitrum', 'optimism']);
  });

  it('filters networks by name without hardcoding a chain name', () => {
    const groups = buildSwapTokenSelectorNetworkGroups({
      networks: [network('solana', 'Solana'), network('ethereum', 'Ethereum')],
      searchValue: 'sol',
    });
    expect(groups.map(({ network: item }) => item.networkId)).toEqual([
      'solana',
    ]);
  });

  it('sorts asset networks by fiat value and ignores zero balance/value tokens', () => {
    const networks = [
      network('ethereum', 'Ethereum'),
      network('solana', 'Solana'),
    ];
    const assets = buildSwapTokenSelectorAssetNetworks({
      networks,
      tokens: [
        token('ethereum', '1', '10'),
        token('ethereum', '2', '5'),
        token('solana', '1', '20'),
        token('solana', '0', '100'),
        token('missing', '1', '1000'),
      ],
    });
    expect(assets).toEqual([
      { network: networks[1], fiatValue: '20' },
      { network: networks[0], fiatValue: '15' },
    ]);
  });
});

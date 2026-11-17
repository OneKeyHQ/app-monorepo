import {
  EStakeProtocolGroupEnum,
  type IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';

import {
  filterAndSortProtocols,
  getProtocolNetworkData,
} from './protocolListUtils';

function buildProtocol({
  name,
  networkId,
  tvl,
  apy,
  fallbackTvl,
}: {
  name: string;
  networkId: string;
  tvl?: string;
  apy?: string;
  fallbackTvl?: string;
}): IStakeProtocolListItem {
  return {
    provider: {
      name,
      logoURI: '',
      group: EStakeProtocolGroupEnum.Available,
      totalFiatValue: tvl,
      aprWithoutFee: apy,
    } as IStakeProtocolListItem['provider'],
    tvl: fallbackTvl ? { text: fallbackTvl } : undefined,
    network: {
      networkId,
      name: networkId,
      logoURI: '',
    },
    isEarning: false,
  };
}

describe('protocolListUtils', () => {
  const protocols = [
    buildProtocol({
      name: 'Native',
      networkId: 'evm--1',
      tvl: '$20M',
      apy: '2%',
    }),
    buildProtocol({
      name: 'Lista',
      networkId: 'evm--56',
      tvl: '$10M',
      apy: '5%',
    }),
    buildProtocol({
      name: 'Morphe',
      networkId: 'evm--1',
    }),
  ];

  it('counts protocols by network', () => {
    expect(getProtocolNetworkData(protocols)).toEqual({
      availableNetworkIds: ['evm--1', 'evm--56'],
      networkAssetCounts: {
        'evm--1': 2,
        'evm--56': 1,
      },
    });
  });

  it('treats an empty selection as All and filters a single selected network', () => {
    expect(
      filterAndSortProtocols({
        items: protocols,
        selectedNetworkIds: [],
        sortKey: 'tvl',
        sortDirection: 'desc',
      }),
    ).toHaveLength(3);

    expect(
      filterAndSortProtocols({
        items: protocols,
        selectedNetworkIds: ['evm--56'],
        sortKey: 'tvl',
        sortDirection: 'desc',
      }).map((item) => item.provider.name),
    ).toEqual(['Lista']);
  });

  it('combines multiple selected networks with OR semantics', () => {
    expect(
      filterAndSortProtocols({
        items: protocols,
        selectedNetworkIds: ['evm--1', 'evm--56'],
        sortKey: 'tvl',
        sortDirection: 'desc',
      }),
    ).toHaveLength(3);
  });

  it.each([
    ['tvl', 'desc', ['Native', 'Lista', 'Morphe']],
    ['tvl', 'asc', ['Lista', 'Native', 'Morphe']],
    ['yield', 'desc', ['Lista', 'Native', 'Morphe']],
    ['yield', 'asc', ['Native', 'Lista', 'Morphe']],
  ] as const)(
    'sorts %s %s and keeps missing values last',
    (sortKey, sortDirection, expected) => {
      expect(
        filterAndSortProtocols({
          items: protocols,
          selectedNetworkIds: [],
          sortKey,
          sortDirection,
        }).map((item) => item.provider.name),
      ).toEqual(expected);
    },
  );

  it('falls back to the display TVL when the provider value is empty', () => {
    const withFallback = buildProtocol({
      name: 'Fallback',
      networkId: 'evm--1',
      tvl: '',
      fallbackTvl: '$30M',
    });

    expect(
      filterAndSortProtocols({
        items: [...protocols, withFallback],
        selectedNetworkIds: [],
        sortKey: 'tvl',
        sortDirection: 'desc',
      }).map((item) => item.provider.name),
    ).toEqual(['Fallback', 'Native', 'Lista', 'Morphe']);
  });
});

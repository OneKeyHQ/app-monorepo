import type {
  IAccountToken,
  IAggregateToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  buildAggregateTokenListData,
  buildAggregateTokenListMapKeyForTokenList,
  buildAggregateTokenMapKeyForAggregateConfig,
} from './tokenUtils';

function buildConfigEntry(networkId: string, order: number): IAggregateToken {
  return {
    networkId,
    address: '',
    order,
    commonSymbol: 'ETH',
    logoURI: 'eth.png',
    name: 'Ethereum',
  } as IAggregateToken;
}

function buildMember(networkId: string): IAccountToken {
  return {
    $key: `${networkId}__`,
    networkId,
    address: '',
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    isNative: true,
  } as IAccountToken;
}

const aggregateTokenConfigMapRawData: Record<string, IAggregateToken> = {
  [buildAggregateTokenMapKeyForAggregateConfig({
    networkId: 'evm--1',
    tokenAddress: '',
  })]: buildConfigEntry('evm--1', 1),
  [buildAggregateTokenMapKeyForAggregateConfig({
    networkId: 'evm--4663',
    tokenAddress: '',
  })]: buildConfigEntry('evm--4663', 2),
};

describe('buildAggregateTokenListData', () => {
  it('stamps every member with the aggregate config order and metadata', () => {
    // Fold two networks into ONE accumulated map, the way the token selector
    // self-fetch does across responses.
    let aggregateTokenListMap: Record<
      string,
      { commonToken: IAccountToken; tokens: IAccountToken[] }
    > = {};
    let aggregateTokenMap: Record<string, ITokenFiat> = {};
    for (const [networkId, networkName] of [
      ['evm--1', 'Ethereum'],
      ['evm--4663', 'Robinhood'],
    ] as const) {
      const data = buildAggregateTokenListData({
        networkId,
        accountId: 'account-1',
        token: buildMember(networkId),
        tokenMap: {},
        aggregateTokenListMap,
        aggregateTokenMap,
        aggregateTokenConfigMapRawData,
        networkName,
      });
      aggregateTokenListMap = data.aggregateTokenListMap;
      aggregateTokenMap = data.aggregateTokenMap;
    }

    const group =
      aggregateTokenListMap[
        buildAggregateTokenListMapKeyForTokenList({ commonSymbol: 'ETH' })
      ];
    expect(
      group.tokens.map((token) => [
        token.networkId,
        token.order,
        token.commonSymbol,
        token.networkName,
        token.logoURI,
        token.accountId,
      ]),
    ).toEqual([
      ['evm--1', 1, 'ETH', 'Ethereum', 'eth.png', 'account-1'],
      ['evm--4663', 2, 'ETH', 'Robinhood', 'eth.png', 'account-1'],
    ]);
  });
});

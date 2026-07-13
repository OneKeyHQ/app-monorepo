import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

export function createMockTransaction(
  hash: string,
  timestamp = 1,
): IMarketTokenTransaction {
  return {
    pairAddress: 'pair-1',
    hash,
    owner: '0xowner',
    type: 'buy',
    timestamp,
    url: '',
    volumeUSD: 1,
    from: {
      symbol: 'AAA',
      amount: '1',
      address: '0xaaa',
      price: '1',
    },
    to: {
      symbol: 'BBB',
      amount: '1',
      address: '0xbbb',
      price: '1',
    },
  };
}

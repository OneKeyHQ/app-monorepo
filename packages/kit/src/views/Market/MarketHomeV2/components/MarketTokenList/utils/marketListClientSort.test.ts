import {
  MARKET_CLIENT_SORT_FIELD_MAP,
  sortMarketTokensClient,
} from './marketListClientSort';

import type { IMarketToken } from '../MarketTokenData';

const makeToken = (partial: Partial<IMarketToken>): IMarketToken =>
  ({
    id: partial.id ?? 'id',
    name: 'n',
    symbol: 's',
    address: '0x',
    decimals: 9,
    price: 0,
    change24h: 0,
    marketCap: 0,
    liquidity: 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: 0,
    tokenImageUri: '',
    networkLogoUri: '',
    networkId: 'sol--101',
    ...partial,
  }) as IMarketToken;

describe('sortMarketTokensClient', () => {
  it('sorts desc and asc by numeric field', () => {
    const tokens = [
      makeToken({ id: 'a', marketCap: 1 }),
      makeToken({ id: 'b', marketCap: 3 }),
      makeToken({ id: 'c', marketCap: 2 }),
    ];
    expect(
      sortMarketTokensClient(tokens, 'marketCap', 'desc').map((t) => t.id),
    ).toEqual(['b', 'c', 'a']);
    expect(
      sortMarketTokensClient(tokens, 'marketCap', 'asc').map((t) => t.id),
    ).toEqual(['a', 'c', 'b']);
  });

  it('sinks missing values to bottom regardless of direction', () => {
    const tokens = [
      makeToken({ id: 'missing', firstTradeTime: undefined }),
      makeToken({ id: 'old', firstTradeTime: 100 }),
      makeToken({ id: 'new', firstTradeTime: 200 }),
      makeToken({ id: 'zeroish', firstTradeTime: 0 }),
    ];
    expect(
      sortMarketTokensClient(tokens, 'firstTradeTime', 'desc').map((t) => t.id),
    ).toEqual(['new', 'old', 'zeroish', 'missing']);
    expect(
      sortMarketTokensClient(tokens, 'firstTradeTime', 'asc').map((t) => t.id),
    ).toEqual(['zeroish', 'old', 'new', 'missing']);
  });

  it('does not mutate input and is stable for equal values', () => {
    const tokens = [
      makeToken({ id: 'a', price: 1 }),
      makeToken({ id: 'b', price: 1 }),
    ];
    const sorted = sortMarketTokensClient(tokens, 'price', 'desc');
    expect(sorted).not.toBe(tokens);
    expect(sorted.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('MARKET_CLIENT_SORT_FIELD_MAP', () => {
  it('covers all sortable columns', () => {
    expect(MARKET_CLIENT_SORT_FIELD_MAP).toEqual({
      price: 'price',
      change24h: 'change24h',
      marketCap: 'marketCap',
      liquidity: 'liquidity',
      turnover: 'turnover',
      transactions: 'transactions',
      uniqueTraders: 'uniqueTraders',
      holders: 'holders',
      tokenAge: 'firstTradeTime',
    });
  });
});

import {
  filterWatchlistTokens,
  getWatchlistSidebarPriceChange,
} from './filterWatchlistTokens';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

function token(overrides: Partial<IMarketToken>): IMarketToken {
  return {
    id: overrides.symbol ?? 'id',
    name: '',
    symbol: '',
    address: '',
    decimals: 0,
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
    networkId: '',
    ...overrides,
  };
}

const tokens = [
  token({ symbol: 'ETH', name: 'Ethereum', address: '0xAbC123' }),
  token({
    symbol: 'AAPLon',
    name: 'Apple (Ondo Tokenized)',
    stock: { subtitle: 'Apple Inc.', sourceLogoUri: '' },
  }),
  token({ symbol: 'TSLA', stockId: 'TSLA' }),
  token({ symbol: 'BTC', perpsCoin: 'BTC', perpsSubtitle: 'Crypto' }),
];

describe('filterWatchlistTokens', () => {
  it('returns every token for a blank query', () => {
    expect(filterWatchlistTokens(tokens, '  ')).toBe(tokens);
  });

  it('matches symbol and name case-insensitively', () => {
    expect(
      filterWatchlistTokens(tokens, 'ethereum').map((t) => t.symbol),
    ).toEqual(['ETH']);
    expect(filterWatchlistTokens(tokens, 'aapl').map((t) => t.symbol)).toEqual([
      'AAPLon',
    ]);
  });

  it('matches contract address, stock company name, stock ID and perps coin', () => {
    expect(filterWatchlistTokens(tokens, '0xabc').map((t) => t.symbol)).toEqual(
      ['ETH'],
    );
    expect(
      filterWatchlistTokens(tokens, 'apple inc').map((t) => t.symbol),
    ).toEqual(['AAPLon']);
    expect(filterWatchlistTokens(tokens, 'tsla').map((t) => t.symbol)).toEqual([
      'TSLA',
    ]);
    expect(filterWatchlistTokens(tokens, 'btc').map((t) => t.symbol)).toEqual([
      'BTC',
    ]);
  });

  it('returns nothing when no favorite matches', () => {
    expect(filterWatchlistTokens(tokens, 'doge')).toEqual([]);
  });
});

describe('getWatchlistSidebarPriceChange', () => {
  it('reads a perps row change, which carries no priceChangeRaw', () => {
    expect(
      getWatchlistSidebarPriceChange(
        token({ symbol: 'BTC', perpsCoin: 'BTC', change24h: 2.5 }),
      ),
    ).toBe(2.5);
  });

  it('treats a feed placeholder or a non-numeric change as missing', () => {
    expect(
      getWatchlistSidebarPriceChange(
        token({ change24h: 0, priceChangeRaw: '-' }),
      ),
    ).toBeUndefined();
    expect(
      getWatchlistSidebarPriceChange(token({ change24h: Number.NaN })),
    ).toBeUndefined();
  });

  it('keeps a real zero change', () => {
    expect(
      getWatchlistSidebarPriceChange(
        token({ change24h: 0, priceChangeRaw: '0' }),
      ),
    ).toBe(0);
  });
});

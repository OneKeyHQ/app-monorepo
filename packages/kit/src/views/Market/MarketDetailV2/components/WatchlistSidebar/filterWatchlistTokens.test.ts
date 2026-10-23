import { getWatchlistSidebarPriceChange } from './filterWatchlistTokens';

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

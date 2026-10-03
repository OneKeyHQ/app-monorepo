import {
  MARKET_CATEGORY_WITHOUT_NETWORK_FILTER_ID,
  MARKET_TOP_COINS_CATEGORY_ID,
} from '@onekeyhq/shared/src/consts/marketConsts';

import {
  resolveMarketDetailFooterMode,
  resolveMarketMobileDetailKind,
  resolveMarketMobileTradeDestination,
  resolveMobileInformationColumnHeader,
} from './marketMobileDetailKind';

describe('resolveMarketMobileDetailKind', () => {
  it('treats a stock token as the stock detail', () => {
    expect(
      resolveMarketMobileDetailKind({
        isStockToken: true,
        marketTokenCategory: 'trending',
      }),
    ).toBe('stock');
  });

  it('treats the top-coins category as the mainstream detail', () => {
    expect(
      resolveMarketMobileDetailKind({
        isStockToken: false,
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      }),
    ).toBe('topCoin');
  });

  it('treats other categories as the trending token detail', () => {
    expect(
      resolveMarketMobileDetailKind({
        isStockToken: false,
        marketTokenCategory: 'trending',
      }),
    ).toBe('trending');
    expect(
      resolveMarketMobileDetailKind({
        isStockToken: false,
        marketTokenCategory: MARKET_CATEGORY_WITHOUT_NETWORK_FILTER_ID,
      }),
    ).toBe('trending');
    expect(
      resolveMarketMobileDetailKind({
        isStockToken: false,
      }),
    ).toBe('trending');
  });
});

describe('resolveMarketMobileTradeDestination', () => {
  it('sends mainstream, trending, and Robinhood details to ordinary Swap', () => {
    expect(resolveMarketMobileTradeDestination('topCoin')).toBe('swap');
    expect(resolveMarketMobileTradeDestination('trending')).toBe('swap');
  });

  it('sends stocks to the stock tab', () => {
    expect(resolveMarketMobileTradeDestination('stock')).toBe('stock');
  });
});

describe('resolveMarketDetailFooterMode', () => {
  it('uses a single Trade action for trending tokens', () => {
    expect(resolveMarketDetailFooterMode('trending')).toBe('trade');
  });

  it('uses Perps and Trade for mainstream coins and stocks', () => {
    expect(resolveMarketDetailFooterMode('topCoin')).toBe('perps-trade');
    expect(resolveMarketDetailFooterMode('stock')).toBe('perps-trade');
  });
});

describe('resolveMobileInformationColumnHeader', () => {
  const names = {
    transactionsTabName: 'Transactions',
    holdersTabName: 'Holders',
    portfolioTabName: 'My position',
    liquidityTabName: 'Liquidity',
  };

  it('hides the column header on a trending overview', () => {
    expect(
      resolveMobileInformationColumnHeader({
        detailKind: 'trending',
        focusedTab: 'Overview',
        ...names,
      }),
    ).toBe('none');
  });

  it('shows the transactions header only on the transactions tab', () => {
    expect(
      resolveMobileInformationColumnHeader({
        detailKind: 'trending',
        focusedTab: 'Transactions',
        ...names,
      }),
    ).toBe('transactions');
  });

  it('shows the holders header on the holders tab', () => {
    expect(
      resolveMobileInformationColumnHeader({
        detailKind: 'trending',
        focusedTab: 'Holders',
        ...names,
      }),
    ).toBe('holders');
  });

  it('hides the column header on stock and top-coin overviews', () => {
    expect(
      resolveMobileInformationColumnHeader({
        detailKind: 'stock',
        focusedTab: 'Overview',
        ...names,
      }),
    ).toBe('none');
    expect(
      resolveMobileInformationColumnHeader({
        detailKind: 'topCoin',
        focusedTab: 'Financials',
        ...names,
      }),
    ).toBe('none');
  });

  it('still shows the position columns on the portfolio tab', () => {
    expect(
      resolveMobileInformationColumnHeader({
        detailKind: 'stock',
        focusedTab: 'My position',
        ...names,
      }),
    ).toBe('portfolio');
  });
});

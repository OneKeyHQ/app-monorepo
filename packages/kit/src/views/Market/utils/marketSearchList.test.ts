import {
  MARKET_SEARCH_TABS,
  getDetailPopoverSearchTabs,
  isDetailSearchChainToken,
} from './marketSearchList';

describe('getDetailPopoverSearchTabs', () => {
  it('shows All, Stocks, and Tokens when the query has a stock asset', () => {
    expect(getDetailPopoverSearchTabs(true)).toEqual([
      MARKET_SEARCH_TABS.all,
      MARKET_SEARCH_TABS.stocks,
      MARKET_SEARCH_TABS.tokens,
    ]);
  });

  it('hides Stocks for a non-stock token query', () => {
    expect(getDetailPopoverSearchTabs(false)).toEqual([
      MARKET_SEARCH_TABS.all,
      MARKET_SEARCH_TABS.tokens,
    ]);
  });
});

describe('isDetailSearchChainToken', () => {
  it('keeps issuer tokens and drops the bare stock listing', () => {
    expect(
      isDetailSearchChainToken({
        stockId: 'AAPL',
        network: 'evm--1',
        address: '0xaapl',
      }),
    ).toBe(true);
    expect(
      isDetailSearchChainToken({
        stockId: 'AAPL',
        address: '',
        network: '',
      }),
    ).toBe(false);
    expect(isDetailSearchChainToken({})).toBe(true);
  });
});

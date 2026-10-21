import {
  MARKET_SEARCH_TABS,
  applyMarketSectionPreview,
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

  it('hides Tokens when no token matches', () => {
    expect(getDetailPopoverSearchTabs(true, false)).toEqual([
      MARKET_SEARCH_TABS.all,
      MARKET_SEARCH_TABS.stocks,
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

const STOCK = 2;
const TOKEN = 3;
const PERP = 5;

const rows = (count: number) => Array.from({ length: count }, (_, i) => i);
const section = (tabIndex: number, count: number) => ({
  tabIndex,
  data: rows(count),
  sliceData: rows(count).slice(0, 3),
  showMore: count > 3,
});
const options = {
  stockTabIndex: STOCK,
  tokenTabIndex: TOKEN,
  previewLimit: 5,
  stockCanLoadMore: false,
};

describe('applyMarketSectionPreview', () => {
  it('previews both sections when stocks and tokens both have rows', () => {
    const [stocks, tokens] = applyMarketSectionPreview(
      [section(STOCK, 2), section(TOKEN, 8)],
      options,
    );
    expect(stocks.sliceData).toEqual(rows(2));
    expect(stocks.showMore).toBe(false);
    expect(tokens.sliceData).toEqual(rows(5));
    expect(tokens.showMore).toBe(true);
  });

  it('shows more stocks when another page is left', () => {
    const [stocks] = applyMarketSectionPreview(
      [section(STOCK, 2), section(TOKEN, 1)],
      { ...options, stockCanLoadMore: true },
    );
    expect(stocks.showMore).toBe(true);
  });

  it('previews a market section next to any other section', () => {
    const [tokens] = applyMarketSectionPreview(
      [section(TOKEN, 8), section(PERP, 2)],
      options,
    );
    expect(tokens.sliceData).toEqual(rows(5));
    expect(tokens.showMore).toBe(true);
  });

  it('lists every row when it is the only section', () => {
    const [tokens] = applyMarketSectionPreview([section(TOKEN, 8)], {
      ...options,
      stockCanLoadMore: true,
    });
    expect(tokens.sliceData).toEqual(rows(8));
    expect(tokens.showMore).toBe(false);

    const [stocks] = applyMarketSectionPreview([section(STOCK, 8)], {
      ...options,
      stockCanLoadMore: true,
    });
    expect(stocks.sliceData).toEqual(rows(8));
    expect(stocks.showMore).toBe(false);
  });

  it('treats a stock section without rows as absent', () => {
    const [, tokens] = applyMarketSectionPreview(
      [section(STOCK, 0), section(TOKEN, 8)],
      options,
    );
    expect(tokens.sliceData).toEqual(rows(8));
  });

  it('leaves other sections untouched', () => {
    const perps = section(PERP, 8);
    const result = applyMarketSectionPreview(
      [section(STOCK, 2), section(TOKEN, 2), perps],
      options,
    );
    expect(result[2]).toBe(perps);
  });
});

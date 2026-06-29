import { getStockMarketClosedDescription } from '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert/getStockMarketClosedDescription';

describe('SwapStockTradeAlert utils', () => {
  it('keeps only the reopen time from a closed-market description', () => {
    expect(
      getStockMarketClosedDescription(
        '交易将在 1天 13 小时 16 分钟后开放\n\nOndo 的代币化证券支持 24/5 交易。',
      ),
    ).toBe('交易将在 1天 13 小时 16 分钟后开放');
  });

  it('trims empty lines before the reopen time', () => {
    expect(
      getStockMarketClosedDescription(
        '\n\r\n  Market reopens in 1D 13H 16M\r\n\r\nOndo supports 24/5 trading.',
      ),
    ).toBe('Market reopens in 1D 13H 16M');
  });

  it('does not show the stock mechanism explanation as a fallback', () => {
    expect(
      getStockMarketClosedDescription(
        "Ondo's tokenized securities support 24/5 trading.",
      ),
    ).toBeUndefined();
  });
});

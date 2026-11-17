import { resolveMarketDetailHeaderIdentity } from './marketDetailHeaderIdentity';

describe('resolveMarketDetailHeaderIdentity', () => {
  it('keeps the stock list symbol and logo after the token detail arrives', () => {
    expect(
      resolveMarketDetailHeaderIdentity({
        isStockToken: true,
        stockSymbol: 'AAPL',
        stockLogoUrl: 'https://example.com/aapl.png',
        tokenSymbol: 'AAPLon',
        tokenLogoUrl: 'https://example.com/aaplon.png',
        tokenLogoUrls: ['https://example.com/aaplon.png'],
        tokenVariant: {
          symbol: 'AAPLon',
          name: 'Apple (Ondo)',
          logoUrl: 'https://example.com/aaplon.png',
        },
      }),
    ).toEqual({
      symbol: 'AAPL',
      logoUrl: 'https://example.com/aapl.png',
    });
  });

  it('does not use the issuer logo once the listing symbol is known', () => {
    expect(
      resolveMarketDetailHeaderIdentity({
        isStockToken: true,
        stockSymbol: 'NVDA',
        stockLogoUrl: ' ',
        tokenSymbol: 'NVDAon',
        tokenLogoUrl: 'https://example.com/ondo.png',
      }),
    ).toEqual({
      symbol: 'NVDA',
      logoUrl: undefined,
    });
  });

  it('falls back to the token identity before the stock preview exists', () => {
    expect(
      resolveMarketDetailHeaderIdentity({
        isStockToken: true,
        tokenSymbol: 'AAPLon',
        tokenLogoUrl: 'https://example.com/aaplon.png',
      }),
    ).toEqual({
      symbol: 'AAPLon',
      logoUrl: 'https://example.com/aaplon.png',
    });
  });

  it('keeps the token identity for a non-stock detail', () => {
    expect(
      resolveMarketDetailHeaderIdentity({
        isStockToken: false,
        stockSymbol: 'AAPL',
        stockLogoUrl: 'https://example.com/aapl.png',
        tokenSymbol: 'ETH',
        tokenLogoUrl: 'https://example.com/eth.png',
        tokenLogoUrls: ['https://example.com/eth.png'],
      }),
    ).toEqual({
      symbol: 'ETH',
      logoUrl: 'https://example.com/eth.png',
      logoUrls: ['https://example.com/eth.png'],
    });
  });

  it('uses the selected variant while the previous token detail is still loaded', () => {
    expect(
      resolveMarketDetailHeaderIdentity({
        isStockToken: false,
        tokenSymbol: 'AAPLon',
        tokenLogoUrl: 'https://example.com/aaplon.png',
        tokenLogoUrls: ['https://example.com/aaplon.png'],
        tokenVariant: {
          symbol: 'AAPLx',
          name: 'Apple xStock',
          logoUrl: 'https://example.com/aaplx.png',
        },
      }),
    ).toEqual({
      symbol: 'AAPLx',
      logoUrl: 'https://example.com/aaplx.png',
    });
  });

  it('does not reuse the previous variant image when the selection has no image', () => {
    expect(
      resolveMarketDetailHeaderIdentity({
        isStockToken: false,
        tokenSymbol: 'AAPLon',
        tokenLogoUrl: 'https://example.com/aaplon.png',
        tokenLogoUrls: ['https://example.com/aaplon.png'],
        tokenVariant: { symbol: 'AAPLx', name: 'Apple xStock' },
      }),
    ).toEqual({ symbol: 'AAPLx', logoUrl: undefined });
  });

  it('shows the share identity without any token metadata', () => {
    expect(
      resolveMarketDetailHeaderIdentity({
        isStockToken: true,
        stockSymbol: 'AAPL',
        stockLogoUrl: 'https://example.com/aapl.png',
      }),
    ).toEqual({ symbol: 'AAPL', logoUrl: 'https://example.com/aapl.png' });
  });
});

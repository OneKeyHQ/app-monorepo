import {
  resolveMarketDetailHeaderIdentity,
  resolveStockPageHeaderIdentity,
} from './marketDetailHeaderIdentity';

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

  it('keeps the desktop stock page on the listing once its ticker is known', () => {
    expect(
      resolveStockPageHeaderIdentity({
        stockPreviewSymbol: 'NVDA',
        stockPreviewName: 'NVIDIA',
        stockPreviewLogoUrl: ' ',
        stockId: 'NVDA',
        tokenSymbol: 'NVDAon',
        tokenName: 'NVIDIA (Ondo)',
        tokenLogoUrl: 'https://example.com/ondo.png',
        issuerLogoUrl: 'https://example.com/issuer.png',
      }),
    ).toEqual({
      symbol: 'NVDA',
      name: 'NVIDIA',
      logoUrl: undefined,
    });
    expect(
      resolveStockPageHeaderIdentity({
        stockDetailLogoUrl: 'https://example.com/nvda.png',
        stockId: 'NVDA',
        tokenLogoUrl: 'https://example.com/ondo.png',
      }),
    ).toEqual({
      symbol: 'NVDA',
      name: undefined,
      logoUrl: 'https://example.com/nvda.png',
    });
  });

  it('uses the wrapped token on the desktop stock page before a listing exists', () => {
    expect(
      resolveStockPageHeaderIdentity({
        tokenSymbol: 'NVDAon',
        tokenName: 'NVIDIA (Ondo)',
        tokenLogoUrl: 'https://example.com/ondo.png',
        issuerLogoUrl: 'https://example.com/issuer.png',
      }),
    ).toEqual({
      symbol: 'NVDAon',
      name: 'NVIDIA (Ondo)',
      logoUrl: 'https://example.com/ondo.png',
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
});

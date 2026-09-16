import {
  clearWatchlistListingPreviews,
  forgetWatchlistListingPreview,
  rememberWatchlistListingPreview,
  resolveListingWatchlistDisplay,
} from './watchlistListingPreview';

const aapl = { stockId: 'AAPL', chainId: '', contractAddress: '' };

describe('watchlistListingPreview', () => {
  afterEach(() => {
    clearWatchlistListingPreviews();
  });

  it('keeps the search logo until the stock batch quote arrives', () => {
    rememberWatchlistListingPreview(aapl, {
      logoUrl: 'https://example.com/aapl.png',
      name: 'Apple Inc.',
      symbol: 'AAPL',
    });

    expect(
      resolveListingWatchlistDisplay({
        watchlistItem: aapl,
      }),
    ).toEqual({
      name: 'Apple Inc.',
      symbol: 'AAPL',
      tokenImageUri: 'https://example.com/aapl.png',
      stockVariants: undefined,
    });
  });

  it('prefers the live quote over the remembered search preview', () => {
    rememberWatchlistListingPreview(aapl, {
      logoUrl: 'https://example.com/search.png',
      name: 'Apple',
      symbol: 'AAPL',
    });

    expect(
      resolveListingWatchlistDisplay({
        watchlistItem: aapl,
        quote: {
          name: 'Apple Inc.',
          symbol: 'AAPL',
          logoUrl: 'https://example.com/quote.png',
        },
      }),
    ).toEqual({
      name: 'Apple Inc.',
      symbol: 'AAPL',
      tokenImageUri: 'https://example.com/quote.png',
      stockVariants: undefined,
    });
  });

  it('does not keep a remembered logo after the quote removes it', () => {
    rememberWatchlistListingPreview(aapl, {
      logoUrl: 'https://example.com/search.png',
      name: 'Apple',
      symbol: 'AAPL',
    });

    expect(
      resolveListingWatchlistDisplay({
        watchlistItem: aapl,
        quote: {
          name: 'Apple Inc.',
          symbol: 'AAPL',
          logoUrl: '',
        },
      }),
    ).toEqual({
      name: 'Apple Inc.',
      symbol: 'AAPL',
      tokenImageUri: '',
      stockVariants: undefined,
    });
  });

  it('ignores blank preview fields so identity fallbacks still work', () => {
    rememberWatchlistListingPreview(aapl, { logoUrl: '  ', name: '' });
    expect(
      resolveListingWatchlistDisplay({ watchlistItem: aapl }),
    ).toMatchObject({
      name: 'AAPL',
      symbol: 'AAPL',
      tokenImageUri: '',
    });
  });

  it('drops a remembered preview after unstar', () => {
    rememberWatchlistListingPreview(aapl, {
      logoUrl: 'https://example.com/aapl.png',
      symbol: 'AAPL',
    });
    forgetWatchlistListingPreview(aapl);
    expect(
      resolveListingWatchlistDisplay({ watchlistItem: aapl }),
    ).toMatchObject({
      tokenImageUri: '',
      symbol: 'AAPL',
    });
  });
});

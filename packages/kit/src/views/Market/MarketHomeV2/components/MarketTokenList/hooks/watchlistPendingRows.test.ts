import {
  clearWatchlistListingPreviews,
  rememberWatchlistListingPreview,
} from './watchlistListingPreview';
import {
  buildPendingPerpsWatchlistToken,
  buildPendingSpotWatchlistToken,
  shouldEmitNativePendingWatchlistRow,
} from './watchlistPendingRows';

describe('watchlistPendingRows', () => {
  afterEach(() => {
    clearWatchlistListingPreviews();
  });

  it('builds a removable spot identity before the batch quote arrives', () => {
    expect(
      buildPendingSpotWatchlistToken(
        {
          chainId: 'evm--1',
          contractAddress: '0xABC',
          isNative: false,
          sortIndex: 3,
        },
        new Map([['evm--1', 'https://example.com/eth.png']]),
      ),
    ).toMatchObject({
      id: 'evm--1:0xabc',
      address: '0xABC',
      networkId: 'evm--1',
      chainId: 'evm--1',
      sortIndex: 3,
      priceChangeRaw: '-',
      networkLogoUri: 'https://example.com/eth.png',
    });
  });

  it('keeps case-sensitive contract addresses so remove and detail nav still match', () => {
    expect(
      buildPendingSpotWatchlistToken(
        {
          chainId: 'sol--101',
          contractAddress: '6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx',
          isNative: false,
        },
        new Map(),
      ).address,
    ).toBe('6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx');
  });

  it('uses the starred preview for the pending spot title and logo', () => {
    const item = {
      chainId: 'evm--1',
      contractAddress: '0xabc',
      isNative: false,
    };
    rememberWatchlistListingPreview(item, {
      name: 'Pepe',
      symbol: 'PEPE',
      logoUrl: 'https://example.com/pepe.png',
    });
    expect(buildPendingSpotWatchlistToken(item, new Map())).toMatchObject({
      name: 'Pepe',
      symbol: 'PEPE',
      tokenImageUri: 'https://example.com/pepe.png',
      isPendingWatchlistRow: true,
    });
  });

  it('builds a perps identity from the stored coin before the universe arrives', () => {
    expect(
      buildPendingPerpsWatchlistToken({
        chainId: '',
        contractAddress: '',
        perpsCoin: 'xyz:AAPL',
        sortIndex: 1,
      }),
    ).toMatchObject({
      id: 'perps_xyz:AAPL',
      symbol: 'xyz:AAPL',
      perpsCoin: 'xyz:AAPL',
      sortIndex: 1,
      priceChangeRaw: '-',
      isPendingWatchlistRow: true,
    });
  });

  it('emits native pending rows while quotes are in flight, not after success or failure', () => {
    expect(
      shouldEmitNativePendingWatchlistRow({
        isNative: true,
        hasQuotesInFlight: true,
        hasQuotePayload: false,
        isIdentityUnqueried: true,
      }),
    ).toBe(true);
    expect(
      shouldEmitNativePendingWatchlistRow({
        isNative: true,
        hasQuotesInFlight: false,
        hasQuotePayload: false,
        isIdentityUnqueried: true,
      }),
    ).toBe(false);
    expect(
      shouldEmitNativePendingWatchlistRow({
        isNative: true,
        hasQuotesInFlight: true,
        hasQuotePayload: true,
        isIdentityUnqueried: true,
      }),
    ).toBe(true);
    expect(
      shouldEmitNativePendingWatchlistRow({
        isNative: true,
        hasQuotesInFlight: true,
        hasQuotePayload: true,
        isIdentityUnqueried: false,
      }),
    ).toBe(false);
    expect(
      shouldEmitNativePendingWatchlistRow({
        isNative: true,
        hasQuotesInFlight: false,
        hasQuotePayload: true,
        isIdentityUnqueried: true,
      }),
    ).toBe(false);
    expect(
      shouldEmitNativePendingWatchlistRow({
        isNative: false,
        hasQuotesInFlight: true,
        hasQuotePayload: true,
        isIdentityUnqueried: true,
      }),
    ).toBe(false);
  });
});

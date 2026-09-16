import {
  buildPendingPerpsWatchlistToken,
  buildPendingSpotWatchlistToken,
} from './watchlistPendingRows';

describe('watchlistPendingRows', () => {
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
      address: '0xabc',
      networkId: 'evm--1',
      chainId: 'evm--1',
      sortIndex: 3,
      priceChangeRaw: '-',
      networkLogoUri: 'https://example.com/eth.png',
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
    });
  });
});

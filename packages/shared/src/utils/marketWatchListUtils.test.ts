import { dedupeMarketWatchListItems } from './marketWatchListUtils';

describe('dedupeMarketWatchListItems', () => {
  test('dedupes spot tokens by normalized address without mutating source data', () => {
    const watchlist = [
      {
        chainId: 'evm--1',
        contractAddress: '0x390A684EF9CaDe28A7AD0DfA61AB1eB3842618c4',
        sortIndex: 1,
      },
      {
        chainId: 'evm--1',
        contractAddress: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        sortIndex: 2,
      },
    ];

    expect(dedupeMarketWatchListItems(watchlist)).toEqual([watchlist[0]]);
    expect(watchlist).toHaveLength(2);
  });

  test('dedupes native placeholder and canonical empty-address entries', () => {
    const watchlist = [
      {
        chainId: 'evm--1',
        contractAddress: '',
        isNative: true,
        sortIndex: 1,
      },
      {
        chainId: 'evm--1',
        contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        sortIndex: 2,
      },
    ];

    expect(dedupeMarketWatchListItems(watchlist)).toEqual([watchlist[0]]);
  });

  test('does not treat explicitly non-native placeholder-like entries as native', () => {
    const watchlist = [
      {
        chainId: 'evm--1',
        contractAddress: '',
        isNative: true,
        sortIndex: 1,
      },
      {
        chainId: 'evm--1',
        contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        isNative: false,
        sortIndex: 2,
      },
    ];

    expect(dedupeMarketWatchListItems(watchlist)).toEqual(watchlist);
  });

  test('keeps spot and perps identity domains separate', () => {
    const watchlist = [
      {
        chainId: 'evm--1',
        contractAddress: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        sortIndex: 1,
      },
      { chainId: '', contractAddress: '', perpsCoin: 'BTC', sortIndex: 2 },
      { chainId: '', contractAddress: '', perpsCoin: 'BTC', sortIndex: 3 },
    ];

    expect(dedupeMarketWatchListItems(watchlist)).toEqual([
      watchlist[0],
      watchlist[1],
    ]);
  });
});

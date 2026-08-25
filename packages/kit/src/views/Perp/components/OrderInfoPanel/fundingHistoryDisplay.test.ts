import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid';

import {
  type IFundingHistoryMarketOption,
  filterFundingHistoryRecords,
  formatFundingHistoryRate,
  getFundingHistoryMarketOptions,
  getFundingHistoryPaymentPresentation,
  getFundingHistorySide,
  reconcileFundingHistoryMarketOptions,
  searchFundingHistoryMarketOptions,
} from './fundingHistoryDisplay';

function createFundingRecord({
  coin,
  signedSize,
  time,
}: {
  coin: string;
  signedSize: string;
  time: number;
}): IUserFunding {
  return {
    time,
    hash: `0x${String(time).padStart(64, '0')}`,
    delta: {
      type: 'funding',
      coin,
      usdc: '1',
      szi: signedSize,
      fundingRate: '0.0001',
      nSamples: null,
    },
  };
}

describe('fundingHistoryDisplay', () => {
  it('derives the position side from signed size', () => {
    expect(getFundingHistorySide('1.25')).toBe('long');
    expect(getFundingHistorySide('-0.5')).toBe('short');
    expect(getFundingHistorySide('0')).toBe('none');
    expect(getFundingHistorySide('invalid')).toBe('none');
  });

  it('formats funding rates as percentages without losing small values', () => {
    expect(formatFundingHistoryRate('0.0000125')).toBe('0.001250%');
    expect(formatFundingHistoryRate('-0.001')).toBe('-0.1000%');
    expect(formatFundingHistoryRate('invalid')).toBe('--');
  });

  it('preserves whether a funding payment was received or paid', () => {
    expect(getFundingHistoryPaymentPresentation('1.25')).toEqual({
      absoluteAmount: '1.25',
      color: '$green11',
      sign: '+',
    });
    expect(getFundingHistoryPaymentPresentation('-0.75')).toEqual({
      absoluteAmount: '0.75',
      color: '$red11',
      sign: '-',
    });
  });

  it('builds unique sorted market options with dex labels', () => {
    const records = [
      createFundingRecord({ coin: 'xyz:USDJPY', signedSize: '1', time: 1 }),
      createFundingRecord({ coin: 'BTC', signedSize: '-1', time: 2 }),
      createFundingRecord({ coin: 'xyz:USDJPY', signedSize: '2', time: 3 }),
    ];

    expect(getFundingHistoryMarketOptions(records)).toEqual([
      { coin: 'BTC', label: 'BTC' },
      { coin: 'xyz:USDJPY', label: 'USDJPY (xyz)' },
    ]);
  });

  it('searches market names and dex labels case-insensitively', () => {
    const options = [
      { coin: 'BTC', label: 'BTC' },
      { coin: 'xyz:USDJPY', label: 'USDJPY (xyz)' },
    ];

    expect(
      searchFundingHistoryMarketOptions({ options, searchText: 'usdjpy' }),
    ).toEqual([{ coin: 'xyz:USDJPY', label: 'USDJPY (xyz)' }]);
    expect(
      searchFundingHistoryMarketOptions({ options, searchText: 'XYZ' }),
    ).toEqual([{ coin: 'xyz:USDJPY', label: 'USDJPY (xyz)' }]);
  });

  it('preserves market option state when derived content is unchanged', () => {
    const emptyOptions: IFundingHistoryMarketOption[] = [];
    const currentOptions = [{ coin: 'BTC', label: 'BTC' }];
    const equalOptions = [{ coin: 'BTC', label: 'BTC' }];
    const changedOptions = [{ coin: 'ETH', label: 'ETH' }];

    expect(
      reconcileFundingHistoryMarketOptions({
        currentOptions: emptyOptions,
        nextOptions: [],
      }),
    ).toBe(emptyOptions);
    expect(
      reconcileFundingHistoryMarketOptions({
        currentOptions,
        nextOptions: equalOptions,
      }),
    ).toBe(currentOptions);
    expect(
      reconcileFundingHistoryMarketOptions({
        currentOptions,
        nextOptions: changedOptions,
      }),
    ).toBe(changedOptions);
  });

  it('combines side and exact market filters', () => {
    const btcLong = createFundingRecord({
      coin: 'BTC',
      signedSize: '1',
      time: 1,
    });
    const btcShort = createFundingRecord({
      coin: 'BTC',
      signedSize: '-1',
      time: 2,
    });
    const ethLong = createFundingRecord({
      coin: 'ETH',
      signedSize: '1',
      time: 3,
    });

    expect(
      filterFundingHistoryRecords({
        records: [btcLong, btcShort, ethLong],
        sideFilter: 'long',
        marketFilter: 'BTC',
      }),
    ).toEqual([btcLong]);
  });
});

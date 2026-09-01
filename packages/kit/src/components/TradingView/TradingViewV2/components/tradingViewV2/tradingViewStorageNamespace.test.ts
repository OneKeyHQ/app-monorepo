import { resolveTradingViewStorageNamespace } from './tradingViewStorageNamespace';

describe('resolveTradingViewStorageNamespace', () => {
  it('uses the regular market namespace by default', () => {
    expect(
      resolveTradingViewStorageNamespace({
        forceCandlestickChart: false,
      }),
    ).toBe('market');
  });

  it('isolates forced candlestick settings from user chart preferences', () => {
    expect(
      resolveTradingViewStorageNamespace({
        storageNamespace: ' market ',
        forceCandlestickChart: true,
      }),
    ).toBe('market-forced-candlestick');
  });

  it('does not append the forced namespace suffix twice', () => {
    expect(
      resolveTradingViewStorageNamespace({
        storageNamespace: 'market-forced-candlestick',
        forceCandlestickChart: true,
      }),
    ).toBe('market-forced-candlestick');
  });
});

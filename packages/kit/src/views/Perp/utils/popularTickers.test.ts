import {
  type IPopularTickerItem,
  pickPopularPerpTickers,
} from './popularTickers';

function createTicker(coinName: string, hotScore: number): IPopularTickerItem {
  return {
    mode: 'perp',
    coinName,
    displayName: coinName,
    imageTokenName: coinName,
    assetId: 0,
    dexIndex: 0,
    hotScore,
  };
}

describe('pickPopularPerpTickers', () => {
  it('uses server hot tab token order when it matches known perps', () => {
    const items = [
      createTicker('BTC', 10),
      createTicker('ETH', 20),
      createTicker('SOL', 0),
    ];

    expect(
      pickPopularPerpTickers({
        items,
        hotTabTokens: ['SOL', 'BTC'],
      }).map((item) => item.coinName),
    ).toEqual(['SOL', 'BTC']);
  });

  it('falls back to hot score when the hot tab is missing or unmatched', () => {
    const items = [
      createTicker('BTC', 10),
      createTicker('ETH', 20),
      createTicker('SOL', 0),
    ];

    expect(
      pickPopularPerpTickers({
        items,
        hotTabTokens: ['UNKNOWN'],
      }).map((item) => item.coinName),
    ).toEqual(['ETH', 'BTC']);
  });
});

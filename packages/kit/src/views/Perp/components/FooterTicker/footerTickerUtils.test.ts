import {
  getFooterTickerStructureKey,
  mergeFooterTickerLiveValues,
  shouldAnimateFooterTicker,
} from './footerTickerUtils';

import type { IFooterTickerItemData } from './footerTickerUtils';

function createItem(
  overrides: Partial<IFooterTickerItemData>,
): IFooterTickerItemData {
  return {
    displayName: 'BTC',
    coinName: 'BTC',
    dexIndex: 0,
    assetId: 0,
    mode: 'perp',
    change24hPercent: 1,
    markPrice: '100',
    ...overrides,
  };
}

describe('footerTickerUtils', () => {
  test('structure key ignores live price changes', () => {
    const first = createItem({});
    const updated = createItem({
      change24hPercent: 2,
      markPrice: '101',
    });

    expect(getFooterTickerStructureKey([first])).toBe(
      getFooterTickerStructureKey([updated]),
    );
  });

  test('structure key changes when the display order changes', () => {
    const btc = createItem({});
    const eth = createItem({
      displayName: 'ETH',
      coinName: 'ETH',
      assetId: 1,
    });

    expect(getFooterTickerStructureKey([btc, eth])).not.toBe(
      getFooterTickerStructureKey([eth, btc]),
    );
  });

  test('updates live values without changing the displayed structure', () => {
    const btc = createItem({});
    const eth = createItem({
      displayName: 'ETH',
      coinName: 'ETH',
      assetId: 1,
      markPrice: '200',
    });
    const next = mergeFooterTickerLiveValues({
      displayItems: [btc, eth],
      latestItems: [
        createItem({
          displayName: 'ETH',
          coinName: 'ETH',
          assetId: 1,
          change24hPercent: 3,
          markPrice: '201',
        }),
        createItem({
          change24hPercent: 2,
          markPrice: '101',
        }),
      ],
    });

    expect(next.map((item) => item.coinName)).toEqual(['BTC', 'ETH']);
    expect(next.map((item) => item.markPrice)).toEqual(['101', '201']);
  });

  test('keeps displayed items that temporarily disappear', () => {
    const btc = createItem({});

    expect(
      mergeFooterTickerLiveValues({
        displayItems: [btc],
        latestItems: [],
      }),
    ).toEqual([btc]);
  });

  test('disables the marquee when reduced motion is requested', () => {
    expect(
      shouldAnimateFooterTicker({
        contentWidth: 1000,
        containerWidth: 500,
        prefersReducedMotion: true,
      }),
    ).toBe(false);
    expect(
      shouldAnimateFooterTicker({
        contentWidth: 1000,
        containerWidth: 500,
        prefersReducedMotion: false,
      }),
    ).toBe(true);
  });
});

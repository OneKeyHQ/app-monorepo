import {
  getFooterTickerItemKey,
  getFooterTickerStructureKey,
  isFooterTickerTextWithinBudget,
  mergeFooterTickerLiveValues,
  shouldAnimateFooterTicker,
} from './footerTickerUtils';

import type {
  IFooterTickerItemData,
  IFooterTickerTextWidthBudgetMap,
} from './footerTickerUtils';

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

function createWidthBudgets(
  items: IFooterTickerItemData[],
): IFooterTickerTextWidthBudgetMap {
  return Object.fromEntries(
    items.map((item) => [
      getFooterTickerItemKey(item),
      {
        itemWidth: 120,
        changeText: '+1.00%',
        changeWidth: 60,
        priceText: '100',
        priceWidth: 30,
      },
    ]),
  );
}

const measureText = (text: string) => text.length * 10;

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

  test('accepts a longer text when its measured pixel width still fits', () => {
    expect(
      isFooterTickerTextWithinBudget({
        text: '1234',
        baseText: '999',
        width: 40,
        measureText,
      }),
    ).toBe(true);
  });

  test('updates safe live values without changing the displayed structure', () => {
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
      widthBudgets: createWidthBudgets([btc, eth]),
      measureText,
    });

    expect(next.map((item) => item.coinName)).toEqual(['BTC', 'ETH']);
    expect(next.map((item) => item.markPrice)).toEqual(['101', '201']);
    expect(next.map((item) => item.change24hPercent)).toEqual([2, 3]);
  });

  test('keeps the previous safe live value when the latest value exceeds its pixel budget', () => {
    const snapshot = createItem({ markPrice: '100' });
    const previous = createItem({ markPrice: '101' });
    const latest = createItem({ markPrice: '10000' });

    expect(
      mergeFooterTickerLiveValues({
        displayItems: [snapshot],
        latestItems: [latest],
        previousLiveItems: [previous],
        widthBudgets: createWidthBudgets([snapshot]),
        measureText,
      }),
    ).toEqual([previous]);
  });

  test('keeps the snapshot when no safe live value exists', () => {
    const snapshot = createItem({ markPrice: '100' });
    const latest = createItem({ markPrice: '10000' });

    expect(
      mergeFooterTickerLiveValues({
        displayItems: [snapshot],
        latestItems: [latest],
        widthBudgets: createWidthBudgets([snapshot]),
        measureText,
      }),
    ).toEqual([snapshot]);
  });

  test('keeps the previous value when an item disappears temporarily', () => {
    const snapshot = createItem({ markPrice: '100' });
    const previous = createItem({ markPrice: '101' });

    expect(
      mergeFooterTickerLiveValues({
        displayItems: [snapshot],
        latestItems: [],
        previousLiveItems: [previous],
        widthBudgets: createWidthBudgets([snapshot]),
        measureText,
      }),
    ).toEqual([previous]);
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

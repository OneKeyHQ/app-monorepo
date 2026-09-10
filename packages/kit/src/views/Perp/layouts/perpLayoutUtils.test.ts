import {
  PERP_DESKTOP_CHART_MIN_HEIGHT,
  PERP_DESKTOP_INFO_MIN_HEIGHT,
  getPerpDesktopChartSplitSizes,
  getVerticalOrderBookLayout,
  resetPerpDesktopLeftSplit,
} from './perpLayoutUtils';

describe('resetPerpDesktopLeftSplit', () => {
  it('clears the persisted chart split and order book visibility', () => {
    expect(
      resetPerpDesktopLeftSplit({
        chartExpanded: false,
        chartHeight: 700,
        orderBook: { visible: false },
      }),
    ).toEqual({
      chartExpanded: false,
    });
  });
});

describe('getPerpDesktopChartSplitSizes', () => {
  const layout = {
    marketContentHeight: 588,
    bottomPanelHeight: 480,
  };

  it('uses the responsive layout heights by default', () => {
    expect(getPerpDesktopChartSplitSizes(layout)).toEqual([588, 480]);
  });

  it('restores a saved chart height without changing the total height', () => {
    expect(
      getPerpDesktopChartSplitSizes({
        ...layout,
        savedChartHeight: 700,
      }),
    ).toEqual([700, 368]);
  });

  it('keeps both panes usable when the saved size is out of bounds', () => {
    expect(
      getPerpDesktopChartSplitSizes({
        ...layout,
        savedChartHeight: 10_000,
      }),
    ).toEqual([
      1068 - PERP_DESKTOP_INFO_MIN_HEIGHT,
      PERP_DESKTOP_INFO_MIN_HEIGHT,
    ]);
    expect(
      getPerpDesktopChartSplitSizes({
        ...layout,
        savedChartHeight: 0,
      }),
    ).toEqual([
      PERP_DESKTOP_CHART_MIN_HEIGHT,
      1068 - PERP_DESKTOP_CHART_MIN_HEIGHT,
    ]);
  });
});

describe('getVerticalOrderBookLayout', () => {
  it('preserves the existing layout for other platforms', () => {
    expect(getVerticalOrderBookLayout(640, 18).rowHeight).toBeCloseTo(22.12, 5);
    expect(getVerticalOrderBookLayout(660, 18).extraBidLevels).toBe(1);
  });
  it.each([
    [640, 18, 12],
    [660, 18, 12],
    [682, 18, 12],
    [683, 18, 13],
    [1000, 12, 12],
  ])(
    'keeps fixed row geometry and symmetric sides at height %i',
    (height, cap, levels) => {
      expect(getVerticalOrderBookLayout(height, cap, true)).toEqual({
        levelsPerSide: levels,
        extraBidLevels: 0,
        rowHeight: 22,
      });
    },
  );
});

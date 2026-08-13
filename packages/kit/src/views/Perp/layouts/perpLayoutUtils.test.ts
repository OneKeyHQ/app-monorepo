import {
  PERP_DESKTOP_CHART_MIN_HEIGHT,
  PERP_DESKTOP_INFO_MIN_HEIGHT,
  getPerpDesktopChartSplitSizes,
  getVerticalOrderBookLayout,
  resetPerpDesktopLeftSplit,
} from './perpLayoutUtils';

describe('resetPerpDesktopLeftSplit', () => {
  it('clears only the persisted chart split height', () => {
    expect(
      resetPerpDesktopLeftSplit({
        chartExpanded: false,
        chartHeight: 700,
        orderBook: { visible: false },
      }),
    ).toEqual({
      chartExpanded: false,
      orderBook: { visible: false },
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
  it('spreads the leftover height evenly so the pane has no bottom gap', () => {
    const layout = getVerticalOrderBookLayout(640, 18);
    expect(layout.levelsPerSide).toBe(12);
    expect(layout.extraBidLevels).toBe(0);
    // 25 rows * (22.12 + 1) fills the 578px book body exactly.
    expect(layout.rowHeight).toBeCloseTo(22.12, 5);
  });

  it('gives the spare row to the bid side when exactly one more fits', () => {
    expect(getVerticalOrderBookLayout(660, 18)).toEqual({
      levelsPerSide: 12,
      extraBidLevels: 1,
      rowHeight: 22,
    });
  });

  it('never exceeds maxLevelsPerSide with the extra bid row', () => {
    const layout = getVerticalOrderBookLayout(660, 12);
    expect(layout.levelsPerSide).toBe(12);
    expect(layout.extraBidLevels).toBe(0);
    expect(layout.rowHeight).toBeCloseTo(22.92, 5);
  });

  it('stretches rows to fill the pane once the level cap is reached', () => {
    const layout = getVerticalOrderBookLayout(1000, 12);
    expect(layout.levelsPerSide).toBe(12);
    expect(layout.extraBidLevels).toBe(0);
    expect(layout.rowHeight).toBeCloseTo(36.52, 5);
  });
});

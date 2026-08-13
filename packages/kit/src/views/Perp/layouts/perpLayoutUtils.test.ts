import {
  PERP_DESKTOP_CHART_MIN_HEIGHT,
  PERP_DESKTOP_INFO_MIN_HEIGHT,
  getPerpDesktopChartSplitSizes,
  getVerticalOrderBookLayout,
} from './perpLayoutUtils';

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
  it('keeps the row height fixed and varies only the level count', () => {
    expect(getVerticalOrderBookLayout(640, 18)).toEqual({
      levelsPerSide: 12,
      extraBidLevels: 0,
      rowHeight: 22,
    });
  });

  it('gives the spare row to the bid side when exactly one more fits', () => {
    expect(getVerticalOrderBookLayout(660, 18)).toEqual({
      levelsPerSide: 12,
      extraBidLevels: 1,
      rowHeight: 22,
    });
  });

  it('never exceeds maxLevelsPerSide with the extra bid row', () => {
    expect(getVerticalOrderBookLayout(660, 12)).toEqual({
      levelsPerSide: 12,
      extraBidLevels: 0,
      rowHeight: 22,
    });
  });

  it('stretches rows to fill the pane once the level cap is reached', () => {
    expect(getVerticalOrderBookLayout(1000, 12)).toEqual({
      levelsPerSide: 12,
      extraBidLevels: 0,
      rowHeight: 36,
    });
  });
});

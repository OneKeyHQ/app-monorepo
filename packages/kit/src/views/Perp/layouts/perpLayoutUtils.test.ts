import {
  PERP_DESKTOP_CHART_MIN_HEIGHT,
  PERP_DESKTOP_INFO_MIN_HEIGHT,
  PERP_DESKTOP_TRADING_PANEL_MIN_HEIGHT,
  getPerpDesktopChartSplitSizes,
  getPerpDesktopMainSplitSizes,
  getPerpDesktopTradingSplitSizes,
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
    const sizes = getPerpDesktopChartSplitSizes({
      ...layout,
      savedChartHeight: 640,
    });

    expect(sizes).toEqual([640, 428]);
    expect(sizes[0] + sizes[1]).toBe(1068);
  });

  it('keeps both panes usable when the saved size is out of bounds', () => {
    expect(
      getPerpDesktopChartSplitSizes({
        ...layout,
        savedChartHeight: 0,
      }),
    ).toEqual([
      PERP_DESKTOP_CHART_MIN_HEIGHT,
      1068 - PERP_DESKTOP_CHART_MIN_HEIGHT,
    ]);
    expect(
      getPerpDesktopChartSplitSizes({
        ...layout,
        savedChartHeight: 10_000,
      }),
    ).toEqual([
      1068 - PERP_DESKTOP_INFO_MIN_HEIGHT,
      PERP_DESKTOP_INFO_MIN_HEIGHT,
    ]);
  });
});

describe('getPerpDesktopMainSplitSizes', () => {
  it('uses the existing trading panel width by default', () => {
    expect(
      getPerpDesktopMainSplitSizes({
        availableWidth: 1512,
        defaultTradingWidth: 320,
      }),
    ).toEqual([1192, 320]);
  });

  it('restores and clamps the saved trading panel width', () => {
    expect(
      getPerpDesktopMainSplitSizes({
        availableWidth: 1512,
        defaultTradingWidth: 320,
        savedTradingWidth: 100,
      }),
    ).toEqual([1192, 320]);
    expect(
      getPerpDesktopMainSplitSizes({
        availableWidth: 1512,
        defaultTradingWidth: 320,
        savedTradingWidth: 420,
      }),
    ).toEqual([1092, 420]);
    expect(
      getPerpDesktopMainSplitSizes({
        availableWidth: 900,
        defaultTradingWidth: 320,
        savedTradingWidth: 10_000,
      }),
    ).toEqual([400, 500]);
  });

  it('clamps the saved trading width against a widened market minimum', () => {
    expect(
      getPerpDesktopMainSplitSizes({
        availableWidth: 1100,
        defaultTradingWidth: 320,
        savedTradingWidth: 500,
        marketMinWidth: 680,
      }),
    ).toEqual([680, 420]);
  });
});

describe('getPerpDesktopTradingSplitSizes', () => {
  const layout = {
    marketContentHeight: 588,
    bottomPanelHeight: 480,
  };

  it('uses the existing trading and account panel heights by default', () => {
    expect(getPerpDesktopTradingSplitSizes(layout)).toEqual([588, 480]);
  });

  it('restores a saved trading panel height while keeping both panes usable', () => {
    expect(
      getPerpDesktopTradingSplitSizes({
        ...layout,
        savedTradingPanelHeight: 700,
      }),
    ).toEqual([700, 368]);
    expect(
      getPerpDesktopTradingSplitSizes({
        ...layout,
        savedTradingPanelHeight: 0,
      }),
    ).toEqual([
      PERP_DESKTOP_TRADING_PANEL_MIN_HEIGHT,
      1068 - PERP_DESKTOP_TRADING_PANEL_MIN_HEIGHT,
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
});

import type { IStockSimpleChartRange } from '../../components/StockSimpleChart';

// Shared by the stock and Top Coins detail charts so the two toolbars cannot
// drift apart. Both render the same 456px chart block: a 40px toolbar row, a
// 16px gap, then the 400px simple chart.

// Pro drops the toolbar row and lays the Simple/Pro switch over the trailing
// edge of the TradingView widget's own interval row instead. Both that row and
// the Simple toolbar inset their contents by 4px from the top of the chart
// block, so one offset puts the switch on the widget's line in Pro and leaves
// it in exactly the same place when the mode is toggled.
export const MARKET_CHART_TOOLBAR_VERTICAL_INSET = 4;

// Minimum widths sized for the Latin labels (Figma design grid); CJK locales
// render wider labels ("全部"), so buttons grow beyond these instead of
// wrapping the text.
export const MARKET_SIMPLE_CHART_RANGE_WIDTHS: Record<
  IStockSimpleChartRange,
  number
> = {
  '1H': 33,
  '1D': 33,
  '1W': 37,
  '1M': 35,
  '1Y': 32,
  All: 34,
};

// Minimum, for the same reason as the per-button widths above.
export const MARKET_SIMPLE_CHART_RANGE_ROW_WIDTH = 214;

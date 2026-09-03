import type { IStockSimpleChartRange } from '../../components/StockSimpleChart';

// Shared by the stock and Top Coins detail charts so the two toolbars cannot
// drift apart. Both render the same chart block (456px by default, user
// resizable): a 40px toolbar row, a 16px gap, then the simple chart.

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

// Gap between range buttons (gap="$0.5"), used to derive the row's minimum
// width from the visible ranges.
export const MARKET_SIMPLE_CHART_RANGE_GAP = 2;

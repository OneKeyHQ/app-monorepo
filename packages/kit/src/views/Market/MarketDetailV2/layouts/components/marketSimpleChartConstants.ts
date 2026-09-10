// Shared by the stock and Top Coins detail charts so the two toolbars cannot
// drift apart: a resizable chart block, then a 40px toolbar row under it.

// Pro's remaining overlay controls (chart type, fullscreen) sit on the
// TradingView widget's own interval row, inset 4px from the top of the chart
// block so they land on the widget's line.
export const MARKET_CHART_TOOLBAR_VERTICAL_INSET = 4;

// A single minimum for every range button. It is a floor, not a fixed width:
// CJK locales render wider labels ("全部") and grow past it rather than
// wrapping or truncating.
export const MARKET_SIMPLE_CHART_RANGE_MIN_WIDTH = 36;

// Gap between range buttons (gap="$0.5"), used to derive the row's minimum
// width from the visible ranges.
export const MARKET_SIMPLE_CHART_RANGE_GAP = 2;

// The toolbar row under the chart. The gap above it belongs to the chart
// container, which parks the resize handle's line between the two.
export const MARKET_CHART_TOOLBAR_HEIGHT = 40;

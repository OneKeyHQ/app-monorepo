// Use the same version as defined in package.json
export const LIGHTWEIGHT_CHARTS_VERSION = '5.2.0';

export const DEFAULT_CHART_COLORS = {
  lineColor: '#33C641',
  topColor: '#00B81233',
  bottomColor: '#00FF1900',
};

// APY charts render a visible price scale. lightweight-charts defaults
// `entireTextOnly` to false, which paints the top/bottom corner labels even
// when the pane edge cuts them in half, and its default bottom scale margin
// (0.1) leaves the last label barely any room (OK-61138). Keep the top margin
// at the library default so the curve keeps its usual headroom.
export const APY_PRICE_SCALE_MARGINS = { top: 0.2, bottom: 0.15 };

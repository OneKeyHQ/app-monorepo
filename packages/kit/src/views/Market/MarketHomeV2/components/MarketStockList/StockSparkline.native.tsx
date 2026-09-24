import { memo } from 'react';

// The day range sparkline is a column of the desktop web Stocks table only;
// native never renders it. This stub keeps the canvas-based chart (and
// react-native-canvas) out of the native bundle.
function StockSparklineImpl(_props: {
  data?: number[];
  priceChange24hPercent?: string;
}) {
  return null;
}

export const StockSparkline = memo(StockSparklineImpl);

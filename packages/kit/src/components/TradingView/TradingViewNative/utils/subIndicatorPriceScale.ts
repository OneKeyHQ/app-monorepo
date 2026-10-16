import { resolveTradingViewNativePriceRange } from './priceScale';
import { getTradingViewNativeSubIndicatorAxisLabel } from './subIndicatorRender/coordinates';
import {
  getTradingViewNativeSubIndicatorPaneLayouts,
  getTradingViewNativeSubIndicatorPaneStackLayout,
} from './subIndicatorRender/layout';
import { getTradingViewNativeSubIndicatorValueRange } from './subIndicatorRender/range';

import type { ITradingViewNativePriceRange } from './chartViewport';
import type { ITradingViewNativeSubIndicatorRenderPane } from './subIndicatorRender/types';
import type { ITradingViewNativePriceScaleMode } from '../types';

export interface ITradingViewNativeSubIndicatorPriceScale {
  mode: ITradingViewNativePriceScaleMode;
  pinnedPriceRange: ITradingViewNativePriceRange | null;
  rangeScale: number;
}

export type ITradingViewNativeSubIndicatorPriceScales = Partial<
  Record<string, ITradingViewNativeSubIndicatorPriceScale>
>;

export function getTradingViewNativeSubIndicatorAutoPriceRange(
  options: Parameters<typeof getTradingViewNativeSubIndicatorValueRange>[0],
): ITradingViewNativePriceRange | null {
  'worklet';

  const range = getTradingViewNativeSubIndicatorValueRange(options);
  return range ? { minPrice: range.minValue, maxPrice: range.maxValue } : null;
}

export function applyTradingViewNativeSubIndicatorPriceScales(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
  scales: ITradingViewNativeSubIndicatorPriceScales,
): readonly ITradingViewNativeSubIndicatorRenderPane[] {
  'worklet';

  return panes.map((pane) => {
    const scale = scales[pane.instanceId];
    if (!scale) return pane;
    if (!scale.pinnedPriceRange) {
      return scale.mode === 'logarithmic'
        ? { ...pane, priceScaleMode: scale.mode }
        : pane;
    }
    const range = resolveTradingViewNativePriceRange({
      autoPriceRange: scale.pinnedPriceRange,
      rangeScale: scale.rangeScale,
      requestedMode: scale.mode,
    });
    return {
      ...pane,
      priceScaleMode: range.mode,
      scale: {
        kind: 'fixed',
        minValue: range.minPrice,
        maxValue: range.maxPrice,
      },
    };
  });
}

export function getTradingViewNativeScaledSubIndicatorAxisLabel(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
  scales: ITradingViewNativeSubIndicatorPriceScales,
) {
  'worklet';

  return getTradingViewNativeSubIndicatorAxisLabel(
    applyTradingViewNativeSubIndicatorPriceScales(
      panes.filter((pane) => scales[pane.instanceId]?.pinnedPriceRange),
      scales,
    ),
  );
}

export function getTradingViewNativeSubIndicatorPriceAxisLayouts({
  height,
  panes,
  timeAxisHeight,
}: {
  height: number;
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  timeAxisHeight: number;
}) {
  'worklet';

  const stack = getTradingViewNativeSubIndicatorPaneStackLayout({
    height,
    paneCount: panes.length,
    panes,
    timeAxisHeight,
  });
  return getTradingViewNativeSubIndicatorPaneLayouts({
    panes,
    stackBottom: stack.bottom,
    stackTop: stack.top,
    startIndex: 0,
    endIndex: 0,
  });
}

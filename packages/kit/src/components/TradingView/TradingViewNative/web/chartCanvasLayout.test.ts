/**
 * @jest-environment jsdom
 */

import {
  getTradingViewNativeCanvasPriceAxisWidth,
  isTradingViewNativeCanvasMainPriceAxisPointer,
} from './chartCanvasLayout';

import type { ITradingViewNativeCanvasPriceAxisLabels } from './chartCanvasLayout';

const LABELS: ITradingViewNativeCanvasPriceAxisLabels = {
  autoPriceRange: { maxPrice: 200, minPrice: 100 },
  currentPrice: '150.00',
  widestIndicatorPrice: '',
  widestPrice: '888.88',
  widestSubIndicator: '',
  widestVolume: '',
  yAxisVisible: true,
};

function createCanvas() {
  return {
    getBoundingClientRect: () =>
      ({
        bottom: 420,
        height: 400,
        left: 10,
        right: 330,
        top: 20,
        width: 320,
        x: 10,
        y: 20,
      }) as DOMRect,
    getContext: () => ({
      font: '',
      measureText: (label: string) => ({ width: label.length * 6 }),
    }),
  } as unknown as HTMLCanvasElement;
}

describe('TradingViewNative web canvas layout', () => {
  it('grows the price axis for labels introduced by manual scaling', () => {
    const canvas = createCanvas();
    const autoWidth = getTradingViewNativeCanvasPriceAxisWidth(canvas, LABELS, {
      mode: 'linear',
      rangeScale: 1,
    });
    const expandedWidth = getTradingViewNativeCanvasPriceAxisWidth(
      canvas,
      LABELS,
      { mode: 'linear', rangeScale: 10 },
    );

    expect(expandedWidth).toBeGreaterThan(autoWidth);
  });

  it('limits price-axis interaction to the main chart pane', () => {
    const input = {
      canvas: createCanvas(),
      clientX: 329,
      labels: LABELS,
      paneCount: 2,
      priceScale: { mode: 'linear' as const, rangeScale: 1 },
    };

    expect(
      isTradingViewNativeCanvasMainPriceAxisPointer({
        ...input,
        clientY: 200,
      }),
    ).toBe(true);
    expect(
      isTradingViewNativeCanvasMainPriceAxisPointer({
        ...input,
        clientY: 320,
      }),
    ).toBe(false);
  });
});

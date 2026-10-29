/**
 * @jest-environment jsdom
 */

import { formatTradingViewNativePriceTick } from '../utils/chartLayout';

import {
  getTradingViewNativeCanvasPriceAxisWidth,
  isTradingViewNativeCanvasMainPriceAxisPointer,
} from './chartCanvasLayout';

import type { ITradingViewNativeCanvasPriceAxisLabels } from './chartCanvasLayout';

const LABELS: ITradingViewNativeCanvasPriceAxisLabels = {
  autoPriceRange: { maxPrice: 200, minPrice: 100 },
  chartComponentPrice: '',
  currentPrice: '150.00',
  widestIndicatorPrice: '',
  widestPrice: '888.88',
  widestSubIndicator: '',
  widestVolume: '',
  yAxisVisible: true,
};

function createCanvas(options?: {
  scaleWithFont?: boolean;
  priceKerning?: boolean;
}) {
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
      measureText(label: string) {
        const fontSize = options?.scaleWithFont ? parseFloat(this.font) : 12;
        const kerning = options?.priceKerning
          ? (label.match(/11/g)?.length ?? 0)
          : 0;
        return { width: label.length * (fontSize / 2) - kerning };
      },
    }),
  } as unknown as HTMLCanvasElement;
}

describe('TradingViewNative web canvas layout', () => {
  it('keeps plot width stable across live price kerning and trimmed decimal zeros', () => {
    const canvas = createCanvas({ priceKerning: true });
    const labels = {
      ...LABELS,
      autoPriceRange: { minPrice: 79_184, maxPrice: 81_014 },
      priceDecimalPlaces: 1,
      widestPrice: '88888.8',
    };
    const priceScale = { mode: 'linear' as const, rangeScale: 1 };
    const widthFor = (price: number) =>
      getTradingViewNativeCanvasPriceAxisWidth(
        canvas,
        {
          ...labels,
          currentPrice: formatTradingViewNativePriceTick(price, 4, 1),
        },
        priceScale,
      );
    expect(formatTradingViewNativePriceTick(80_311, 4, 1)).toBe('80311');
    expect(widthFor(80_311.1)).toBe(widthFor(80_311));
    expect(widthFor(80_311)).toBe(widthFor(80_310));
    expect(widthFor(81_111)).toBe(widthFor(80_888));
    expect(widthFor(100_000)).toBeGreaterThan(widthFor(80_310));
  });

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
    expect(
      isTradingViewNativeCanvasMainPriceAxisPointer({
        ...input,
        clientY: 287,
        timeAxisHeight: 20,
      }),
    ).toBe(true);
    expect(
      isTradingViewNativeCanvasMainPriceAxisPointer({
        ...input,
        clientY: 288,
        timeAxisHeight: 20,
      }),
    ).toBe(false);
  });

  it('hit-tests the price axis with the compact font it is rendered with', () => {
    const canvas = createCanvas({ scaleWithFont: true });
    const labels = { ...LABELS, widestPrice: '88888888.88' };
    const priceScale = { mode: 'linear' as const, rangeScale: 1 };
    const defaultWidth = getTradingViewNativeCanvasPriceAxisWidth(
      canvas,
      labels,
      priceScale,
    );
    const compactWidth = getTradingViewNativeCanvasPriceAxisWidth(
      canvas,
      labels,
      priceScale,
      11,
    );
    expect(compactWidth).toBeLessThan(defaultWidth);

    // Inside the default-font axis but outside the compact one.
    const canvasRect = canvas.getBoundingClientRect();
    const input = {
      canvas,
      clientX:
        canvasRect.left + canvasRect.width - (defaultWidth + compactWidth) / 2,
      clientY: 200,
      labels,
      paneCount: 1,
      priceScale,
    };

    expect(isTradingViewNativeCanvasMainPriceAxisPointer(input)).toBe(true);
    expect(
      isTradingViewNativeCanvasMainPriceAxisPointer({
        ...input,
        priceAxisFontSize: 11,
      }),
    ).toBe(false);
  });
});

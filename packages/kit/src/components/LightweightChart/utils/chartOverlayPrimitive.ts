import type { ILightweightChartOverlay } from '../types';
import type {
  AutoscaleInfo,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts';

// Mirrored in htmlTemplate.ts (createOverlayPrimitive) for the native
// WebView; keep the two drawing the same way. Handles for a draggable band
// (the two edges and the one between them that moves it whole) are web only,
// as dragging is.

type IRenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

// Space between adjacent liquidity bars, in px
const BAR_GAP = 1;
// Bars stop this far short of the strip's left edge, in px
const STRIP_INSET = 2;
const MARKER_DASH = [3, 3];
// A draggable edge's grab handle, in px: a pill with two grip lines
const HANDLE_WIDTH = 24;
const HANDLE_HEIGHT = 12;
const GRIP_WIDTH = 10;
const GRIP_GAP = 3;
// Where the handle sits when there is no strip: this far in from the right
const HANDLE_RIGHT_INSET = 16;
// The handle between the edges that moves the band whole: three dots, as the
// phone's range chart draws it. Left out when the edges sit too close.
const MOVE_HANDLE_DOT = 3;
const MOVE_HANDLE_DOT_GAP = 3;
const MOVE_HANDLE_MIN_BAND = HANDLE_HEIGHT * 4;

function isOpenLow(low: number | undefined) {
  return low === undefined || !Number.isFinite(low) || low <= 0;
}

function isOpenHigh(high: number | undefined) {
  return high === undefined || !Number.isFinite(high) || high <= 0;
}

/**
 * Draws a price band across the plot and a depth profile along its right
 * edge, under the series. Attached to the main series, so both follow its
 * price scale.
 */
export class ChartOverlayPrimitive implements ISeriesPrimitive<Time> {
  private options: ILightweightChartOverlay;

  private params: SeriesAttachedParameter<Time> | null = null;

  // The library caches views by array identity
  private readonly views: readonly IPrimitivePaneView[];

  // A draggable band's edge prices on the price axis
  private readonly axisViews: readonly ISeriesPrimitiveAxisView[];

  constructor(options: ILightweightChartOverlay | undefined) {
    this.options = options ?? {};
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) => this.drawOverlay(target),
    };
    this.views = [{ zOrder: () => 'bottom', renderer: () => renderer }];
    this.axisViews = (['high', 'low'] as const).map((edge) => ({
      coordinate: () => {
        const price = this.getEdgePrice(edge);
        return price === undefined
          ? -1
          : (this.params?.series.priceToCoordinate(price) ?? -1);
      },
      text: () => {
        const price = this.getEdgePrice(edge);
        return price === undefined || !this.params
          ? ''
          : this.params.series.priceFormatter().format(price);
      },
      textColor: () => this.options.priceBand?.handleTextColor ?? '#fff',
      backColor: () =>
        this.options.priceBand?.handleColor ??
        this.options.priceBand?.lineColor ??
        'transparent',
      visible: () => this.getEdgePrice(edge) !== undefined,
      tickVisible: () => false,
    }));
  }

  /** A finite edge of a draggable band, else undefined */
  private getEdgePrice(edge: 'low' | 'high') {
    const band = this.options.priceBand;
    if (!band?.draggable) {
      return undefined;
    }
    if (edge === 'low') {
      return isOpenLow(band.low) ? undefined : band.low;
    }
    return isOpenHigh(band.high) ? undefined : band.high;
  }

  attached(params: SeriesAttachedParameter<Time>) {
    this.params = params;
  }

  detached() {
    this.params = null;
  }

  paneViews() {
    return this.views;
  }

  priceAxisViews() {
    return this.axisViews;
  }

  autoscaleInfo(): AutoscaleInfo | null {
    const band = this.options.priceBand;
    if (!band?.includeInAutoscale) {
      return null;
    }
    const prices = [
      isOpenLow(band.low) ? undefined : band.low,
      isOpenHigh(band.high) ? undefined : band.high,
    ].filter((price): price is number => price !== undefined);
    if (!prices.length) {
      return null;
    }
    return {
      priceRange: {
        minValue: Math.min(...prices),
        maxValue: Math.max(...prices),
      },
    };
  }

  setOptions(options: ILightweightChartOverlay | undefined) {
    this.options = options ?? {};
    this.params?.requestUpdate();
  }

  private drawOverlay(target: IRenderTarget) {
    const series = this.params?.series;
    if (!series) {
      return;
    }
    const { priceBand, sideHistogram } = this.options;
    target.useBitmapCoordinateSpace(
      ({ context, bitmapSize, horizontalPixelRatio, verticalPixelRatio }) => {
        const width = bitmapSize.width;
        const height = bitmapSize.height;
        const toY = (price: number) => {
          const y = series.priceToCoordinate(price);
          return y === null ? null : y * verticalPixelRatio;
        };
        const line = Math.max(1, Math.round(verticalPixelRatio));

        if (priceBand) {
          const highY = isOpenHigh(priceBand.high)
            ? null
            : toY(priceBand.high as number);
          const lowY = isOpenLow(priceBand.low)
            ? null
            : toY(priceBand.low as number);
          const top = Math.max(0, highY ?? 0);
          const bottom = Math.min(height, lowY ?? height);
          if (bottom > top) {
            context.fillStyle = priceBand.fillColor;
            context.fillRect(0, top, width, bottom - top);
          }
          context.fillStyle = priceBand.lineColor;
          [highY, lowY].forEach((y) => {
            if (y !== null && y >= 0 && y <= height) {
              context.fillRect(0, Math.round(y), width, line);
            }
          });
        }

        if (sideHistogram?.buckets.length) {
          const strip = sideHistogram.widthPixels * horizontalPixelRatio;
          const usable = strip - STRIP_INSET * horizontalPixelRatio;
          const maxValue = Math.max(
            ...sideHistogram.buckets.map((bucket) => bucket.value),
          );
          const { activeLow, activeHigh } = sideHistogram;
          const hasActive =
            sideHistogram.activeColor !== undefined &&
            activeLow !== undefined &&
            activeHigh !== undefined;
          if (maxValue > 0) {
            sideHistogram.buckets.forEach((bucket) => {
              const highY = toY(bucket.high);
              const lowY = toY(bucket.low);
              if (highY === null || lowY === null) {
                return;
              }
              const top = Math.min(highY, lowY);
              const bottom = Math.max(highY, lowY);
              if (bottom < 0 || top > height) {
                return;
              }
              const barHeight = Math.max(
                1,
                bottom - top - BAR_GAP * verticalPixelRatio,
              );
              const barWidth = Math.max(
                horizontalPixelRatio,
                (bucket.value / maxValue) * usable,
              );
              const active =
                hasActive &&
                bucket.high > (activeLow as number) &&
                bucket.low < (activeHigh as number);
              context.fillStyle = active
                ? (sideHistogram.activeColor as string)
                : sideHistogram.color;
              context.fillRect(
                Math.round(width - barWidth),
                Math.round(top),
                Math.round(barWidth),
                Math.round(barHeight),
              );
            });
          }
          if (sideHistogram.markerPrice !== undefined) {
            const y = toY(sideHistogram.markerPrice);
            if (y !== null && y >= 0 && y <= height) {
              context.save();
              context.strokeStyle =
                sideHistogram.markerColor ?? sideHistogram.color;
              context.lineWidth = line;
              context.setLineDash(
                MARKER_DASH.map((dash) => dash * horizontalPixelRatio),
              );
              context.beginPath();
              const lineY = Math.round(y) + line / 2;
              context.moveTo(width - strip, lineY);
              context.lineTo(width, lineY);
              context.stroke();
              context.restore();
            }
          }
        }

        if (priceBand?.draggable) {
          const centerX = sideHistogram?.buckets.length
            ? width - (sideHistogram.widthPixels * horizontalPixelRatio) / 2
            : width - HANDLE_RIGHT_INSET * horizontalPixelRatio;
          const handleWidth = HANDLE_WIDTH * horizontalPixelRatio;
          const handleHeight = HANDLE_HEIGHT * verticalPixelRatio;
          const gripWidth = GRIP_WIDTH * horizontalPixelRatio;
          const gripGap = GRIP_GAP * verticalPixelRatio;
          const highY = isOpenHigh(priceBand.high)
            ? null
            : toY(priceBand.high as number);
          const lowY = isOpenLow(priceBand.low)
            ? null
            : toY(priceBand.low as number);
          if (
            highY !== null &&
            lowY !== null &&
            Math.abs(lowY - highY) >= MOVE_HANDLE_MIN_BAND * verticalPixelRatio
          ) {
            const middleY = (highY + lowY) / 2;
            if (middleY >= 0 && middleY <= height) {
              context.fillStyle = priceBand.handleColor ?? priceBand.lineColor;
              context.beginPath();
              context.roundRect(
                Math.round(centerX - handleWidth / 2),
                Math.round(middleY - handleHeight / 2),
                Math.round(handleWidth),
                Math.round(handleHeight),
                handleHeight / 2,
              );
              context.fill();
              context.fillStyle =
                priceBand.handleTextColor ?? priceBand.fillColor;
              const dot = MOVE_HANDLE_DOT * horizontalPixelRatio;
              const step = dot + MOVE_HANDLE_DOT_GAP * horizontalPixelRatio;
              [-step, 0, step].forEach((offset) => {
                context.beginPath();
                context.arc(centerX + offset, middleY, dot / 2, 0, Math.PI * 2);
                context.fill();
              });
            }
          }
          [highY, lowY].forEach((y) => {
            if (y === null || y < 0 || y > height) {
              return;
            }
            context.fillStyle = priceBand.handleColor ?? priceBand.lineColor;
            context.beginPath();
            context.roundRect(
              Math.round(centerX - handleWidth / 2),
              Math.round(y - handleHeight / 2),
              Math.round(handleWidth),
              Math.round(handleHeight),
              handleHeight / 2,
            );
            context.fill();
            context.fillStyle =
              priceBand.handleTextColor ?? priceBand.fillColor;
            [-gripGap / 2, gripGap / 2].forEach((offset) => {
              context.fillRect(
                Math.round(centerX - gripWidth / 2),
                Math.round(y + offset - line / 2),
                Math.round(gripWidth),
                line,
              );
            });
          });
        }
      },
    );
  }
}

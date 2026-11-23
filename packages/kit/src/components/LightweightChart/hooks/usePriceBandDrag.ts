import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type {
  ILightweightChartBandDrag,
  ILightweightChartOverlay,
} from '../types';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';

// How close to an edge the mouse grabs it, in px
const EDGE_HIT_SLOP = 8;
// The middle handle's reach, in px, when no strip is drawn to hold it:
// half the handle the overlay draws, plus the slop
const MOVE_HANDLE_REACH_X = 12 + EDGE_HIT_SLOP;
const MOVE_HANDLE_REACH_Y = 6 + EDGE_HIT_SLOP;
const MOVE_HANDLE_RIGHT_INSET = 16;

const CURSORS: Record<ILightweightChartBandDrag['target'], string> = {
  low: 'ns-resize',
  high: 'ns-resize',
  band: 'grab',
};

// What the drag needs of the series the band is attached to
type IBandSeries = Pick<
  ISeriesApi<SeriesType>,
  'priceToCoordinate' | 'coordinateToPrice' | 'priceScale'
>;

function isFinitePrice(price: number | undefined): price is number {
  return price !== undefined && Number.isFinite(price) && price > 0;
}

/**
 * Lets the mouse drag a draggable price band (web): an edge anywhere along
 * the plot, or the whole band by the handle between its edges and anywhere
 * inside the side strip. The listeners run in
 * the capture phase, before the chart's own; while something is held they
 * stop the events, so the chart's crosshair stays still. The price scale is
 * held too, so the band keeps up with the mouse instead of rescaling under
 * it.
 */
export function usePriceBandDrag({
  containerRef,
  chartRef,
  seriesRef,
  overlayRef,
  enabled,
  onDrag,
  onDragStart,
  onDragEnd,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<IChartApi | null>;
  seriesRef: RefObject<IBandSeries | null>;
  overlayRef: RefObject<ILightweightChartOverlay | undefined>;
  enabled: boolean;
  onDrag: ((drag: ILightweightChartBandDrag) => void) | undefined;
  /** E.g. to hide the hover, which waits until the drop */
  onDragStart?: () => void;
  /** The price scale may have moved, e.g. to place the pulse dot again */
  onDragEnd?: () => void;
}) {
  const callbacksRef = useRef({ onDrag, onDragStart, onDragEnd });
  callbacksRef.current = { onDrag, onDragStart, onDragEnd };

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) {
      return undefined;
    }
    let drag:
      | {
          target: ILightweightChartBandDrag['target'];
          // From the mouse to the grabbed edge, so it does not jump
          offset: number;
          startPrice: number;
          price: number;
        }
      | undefined;
    let frameId: number | undefined;
    // Removes the window listeners a drag adds
    let dragListeners: AbortController | undefined;

    const report = (phase: ILightweightChartBandDrag['phase']) => {
      if (drag) {
        callbacksRef.current.onDrag?.({
          target: drag.target,
          phase,
          price: drag.price,
          startPrice: drag.startPrice,
        });
      }
    };

    const getPoint = (event: MouseEvent) => {
      const chart = chartRef.current;
      if (!chart) {
        return undefined;
      }
      const rect = container.getBoundingClientRect();
      const pane = chart.paneSize();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: pane.width,
        height: pane.height,
      };
    };

    const findTarget = (point: NonNullable<ReturnType<typeof getPoint>>) => {
      const series = seriesRef.current;
      const overlay = overlayRef.current;
      const band = overlay?.priceBand;
      if (
        !series ||
        !band?.draggable ||
        point.x < 0 ||
        point.x > point.width ||
        point.y < 0 ||
        point.y > point.height
      ) {
        return undefined;
      }
      const edgeYs = {
        high: isFinitePrice(band.high)
          ? series.priceToCoordinate(band.high)
          : null,
        low: isFinitePrice(band.low)
          ? series.priceToCoordinate(band.low)
          : null,
      };
      let target:
        | { target: ILightweightChartBandDrag['target']; offset: number }
        | undefined;
      let nearestDistance = EDGE_HIT_SLOP;
      (['high', 'low'] as const).forEach((edge) => {
        const y = edgeYs[edge];
        if (y === null) {
          return;
        }
        const distance = Math.abs(point.y - y);
        if (distance <= nearestDistance) {
          target = { target: edge, offset: y - point.y };
          nearestDistance = distance;
        }
      });
      if (target) {
        return target;
      }
      if (edgeYs.high === null || edgeYs.low === null) {
        return undefined;
      }
      // Inside the band, over the strip: the band moves whole. The handle
      // drawn between the edges sits in the strip, so it is covered too
      const stripWidth = overlay?.sideHistogram?.widthPixels ?? 0;
      if (
        stripWidth > 0 &&
        point.x >= point.width - stripWidth &&
        point.y > Math.min(edgeYs.high, edgeYs.low) &&
        point.y < Math.max(edgeYs.high, edgeYs.low)
      ) {
        return { target: 'band' as const, offset: 0 };
      }
      // Without a strip the handle stands alone near the right edge
      if (
        stripWidth <= 0 &&
        Math.abs(point.x - (point.width - MOVE_HANDLE_RIGHT_INSET)) <=
          MOVE_HANDLE_REACH_X &&
        Math.abs(point.y - (edgeYs.high + edgeYs.low) / 2) <=
          MOVE_HANDLE_REACH_Y
      ) {
        return { target: 'band' as const, offset: 0 };
      }
      return undefined;
    };

    const flush = () => {
      frameId = undefined;
      report('move');
    };

    const onWindowMove = (event: MouseEvent) => {
      if (!drag) {
        return;
      }
      event.stopPropagation();
      const point = getPoint(event);
      const series = seriesRef.current;
      if (!point || !series) {
        return;
      }
      const y = Math.min(point.height, Math.max(0, point.y + drag.offset));
      const price = series.coordinateToPrice(y);
      if (price === null || !(price > 0)) {
        return;
      }
      drag.price = price;
      if (frameId === undefined) {
        frameId = requestAnimationFrame(flush);
      }
    };

    const endDrag = () => {
      if (!drag) {
        return;
      }
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
        frameId = undefined;
      }
      dragListeners?.abort();
      dragListeners = undefined;
      container.style.cursor = '';
      seriesRef.current?.priceScale().applyOptions({ autoScale: true });
      report('end');
      drag = undefined;
      callbacksRef.current.onDragEnd?.();
    };

    const onWindowUp = (event: MouseEvent) => {
      if (drag) {
        event.stopPropagation();
      }
      endDrag();
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }
      const point = getPoint(event);
      const hit = point ? findTarget(point) : undefined;
      const startPrice =
        point && hit
          ? seriesRef.current?.coordinateToPrice(point.y + hit.offset)
          : null;
      if (!hit || !isFinitePrice(startPrice ?? undefined)) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      drag = {
        target: hit.target,
        offset: hit.offset,
        startPrice: startPrice as number,
        price: startPrice as number,
      };
      chartRef.current?.clearCrosshairPosition();
      seriesRef.current?.priceScale().applyOptions({ autoScale: false });
      container.style.cursor = hit.target === 'band' ? 'grabbing' : 'ns-resize';
      dragListeners = new AbortController();
      const options = { capture: true, signal: dragListeners.signal };
      globalThis.addEventListener('mousemove', onWindowMove, options);
      globalThis.addEventListener('mouseup', onWindowUp, options);
      callbacksRef.current.onDragStart?.();
      report('start');
    };

    const onHoverMove = (event: MouseEvent) => {
      if (drag) {
        return;
      }
      const point = getPoint(event);
      const hit = point ? findTarget(point) : undefined;
      container.style.cursor = hit ? CURSORS[hit.target] : '';
    };

    container.addEventListener('mousedown', onMouseDown, true);
    container.addEventListener('mousemove', onHoverMove, true);
    return () => {
      endDrag();
      container.removeEventListener('mousedown', onMouseDown, true);
      container.removeEventListener('mousemove', onHoverMove, true);
      container.style.cursor = '';
    };
  }, [chartRef, containerRef, enabled, overlayRef, seriesRef]);
}

import { useCallback, useRef, useState } from 'react';
import type {
  MutableRefObject,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { getTradingViewNativePriceRangeScaleAfterDrag } from '../utils/priceAxisScale';

import {
  type ITradingViewNativeCanvasPriceAxisLabels,
  getTradingViewNativeCanvasPriceAxisPointerLayout,
} from './chartCanvasLayout';
import { getTradingViewNativeWheelPriceRangeScale } from './chartWheel';

import type { ITradingViewNativePriceScaleMode } from '../types';
import type { ITradingViewNativeChartRuntimeState } from '../utils/chartRuntime';

export interface ITradingViewNativeWebPriceScaleModel {
  mode: ITradingViewNativePriceScaleMode;
  rangeScale: number;
}

interface IPriceAxisPointerDragState {
  chartHeight: number;
  pointerId: number;
  startScale: number;
  startY: number;
}

export function createTradingViewNativeWebPriceScaleModel(): ITradingViewNativeWebPriceScaleModel {
  return {
    mode: 'linear',
    rangeScale: 1,
  };
}

export function useTradingViewNativePriceScale({
  labels,
  modelRef,
  paneCount,
  renderCurrentChart,
  renderWithCrosshairHidden,
  runtimeStateRef,
}: {
  labels: ITradingViewNativeCanvasPriceAxisLabels;
  modelRef: MutableRefObject<ITradingViewNativeWebPriceScaleModel>;
  paneCount: number;
  renderCurrentChart: () => void;
  renderWithCrosshairHidden: () => void;
  runtimeStateRef: MutableRefObject<ITradingViewNativeChartRuntimeState>;
}) {
  const pointerDragStateRef = useRef<IPriceAxisPointerDragState | null>(null);
  const isHoveredRef = useRef(false);
  const [isAutoScale, setIsAutoScale] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [mode, setMode] = useState<ITradingViewNativePriceScaleMode>(
    modelRef.current.mode,
  );

  const updateHovered = useCallback((nextIsHovered: boolean) => {
    if (isHoveredRef.current === nextIsHovered) {
      return;
    }
    isHoveredRef.current = nextIsHovered;
    setIsHovered(nextIsHovered);
  }, []);

  const getPointerLayout = useCallback(
    (canvas: HTMLCanvasElement, clientX: number, clientY: number) =>
      getTradingViewNativeCanvasPriceAxisPointerLayout({
        canvas,
        clientX,
        clientY,
        labels,
        paneCount,
      }),
    [labels, paneCount],
  );

  const handleAutoScalePress = useCallback(() => {
    modelRef.current.rangeScale = 1;
    setIsAutoScale(true);
    renderWithCrosshairHidden();
  }, [modelRef, renderWithCrosshairHidden]);

  const handleLogScalePress = useCallback(() => {
    const nextMode =
      modelRef.current.mode === 'linear' ? 'logarithmic' : 'linear';
    modelRef.current.mode = nextMode;
    setMode(nextMode);
    renderWithCrosshairHidden();
  }, [modelRef, renderWithCrosshairHidden]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const pointerLayout = getPointerLayout(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      if (!pointerLayout.isPriceAxis) {
        return false;
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        return true;
      }
      event.preventDefault();
      renderWithCrosshairHidden();
      pointerDragStateRef.current = {
        chartHeight: pointerLayout.priceAxisHeight,
        pointerId: event.pointerId,
        startScale: modelRef.current.rangeScale,
        startY: pointerLayout.y,
      };
      setIsAutoScale(false);
      updateHovered(true);
      return true;
    },
    [getPointerLayout, modelRef, renderWithCrosshairHidden, updateHovered],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const dragState = pointerDragStateRef.current;
      if (dragState) {
        if (dragState.pointerId !== event.pointerId) {
          return true;
        }
        event.preventDefault();
        const canvasRect = event.currentTarget.getBoundingClientRect();
        modelRef.current.rangeScale =
          getTradingViewNativePriceRangeScaleAfterDrag({
            chartHeight: dragState.chartHeight,
            currentY: event.clientY - canvasRect.top,
            startScale: dragState.startScale,
            startY: dragState.startY,
          });
        renderCurrentChart();
        return true;
      }

      const pointerLayout = getPointerLayout(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      updateHovered(pointerLayout.isPriceAxis);
      if (!pointerLayout.isPriceAxis) {
        return false;
      }
      if (runtimeStateRef.current.crosshair.visible) {
        renderWithCrosshairHidden();
      }
      return true;
    },
    [
      getPointerLayout,
      modelRef,
      renderCurrentChart,
      renderWithCrosshairHidden,
      runtimeStateRef,
      updateHovered,
    ],
  );

  const finishPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (pointerDragStateRef.current?.pointerId !== event.pointerId) {
        return false;
      }
      pointerDragStateRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const pointerLayout = getPointerLayout(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      updateHovered(pointerLayout.isPriceAxis);
      return true;
    },
    [getPointerLayout, updateHovered],
  );

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const pointerLayout = getPointerLayout(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      if (!pointerLayout.isPriceAxis) {
        return;
      }
      event.preventDefault();
      modelRef.current.rangeScale = 1;
      setIsAutoScale(true);
      updateHovered(true);
      renderWithCrosshairHidden();
    },
    [getPointerLayout, modelRef, renderWithCrosshairHidden, updateHovered],
  );

  const handleWheel = useCallback(
    (canvas: HTMLCanvasElement, event: WheelEvent, deltaY: number) => {
      if (deltaY === 0) {
        return false;
      }
      const pointerLayout = getPointerLayout(
        canvas,
        event.clientX,
        event.clientY,
      );
      if (!pointerLayout.isPriceAxis) {
        return false;
      }
      modelRef.current.rangeScale = getTradingViewNativeWheelPriceRangeScale({
        currentScale: modelRef.current.rangeScale,
        deltaY,
      });
      setIsAutoScale(false);
      updateHovered(true);
      renderWithCrosshairHidden();
      return true;
    },
    [getPointerLayout, modelRef, renderWithCrosshairHidden, updateHovered],
  );

  const handlePointerLeave = useCallback(() => {
    if (!pointerDragStateRef.current) {
      updateHovered(false);
    }
  }, [updateHovered]);

  const isPointerDragging = useCallback(
    () => pointerDragStateRef.current !== null,
    [],
  );

  return {
    finishPointerDrag,
    handleAutoScalePress,
    handleDoubleClick,
    handleLogScalePress,
    handlePointerDown,
    handlePointerLeave,
    handlePointerMove,
    handleWheel,
    isAutoScale,
    isHovered,
    isPointerDragging,
    mode,
  };
}

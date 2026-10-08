import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MutableRefObject,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { getTradingViewNativePriceRangeScaleAfterDrag } from '../utils/priceAxisScale';

import { getTradingViewNativeWheelPriceRangeScale } from './chartWheel';

import type { ITradingViewNativePriceScaleMode } from '../types';
import type { ITradingViewNativePriceRange } from '../utils/chartViewport';

const PRICE_AXIS_DRAG_ACTIVATION_DISTANCE = 4;

export interface ITradingViewNativeWebPriceScaleModel {
  autoPriceRange: ITradingViewNativePriceRange | null;
  mode: ITradingViewNativePriceScaleMode;
  pinnedPriceRange: ITradingViewNativePriceRange | null;
  rangeScale: number;
}

interface IPriceAxisPointerDragState {
  chartHeight: number;
  isActive: boolean;
  pointerId: number;
  startScale: number;
  startY: number;
}

export function createTradingViewNativeWebPriceScaleModel(): ITradingViewNativeWebPriceScaleModel {
  return {
    autoPriceRange: null,
    mode: 'linear',
    pinnedPriceRange: null,
    rangeScale: 1,
  };
}

function pinTradingViewNativeWebPriceRange(
  model: ITradingViewNativeWebPriceScaleModel,
) {
  if (!model.pinnedPriceRange && model.autoPriceRange) {
    model.pinnedPriceRange = { ...model.autoPriceRange };
  }
  return Boolean(model.pinnedPriceRange);
}

export function useTradingViewNativePriceScale({
  isLogScaleAvailable,
  modelRef,
  renderCurrentChart,
  renderWithCrosshairHidden,
}: {
  isLogScaleAvailable: boolean;
  modelRef: MutableRefObject<ITradingViewNativeWebPriceScaleModel>;
  renderCurrentChart: () => void;
  renderWithCrosshairHidden: () => void;
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

  useEffect(() => {
    if (isLogScaleAvailable || modelRef.current.mode === 'linear') {
      return;
    }
    modelRef.current.mode = 'linear';
    setMode('linear');
    renderWithCrosshairHidden();
  }, [isLogScaleAvailable, modelRef, renderWithCrosshairHidden]);

  const handleAutoScalePress = useCallback(() => {
    const nextIsAutoScale = !isAutoScale;
    if (nextIsAutoScale) {
      modelRef.current.pinnedPriceRange = null;
      modelRef.current.rangeScale = 1;
    } else if (!pinTradingViewNativeWebPriceRange(modelRef.current)) {
      return;
    }
    setIsAutoScale(nextIsAutoScale);
    renderWithCrosshairHidden();
  }, [isAutoScale, modelRef, renderWithCrosshairHidden]);

  const handleLogScalePress = useCallback(() => {
    if (!isLogScaleAvailable) {
      return;
    }
    const nextMode =
      modelRef.current.mode === 'linear' ? 'logarithmic' : 'linear';
    modelRef.current.mode = nextMode;
    setMode(nextMode);
    renderWithCrosshairHidden();
  }, [isLogScaleAvailable, modelRef, renderWithCrosshairHidden]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const targetRect = event.currentTarget.getBoundingClientRect();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; dragging still works while the pointer remains over the axis.
      }
      event.preventDefault();
      renderWithCrosshairHidden();
      pointerDragStateRef.current = {
        chartHeight: targetRect.height,
        isActive: false,
        pointerId: event.pointerId,
        startScale: modelRef.current.rangeScale,
        startY: event.clientY - targetRect.top,
      };
      updateHovered(true);
    },
    [modelRef, renderWithCrosshairHidden, updateHovered],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = pointerDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const targetRect = event.currentTarget.getBoundingClientRect();
      const currentY = event.clientY - targetRect.top;
      if (
        !dragState.isActive &&
        Math.abs(currentY - dragState.startY) <=
          PRICE_AXIS_DRAG_ACTIVATION_DISTANCE
      ) {
        return;
      }
      if (!dragState.isActive) {
        if (!pinTradingViewNativeWebPriceRange(modelRef.current)) {
          return;
        }
        dragState.isActive = true;
        setIsAutoScale(false);
      }
      modelRef.current.rangeScale =
        getTradingViewNativePriceRangeScaleAfterDrag({
          chartHeight: dragState.chartHeight,
          currentY,
          startScale: dragState.startScale,
          startY: dragState.startY,
        });
      renderCurrentChart();
    },
    [modelRef, renderCurrentChart],
  );

  const finishPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerDragStateRef.current?.pointerId !== event.pointerId) {
        return;
      }
      pointerDragStateRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const targetRect = event.currentTarget.getBoundingClientRect();
      updateHovered(
        event.clientX >= targetRect.left &&
          event.clientX <= targetRect.right &&
          event.clientY >= targetRect.top &&
          event.clientY <= targetRect.bottom,
      );
    },
    [updateHovered],
  );

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      modelRef.current.pinnedPriceRange = null;
      modelRef.current.rangeScale = 1;
      setIsAutoScale(true);
      updateHovered(true);
      renderWithCrosshairHidden();
    },
    [modelRef, renderWithCrosshairHidden, updateHovered],
  );

  const handleWheel = useCallback(
    (deltaY: number) => {
      if (deltaY === 0) {
        return;
      }
      if (!pinTradingViewNativeWebPriceRange(modelRef.current)) {
        return;
      }
      modelRef.current.rangeScale = getTradingViewNativeWheelPriceRangeScale({
        currentScale: modelRef.current.rangeScale,
        deltaY,
      });
      setIsAutoScale(false);
      updateHovered(true);
      renderWithCrosshairHidden();
    },
    [modelRef, renderWithCrosshairHidden, updateHovered],
  );

  const handlePointerEnter = useCallback(() => {
    updateHovered(true);
    renderWithCrosshairHidden();
  }, [renderWithCrosshairHidden, updateHovered]);

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
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    handleWheel,
    isAutoScale,
    isHovered,
    isPointerDragging,
    mode,
  };
}

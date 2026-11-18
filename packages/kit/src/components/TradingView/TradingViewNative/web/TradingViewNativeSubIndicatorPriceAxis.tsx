import { useEffect, useMemo } from 'react';

import { TradingViewNativePriceScaleControls } from './TradingViewNativePriceScaleControls';
import { useTradingViewNativePriceScale } from './useTradingViewNativePriceScale';

import type { ITradingViewNativeWebPriceScaleModel } from './useTradingViewNativePriceScale';

export function TradingViewNativeSubIndicatorPriceAxis({
  backgroundColor,
  height,
  isLogScaleAvailable,
  model,
  onActivate,
  renderCurrentChart,
  renderWithCrosshairHidden,
  testID,
  top,
  width,
  wheelHandlers,
}: {
  backgroundColor: string;
  height: number;
  isLogScaleAvailable: boolean;
  model: ITradingViewNativeWebPriceScaleModel;
  onActivate: () => void;
  renderCurrentChart: () => void;
  renderWithCrosshairHidden: () => void;
  testID: string;
  top: number;
  width: number;
  wheelHandlers: Map<
    ITradingViewNativeWebPriceScaleModel,
    (deltaY: number) => void
  >;
}) {
  const modelRef = useMemo(() => ({ current: model }), [model]);
  const {
    finishPointerDrag,
    handleAutoScalePress,
    handleDoubleClick,
    handlePointerDown,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    handleLogScalePress,
    handleWheel,
    isAutoScale,
    isHovered,
    mode,
  } = useTradingViewNativePriceScale({
    isLogScaleAvailable,
    modelRef,
    renderCurrentChart,
    renderWithCrosshairHidden,
  });

  useEffect(() => {
    wheelHandlers.set(model, handleWheel);
    return () => {
      wheelHandlers.delete(model);
    };
  }, [handleWheel, model, wheelHandlers]);

  return (
    <div
      data-testid={testID}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) handleDoubleClick(event);
      }}
      onLostPointerCapture={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) handlePointerDown(event);
      }}
      onPointerEnter={() => {
        onActivate();
        handlePointerEnter();
      }}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      style={{
        cursor: 'ns-resize',
        height,
        position: 'absolute',
        right: 0,
        top,
        touchAction: 'none',
        userSelect: 'none',
        width,
        zIndex: 1,
      }}
    >
      <TradingViewNativePriceScaleControls
        backgroundColor={backgroundColor}
        isAutoScale={isAutoScale}
        isLogScaleAvailable={isLogScaleAvailable}
        isVisible={isHovered}
        mainChartBottomInset={0}
        onAutoScalePress={handleAutoScalePress}
        onLogScalePress={handleLogScalePress}
        priceAxisWidth={width}
        priceScaleMode={mode}
        testID={testID}
      />
    </div>
  );
}

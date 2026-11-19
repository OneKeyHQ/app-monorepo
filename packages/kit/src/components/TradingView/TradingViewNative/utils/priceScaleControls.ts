import { TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT } from '../chartConstants';

const PRICE_SCALE_CONTROL_AXIS_INSET = 4;
const PRICE_SCALE_CONTROL_BOTTOM_GAP = 4;

export interface ITradingViewNativePriceScaleControlSizing {
  gap: number;
  minimumButtonSize: number;
  preferredButtonSize: number;
}

export const PRICE_SCALE_CONTROL_NATIVE_SIZING: ITradingViewNativePriceScaleControlSizing =
  {
    gap: 4,
    minimumButtonSize: 20,
    preferredButtonSize: 28,
  };

export const PRICE_SCALE_CONTROL_WEB_SIZING: ITradingViewNativePriceScaleControlSizing =
  {
    gap: 3,
    minimumButtonSize: 16,
    preferredButtonSize: 20,
  };

export function getTradingViewNativePriceScaleControlsMinimumAxisWidth(
  sizing: ITradingViewNativePriceScaleControlSizing = PRICE_SCALE_CONTROL_NATIVE_SIZING,
) {
  'worklet';

  return (
    sizing.minimumButtonSize * 2 +
    sizing.gap +
    PRICE_SCALE_CONTROL_AXIS_INSET * 2
  );
}

export function getTradingViewNativePriceScaleControlsLayout(
  priceAxisWidth: number,
  {
    mainChartBottomInset = TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
    sizing = PRICE_SCALE_CONTROL_NATIVE_SIZING,
  }: {
    mainChartBottomInset?: number;
    sizing?: ITradingViewNativePriceScaleControlSizing;
  } = {},
) {
  if (!Number.isFinite(priceAxisWidth) || priceAxisWidth <= 0) {
    return null;
  }

  const availableWidth = Math.max(
    priceAxisWidth - PRICE_SCALE_CONTROL_AXIS_INSET * 2,
    0,
  );
  const buttonSize = Math.min(
    sizing.preferredButtonSize,
    Math.floor((availableWidth - sizing.gap) / 2),
  );
  if (buttonSize < sizing.minimumButtonSize) {
    return null;
  }

  const width = buttonSize * 2 + sizing.gap;
  const normalizedMainChartBottomInset =
    Number.isFinite(mainChartBottomInset) && mainChartBottomInset >= 0
      ? mainChartBottomInset
      : TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT;
  return {
    bottom: normalizedMainChartBottomInset + PRICE_SCALE_CONTROL_BOTTOM_GAP,
    buttonSize,
    gap: sizing.gap,
    right: Math.max((priceAxisWidth - width) / 2, 0),
    width,
  };
}

import { TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT } from '../chartConstants';

const PRICE_SCALE_CONTROL_SIZE = 28;
const PRICE_SCALE_CONTROL_MIN_SIZE = 20;
const PRICE_SCALE_CONTROL_GAP = 4;
const PRICE_SCALE_CONTROL_AXIS_INSET = 4;
const PRICE_SCALE_CONTROL_BOTTOM_GAP = 4;

export function getTradingViewNativePriceScaleControlsLayout(
  priceAxisWidth: number,
  {
    preferredButtonSize = PRICE_SCALE_CONTROL_SIZE,
    minimumButtonSize = PRICE_SCALE_CONTROL_MIN_SIZE,
    gap = PRICE_SCALE_CONTROL_GAP,
    mainChartBottomInset = TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
  }: {
    preferredButtonSize?: number;
    minimumButtonSize?: number;
    gap?: number;
    mainChartBottomInset?: number;
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
    preferredButtonSize,
    Math.floor((availableWidth - gap) / 2),
  );
  if (buttonSize < minimumButtonSize) {
    return null;
  }

  const width = buttonSize * 2 + gap;
  const normalizedMainChartBottomInset =
    Number.isFinite(mainChartBottomInset) && mainChartBottomInset >= 0
      ? mainChartBottomInset
      : TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT;
  return {
    bottom: normalizedMainChartBottomInset + PRICE_SCALE_CONTROL_BOTTOM_GAP,
    buttonSize,
    gap,
    right: Math.max((priceAxisWidth - width) / 2, 0),
    width,
  };
}

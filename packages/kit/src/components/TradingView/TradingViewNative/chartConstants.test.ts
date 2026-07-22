import {
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_GRID_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_GRID_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_RIGHT_PADDING,
} from './chartConstants';

describe('TradingViewNative chart constants', () => {
  it('keeps a fixed candle width and gap', () => {
    expect(TRADING_VIEW_NATIVE_CANDLE_GAP).toBe(1);
    expect(TRADING_VIEW_NATIVE_CANDLE_STEP).toBe(
      TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + TRADING_VIEW_NATIVE_CANDLE_GAP,
    );
  });

  it('uses short, sparse grid dashes', () => {
    expect(TRADING_VIEW_NATIVE_GRID_LINE_DASH_LENGTH).toBe(2);
    expect(TRADING_VIEW_NATIVE_GRID_LINE_DASH_GAP).toBe(4);
  });

  it('aligns price labels with a shared right padding', () => {
    expect(TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_RIGHT_PADDING).toBe(4);
  });
});

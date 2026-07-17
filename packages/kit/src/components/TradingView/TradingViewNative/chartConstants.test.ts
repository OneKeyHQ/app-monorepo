import {
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_GAP,
  TRADING_VIEW_NATIVE_CANDLE_STEP,
} from './chartConstants';

describe('TradingViewNative chart constants', () => {
  it('keeps a fixed candle width and gap', () => {
    expect(TRADING_VIEW_NATIVE_CANDLE_STEP).toBe(
      TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH + TRADING_VIEW_NATIVE_CANDLE_GAP,
    );
  });
});

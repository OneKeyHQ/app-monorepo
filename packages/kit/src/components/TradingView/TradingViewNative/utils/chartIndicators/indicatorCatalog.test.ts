import { TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS } from '../subIndicatorRender/definitions';

import {
  TRADING_VIEW_NATIVE_ALL_INDICATORS,
  TRADING_VIEW_NATIVE_INDICATOR_CATALOG,
  getTradingViewNativeIndicatorPlacement,
  isTradingViewNativeAnyIndicator,
  resolveTradingViewNativeIndicatorId,
} from './indicatorCatalog';
import { TRADING_VIEW_NATIVE_SUB_INDICATORS } from './subIndicatorTypes';
import { TRADING_VIEW_NATIVE_INDICATORS } from './types';

describe('TradingView Native indicator catalog', () => {
  it('contains 42 unique indicators in main-then-subpane order', () => {
    expect(TRADING_VIEW_NATIVE_ALL_INDICATORS).toEqual([
      ...TRADING_VIEW_NATIVE_INDICATORS,
      ...TRADING_VIEW_NATIVE_SUB_INDICATORS,
    ]);
    expect(TRADING_VIEW_NATIVE_INDICATORS).toHaveLength(10);
    expect(TRADING_VIEW_NATIVE_SUB_INDICATORS).toHaveLength(32);
    expect(TRADING_VIEW_NATIVE_ALL_INDICATORS).toHaveLength(42);
    expect(new Set(TRADING_VIEW_NATIVE_ALL_INDICATORS).size).toBe(42);
  });

  it('keeps the catalog aligned with the main and subpane ids', () => {
    expect(
      TRADING_VIEW_NATIVE_INDICATOR_CATALOG.filter(
        ({ placement }) => placement === 'main',
      ).map(({ id }) => id),
    ).toEqual(TRADING_VIEW_NATIVE_INDICATORS);
    expect(
      TRADING_VIEW_NATIVE_INDICATOR_CATALOG.filter(
        ({ placement }) => placement === 'subpane',
      ).map(({ id }) => id),
    ).toEqual(TRADING_VIEW_NATIVE_SUB_INDICATORS);
    expect(
      TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS.map(
        ({ indicator }) => indicator,
      ),
    ).toEqual(TRADING_VIEW_NATIVE_SUB_INDICATORS);
  });

  it('guards and classifies canonical ids without classifying unknown values', () => {
    expect(isTradingViewNativeAnyIndicator('MA')).toBe(true);
    expect(isTradingViewNativeAnyIndicator('MACD')).toBe(true);
    expect(isTradingViewNativeAnyIndicator('UNKNOWN')).toBe(false);
    expect(getTradingViewNativeIndicatorPlacement('EMA')).toBe('main');
    expect(getTradingViewNativeIndicatorPlacement('SUPERTREND')).toBe('main');
    expect(getTradingViewNativeIndicatorPlacement('CCI')).toBe('subpane');
    expect(getTradingViewNativeIndicatorPlacement('KDJ')).toBe('subpane');
    expect(getTradingViewNativeIndicatorPlacement('UNKNOWN')).toBeNull();
  });

  it('prefers the canonical value and falls back to the bridge label', () => {
    expect(resolveTradingViewNativeIndicatorId('RSI', 'MACD')).toBe('RSI');
    expect(resolveTradingViewNativeIndicatorId('bridge-rsi', 'RSI')).toBe(
      'RSI',
    );
    expect(
      resolveTradingViewNativeIndicatorId('bridge-value', 'Unknown'),
    ).toBeNull();
  });
});

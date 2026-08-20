import {
  canToggleTradingViewNativeIndicatorOn,
  getIndicatorSections,
  getNativeIndicatorSelectionUpdates,
  getTradingViewNativeSubIndicatorCount,
} from './indicatorUtils';

import type { ITradingViewIndicatorOption } from '../types';

describe('native indicator selector utilities', () => {
  it('groups canonical ids and ignores unknown options', () => {
    const main = { label: 'MA', value: 'bridge-main' };
    const sub = { label: 'MACD bridge label', value: 'MACD' };
    const unknown = { label: 'Unknown', value: 'UNKNOWN' };

    expect(getIndicatorSections([main, sub, unknown])).toEqual({
      mainIndicators: [main],
      subIndicators: [sub],
    });
  });

  it('does not count or cap unknown ids as sub-indicators', () => {
    const activeIndicatorValues = new Set(['VOL', 'UNKNOWN']);

    expect(getTradingViewNativeSubIndicatorCount(activeIndicatorValues)).toBe(
      1,
    );
    expect(
      canToggleTradingViewNativeIndicatorOn({
        activeIndicatorValues,
        indicatorValue: 'UNKNOWN',
        maxSubIndicatorCount: 1,
      }),
    ).toBe(true);
    expect(
      canToggleTradingViewNativeIndicatorOn({
        activeIndicatorValues,
        indicatorValue: 'MACD',
        maxSubIndicatorCount: 1,
      }),
    ).toBe(false);
  });

  it('uses canonical values instead of display labels in updates', () => {
    const indicators: ITradingViewIndicatorOption[] = [
      { label: 'RSI', value: 'bridge-rsi' },
      { label: 'MACD bridge label', value: 'MACD' },
    ];

    expect(
      getNativeIndicatorSelectionUpdates({
        indicators,
        nextActiveIndicatorValues: new Set(['MACD']),
        originalActiveIndicatorValues: new Set(['bridge-rsi']),
      }),
    ).toEqual([
      ['RSI', false],
      ['MACD', true],
    ]);
  });
});

import {
  canToggleTradingViewNativeIndicatorOn,
  commitNativeIndicatorSelection,
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
        maxSelectableSubIndicatorCount: 1,
      }),
    ).toBe(true);
    expect(
      canToggleTradingViewNativeIndicatorOn({
        activeIndicatorValues,
        indicatorValue: 'MACD',
        maxSelectableSubIndicatorCount: 1,
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

  it('commits the full selection atomically when supported', () => {
    const indicators: ITradingViewIndicatorOption[] = [
      { label: 'VOL', value: 'VOL' },
      { label: 'MACD', value: 'MACD' },
      { label: 'RSI', value: 'RSI' },
    ];
    const onSelect = jest.fn();
    const onSelectionConfirm = jest.fn();

    commitNativeIndicatorSelection({
      indicators,
      nextActiveIndicatorValues: new Set(['VOL', 'RSI']),
      onSelect,
      onSelectionConfirm,
      originalActiveIndicatorValues: new Set(['VOL', 'MACD']),
    });

    expect(onSelectionConfirm).toHaveBeenCalledWith({
      activeIndicatorValues: new Set(['VOL', 'RSI']),
      replaceMainIndicators: false,
      replaceSubIndicators: true,
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps sub-indicators out of a main-only selection replacement', () => {
    const indicators: ITradingViewIndicatorOption[] = [
      { label: 'MA', value: 'MA' },
      { label: 'VOL', value: 'VOL' },
    ];
    const onSelectionConfirm = jest.fn();

    commitNativeIndicatorSelection({
      indicators,
      nextActiveIndicatorValues: new Set(['MA', 'VOL']),
      onSelect: jest.fn(),
      onSelectionConfirm,
      originalActiveIndicatorValues: new Set(['VOL']),
    });

    expect(onSelectionConfirm).toHaveBeenCalledWith({
      activeIndicatorValues: new Set(['MA', 'VOL']),
      replaceMainIndicators: true,
      replaceSubIndicators: false,
    });
  });

  it('keeps per-indicator updates for legacy callers', () => {
    const indicators: ITradingViewIndicatorOption[] = [
      { label: 'VOL', value: 'VOL' },
      { label: 'MACD', value: 'MACD' },
      { label: 'RSI', value: 'RSI' },
    ];
    const onSelect = jest.fn();

    commitNativeIndicatorSelection({
      indicators,
      nextActiveIndicatorValues: new Set(['VOL', 'RSI']),
      onSelect,
      originalActiveIndicatorValues: new Set(['VOL', 'MACD']),
    });

    expect(onSelect.mock.calls).toEqual([
      ['MACD', false],
      ['RSI', true],
    ]);
  });
});

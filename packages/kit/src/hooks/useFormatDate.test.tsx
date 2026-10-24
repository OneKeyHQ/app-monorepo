/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';

import useFormatDate from './useFormatDate';

let mockLocale: ILocaleSymbol = 'fr-FR';

jest.mock('./useLocaleVariant', () => ({
  useLocaleVariant: () => mockLocale,
}));

describe('useFormatDate', () => {
  const date = new Date(2026, 9, 14, 19, 26, 32);

  beforeEach(() => {
    mockLocale = 'fr-FR';
  });

  it('retains minute precision, time-only and hidden-field behavior', () => {
    const { result } = renderHook(() => useFormatDate());
    expect(result.current.formatDate(date)).toBe('14/10/2026 19:26');
    expect(result.current.formatDate(date, { hideSeconds: false })).toBe(
      '14/10/2026 19:26:32',
    );
    expect(result.current.formatDate(date, { onlyTime: true })).toBe('19:26');
    expect(
      result.current.formatDate(date, {
        hideYear: true,
        hideTimeForever: true,
      }),
    ).toBe('14/10');
    expect(
      result.current.formatDate(date, {
        hideMonth: true,
        hideTimeForever: true,
      }),
    ).toBe('14/2026');
    expect(result.current.format(date, 'yyyyMMdd')).toBe('20261014');
  });

  it('recomputes dates and months when the App language changes', () => {
    const { result, rerender } = renderHook(() => useFormatDate());
    expect(result.current.formatDate(date)).toBe('14/10/2026 19:26');
    expect(result.current.formatMonth(date)).toBe('10/2026');
    mockLocale = 'zh-CN';
    rerender();
    expect(result.current.formatDate(date)).toBe('2026/10/14 19:26');
    expect(result.current.formatMonth(date)).toBe('2026/10');
    expect(result.current.format(date)).toBe('2026/10/14 19:26');
    mockLocale = 'en';
    rerender();
    expect(result.current.formatDate(date)).toBe('10/14/2026 19:26');
  });
});

/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useStockSimpleChartSelection } from './StockSimpleChartTimeRangeSelect';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  Icon: () => null,
  Select: () => null,
  SizableText: () => null,
  YStack: () => null,
}));

describe('useStockSimpleChartSelection', () => {
  it('opens a share on the full trading day', () => {
    const { result } = renderHook(() => useStockSimpleChartSelection('share'));
    expect(result.current).toMatchObject({
      range: '1D',
      session: 'fullHours',
      capsuleSession: 'fullHours',
      selectedRange: undefined,
    });
  });

  it('keeps naming the last session after a range is picked', () => {
    const { result } = renderHook(() => useStockSimpleChartSelection('share'));
    act(() => result.current.selectSession('preMarket'));
    expect(result.current).toMatchObject({
      range: '1D',
      session: 'preMarket',
      capsuleSession: 'preMarket',
    });

    act(() => result.current.selectRange('1M'));
    expect(result.current).toMatchObject({
      range: '1M',
      session: undefined,
      capsuleSession: 'preMarket',
      selectedRange: '1M',
    });

    // Returning to the capsule restores that session, not the default.
    act(() => result.current.selectSession(result.current.capsuleSession));
    expect(result.current).toMatchObject({
      range: '1D',
      session: 'preMarket',
      selectedRange: undefined,
    });
  });

  it('reads a session as the plain 1D range on the token price', () => {
    const { result } = renderHook(() => useStockSimpleChartSelection('token'));
    expect(result.current).toMatchObject({
      range: '1D',
      session: undefined,
      selectedRange: '1D',
    });
  });
});

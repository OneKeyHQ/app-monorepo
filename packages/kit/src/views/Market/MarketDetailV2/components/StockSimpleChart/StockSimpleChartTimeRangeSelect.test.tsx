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

  it('opens on pre-market while the market is in pre-market', () => {
    const { result } = renderHook(() =>
      useStockSimpleChartSelection('share', 'PRE_MARKET'),
    );
    expect(result.current).toMatchObject({
      range: '1D',
      session: 'preMarket',
      capsuleSession: 'preMarket',
    });
  });

  it('follows the market to all sessions until the user picks', () => {
    const { result, rerender } = renderHook(
      ({ marketSession }: { marketSession?: string }) =>
        useStockSimpleChartSelection('share', marketSession),
      { initialProps: { marketSession: 'PRE_MARKET' } },
    );
    rerender({ marketSession: 'REGULAR' });
    expect(result.current).toMatchObject({
      session: 'fullHours',
      capsuleSession: 'fullHours',
    });
  });

  it('keeps a picked selection when the market moves on', () => {
    const { result, rerender } = renderHook(
      ({ marketSession }: { marketSession?: string }) =>
        useStockSimpleChartSelection('share', marketSession),
      { initialProps: { marketSession: 'PRE_MARKET' } },
    );
    // A range picked from the default still names the default's session.
    act(() => result.current.selectRange('1W'));
    expect(result.current).toMatchObject({
      range: '1W',
      session: undefined,
      capsuleSession: 'preMarket',
    });
    rerender({ marketSession: 'REGULAR' });
    expect(result.current).toMatchObject({
      range: '1W',
      capsuleSession: 'preMarket',
    });
  });

  it.each(['REGULAR', 'POST_MARKET', 'OVERNIGHT', 'CLOSED', undefined])(
    'opens on all sessions while the market is %s',
    (marketSession) => {
      const { result } = renderHook(() =>
        useStockSimpleChartSelection('share', marketSession),
      );
      expect(result.current.session).toBe('fullHours');
    },
  );

  it('returns a token 1H to the capsule session on the share price', () => {
    const { result, rerender } = renderHook(
      ({ priceMode }: { priceMode: 'share' | 'token' }) =>
        useStockSimpleChartSelection(priceMode, 'REGULAR'),
      { initialProps: { priceMode: 'token' } },
    );
    act(() => result.current.selectRange('1H'));
    expect(result.current).toMatchObject({ range: '1H', selectedRange: '1H' });
    rerender({ priceMode: 'share' });
    expect(result.current).toMatchObject({
      range: '1D',
      session: 'fullHours',
      selectedRange: undefined,
    });
    // The token price still has its 1H.
    rerender({ priceMode: 'token' });
    expect(result.current).toMatchObject({ range: '1H', selectedRange: '1H' });
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

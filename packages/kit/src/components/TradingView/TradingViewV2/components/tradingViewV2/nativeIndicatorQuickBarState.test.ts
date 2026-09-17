import { createElement } from 'react';

import {
  resolveTradingViewNativeIndicatorQuickBarState,
  shouldReserveTradingViewNativeIndicatorQuickBar,
} from './nativeIndicatorQuickBarState';

describe('nativeIndicatorQuickBarState', () => {
  it('reserves space while quick bar availability is loading', () => {
    const state = resolveTradingViewNativeIndicatorQuickBarState({
      isAvailabilityResolved: false,
      quickBar: null,
    });

    expect(state).toEqual({ status: 'loading', quickBar: null });
    expect(shouldReserveTradingViewNativeIndicatorQuickBar(state)).toBe(true);
  });

  it('reserves space when the quick bar is visible', () => {
    const quickBar = createElement('div');
    const state = resolveTradingViewNativeIndicatorQuickBarState({
      isAvailabilityResolved: true,
      quickBar,
    });

    expect(state).toEqual({ status: 'visible', quickBar });
    expect(shouldReserveTradingViewNativeIndicatorQuickBar(state)).toBe(true);
  });

  it('removes reserved space when indicators are unavailable', () => {
    const state = resolveTradingViewNativeIndicatorQuickBarState({
      isAvailabilityResolved: true,
      quickBar: null,
    });

    expect(state).toEqual({ status: 'hidden', quickBar: null });
    expect(shouldReserveTradingViewNativeIndicatorQuickBar(state)).toBe(false);
  });
});

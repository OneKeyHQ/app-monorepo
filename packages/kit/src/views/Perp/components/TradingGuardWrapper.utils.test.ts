import { getTradingGuardRenderMode } from './TradingGuardWrapper.utils';

describe('getTradingGuardRenderMode', () => {
  it('keeps actionable children so the guard can enable trading before running the original action', () => {
    expect(
      getTradingGuardRenderMode({
        selectAccountLoading: false,
        accountNotSupport: false,
        shouldShowEnableTrading: true,
        hasChildren: true,
        canRunGuardedAction: true,
      }),
    ).toBe('guardedChildren');
  });

  it('falls back to the enable trading button when there is no child action to continue', () => {
    expect(
      getTradingGuardRenderMode({
        selectAccountLoading: false,
        accountNotSupport: false,
        shouldShowEnableTrading: true,
        hasChildren: true,
        canRunGuardedAction: false,
      }),
    ).toBe('enableTradingButton');
  });
});

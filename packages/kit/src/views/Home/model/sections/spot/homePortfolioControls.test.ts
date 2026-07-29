import { resolveHomePortfolioLpTokenSwitch } from './homePortfolioControls';

describe('Home portfolio controls', () => {
  it('shows loading while a DeFi-token enable request is ahead of live data', () => {
    expect(
      resolveHomePortfolioLpTokenSwitch({
        liveLoading: false,
        liveValue: false,
        requestedValue: true,
      }),
    ).toEqual({
      loading: true,
      value: true,
    });
  });

  it('stops loading once live data matches the requested DeFi-token mode', () => {
    expect(
      resolveHomePortfolioLpTokenSwitch({
        liveLoading: false,
        liveValue: true,
        requestedValue: true,
      }),
    ).toEqual({
      loading: false,
      value: true,
    });
  });

  it('keeps the original immediate switch-off behavior', () => {
    expect(
      resolveHomePortfolioLpTokenSwitch({
        liveLoading: false,
        liveValue: true,
        requestedValue: false,
      }),
    ).toEqual({
      loading: false,
      value: false,
    });
  });
});

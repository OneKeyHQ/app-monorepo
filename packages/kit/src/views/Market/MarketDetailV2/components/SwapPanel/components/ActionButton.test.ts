import { shouldJumpFromMarketToSwap } from './ActionButton.utils';

describe('shouldJumpFromMarketToSwap', () => {
  it('keeps wrapped pairs in Market when speed swap is unsupported', () => {
    expect(
      shouldJumpFromMarketToSwap({
        supportSpeedSwap: false,
        isInsufficientBalance: false,
        isWrapped: true,
      }),
    ).toBe(false);
  });

  it('falls back to Swap for unsupported ordinary pairs', () => {
    expect(
      shouldJumpFromMarketToSwap({
        supportSpeedSwap: false,
        isInsufficientBalance: false,
        isWrapped: false,
      }),
    ).toBe(true);
  });

  it('falls back to Swap for insufficient ordinary pairs', () => {
    expect(
      shouldJumpFromMarketToSwap({
        supportSpeedSwap: true,
        isInsufficientBalance: true,
        isWrapped: false,
      }),
    ).toBe(true);
  });
});

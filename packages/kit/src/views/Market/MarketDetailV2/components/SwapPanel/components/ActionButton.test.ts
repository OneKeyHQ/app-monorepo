import { resolveMarketTradeActionState } from './ActionButton.utils';

describe('resolveMarketTradeActionState', () => {
  it('keeps wrapped pairs in Market when speed swap is unsupported', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isInsufficientBalance: false,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: false });
  });

  it('falls back to Swap for wrapped pairs on unsupported accounts', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: false,
        isInsufficientBalance: false,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: true });
  });

  it('falls back to Swap for unsupported ordinary pairs', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isInsufficientBalance: false,
        isWrapped: false,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: true });
  });

  it('disables insufficient ordinary pairs instead of falling back to Swap', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: true,
        isAccountNetworkSupported: true,
        isInsufficientBalance: true,
        isWrapped: false,
      }),
    ).toEqual({ shouldDisable: true, shouldJumpToSwap: false });
  });

  it('preserves unsupported pair fallback when balance is insufficient', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isInsufficientBalance: true,
        isWrapped: false,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: true });
  });

  it('preserves account compatibility fallback when balance is unavailable', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: false,
        isInsufficientBalance: true,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: true });
  });

  it('disables insufficient wrapped pairs for supported accounts', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isInsufficientBalance: true,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: true, shouldJumpToSwap: false });
  });
});

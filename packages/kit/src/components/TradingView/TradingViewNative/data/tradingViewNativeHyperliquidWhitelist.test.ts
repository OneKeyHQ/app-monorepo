import { getTradingViewNativeWhitelistedHyperliquidSource } from './tradingViewNativeHyperliquidWhitelist';

describe('TradingViewNative Hyperliquid whitelist', () => {
  it('maps native Bitcoin independently for each configured branch', () => {
    const token = {
      isNative: true,
      networkId: 'btc--0',
      tokenAddress: '',
    };

    expect(
      (['swap', 'market', 'wallet'] as const).map((branch) =>
        getTradingViewNativeWhitelistedHyperliquidSource({
          branch,
          token,
        }),
      ),
    ).toEqual([
      { coin: 'BTC', type: 'hyperliquid' },
      { coin: 'BTC', type: 'hyperliquid' },
      { coin: 'BTC', type: 'hyperliquid' },
    ]);
  });

  it('maps native Ethereum independently for each configured branch', () => {
    const token = {
      isNative: true,
      networkId: 'evm--1',
      tokenAddress: '',
    };

    expect(
      (['swap', 'market', 'wallet'] as const).map((branch) =>
        getTradingViewNativeWhitelistedHyperliquidSource({
          branch,
          token,
        }),
      ),
    ).toEqual([
      { coin: 'ETH', type: 'hyperliquid' },
      { coin: 'ETH', type: 'hyperliquid' },
      { coin: 'ETH', type: 'hyperliquid' },
    ]);
  });

  it('maps native BNB independently for each configured branch', () => {
    const token = {
      isNative: true,
      networkId: 'evm--56',
      tokenAddress: '',
    };

    expect(
      (['swap', 'market', 'wallet'] as const).map((branch) =>
        getTradingViewNativeWhitelistedHyperliquidSource({
          branch,
          token,
        }),
      ),
    ).toEqual([
      { coin: 'BNB', type: 'hyperliquid' },
      { coin: 'BNB', type: 'hyperliquid' },
      { coin: 'BNB', type: 'hyperliquid' },
    ]);
  });

  it('maps native HyperEVM HYPE to its preferred spot market', () => {
    expect(
      getTradingViewNativeWhitelistedHyperliquidSource({
        branch: 'swap',
        token: {
          isNative: true,
          networkId: 'evm--999',
          tokenAddress: '',
        },
      }),
    ).toEqual({ coin: '@107', type: 'hyperliquid' });
  });

  it('does not match contract tokens or another network', () => {
    expect(
      getTradingViewNativeWhitelistedHyperliquidSource({
        branch: 'market',
        token: {
          isNative: false,
          networkId: 'btc--0',
          tokenAddress: 'ordinals-token',
        },
      }),
    ).toBeUndefined();
    expect(
      getTradingViewNativeWhitelistedHyperliquidSource({
        branch: 'market',
        token: {
          isNative: true,
          networkId: 'evm--137',
          tokenAddress: '',
        },
      }),
    ).toBeUndefined();
  });

  it('keeps branch enablement independent', () => {
    const hypeToken = {
      isNative: true,
      networkId: 'evm--999',
      tokenAddress: '',
    };

    expect(
      getTradingViewNativeWhitelistedHyperliquidSource({
        branch: 'market',
        token: hypeToken,
      }),
    ).toBeUndefined();
    expect(
      getTradingViewNativeWhitelistedHyperliquidSource({
        branch: 'wallet',
        token: hypeToken,
      }),
    ).toBeUndefined();
  });
});

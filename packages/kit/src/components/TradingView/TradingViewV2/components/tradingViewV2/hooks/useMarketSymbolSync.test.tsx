/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useMarketTradingViewFrameIdentity } from './useMarketSymbolSync';

describe('useMarketTradingViewFrameIdentity', () => {
  it('reloads the warmup frame with the first real market identity', () => {
    const staticTradingViewUrl = 'https://tradingview.onekey.so/?type=market';
    const warmupIdentity = {
      symbol: 'ONEKEY_PREWARM',
      tokenAddress: '',
      networkId: '',
      decimal: 8,
    };
    const realIdentity = {
      symbol: 'ONE',
      tokenAddress: '0x1',
      networkId: 'evm--1',
      decimal: 8,
    };
    const { result, rerender } = renderHook(
      ({
        identity,
        symbolSyncSupport,
      }: {
        identity: typeof warmupIdentity;
        symbolSyncSupport: boolean | undefined;
      }) =>
        useMarketTradingViewFrameIdentity({
          staticTradingViewUrl,
          identity,
          symbolSyncSupport,
        }),
      {
        initialProps: {
          identity: warmupIdentity,
          symbolSyncSupport: undefined,
        },
      },
    );

    expect(result.current.identity).toEqual(warmupIdentity);

    rerender({
      identity: realIdentity,
      symbolSyncSupport: undefined,
    });

    expect(result.current.identity).toEqual(realIdentity);
  });

  it('keeps a ready frame stable when symbol sync is available', () => {
    const staticTradingViewUrl = 'https://tradingview.onekey.so/?type=market';
    const firstIdentity = {
      symbol: 'ONE',
      tokenAddress: '0x1',
      networkId: 'evm--1',
      decimal: 8,
    };
    const nextIdentity = {
      symbol: 'TWO',
      tokenAddress: '0x2',
      networkId: 'evm--1',
      decimal: 8,
    };
    const { result, rerender } = renderHook(
      ({ identity }: { identity: typeof firstIdentity }) =>
        useMarketTradingViewFrameIdentity({
          staticTradingViewUrl,
          identity,
          symbolSyncSupport: true,
        }),
      { initialProps: { identity: firstIdentity } },
    );

    rerender({ identity: nextIdentity });

    expect(result.current.identity).toEqual(firstIdentity);
  });
});

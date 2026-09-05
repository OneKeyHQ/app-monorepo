/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig';

import { useHyperLiquidKlineSource } from './useHyperLiquidKlineSource';

jest.mock('@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig', () => ({
  useMarketBasicConfig: jest.fn(),
}));

const mockUseMarketBasicConfig = jest.mocked(useMarketBasicConfig);

describe('useHyperLiquidKlineSource', () => {
  it('keeps the source unresolved before the initial request starts', () => {
    mockUseMarketBasicConfig.mockReturnValue({
      basicConfig: undefined,
      isLoading: undefined,
    } as ReturnType<typeof useMarketBasicConfig>);

    const { result } = renderHook(() =>
      useHyperLiquidKlineSource('btc--0', ''),
    );

    expect(result.current).toEqual({
      isHyperLiquidSource: false,
      symbol: undefined,
      isLoading: true,
    });
  });

  it('keeps the source unresolved while market config is loading', () => {
    mockUseMarketBasicConfig.mockReturnValue({
      basicConfig: undefined,
      isLoading: true,
    } as ReturnType<typeof useMarketBasicConfig>);

    const { result } = renderHook(() =>
      useHyperLiquidKlineSource('btc--0', ''),
    );

    expect(result.current).toEqual({
      isHyperLiquidSource: false,
      symbol: undefined,
      isLoading: true,
    });
  });

  it('finishes source detection when market config is unavailable', () => {
    mockUseMarketBasicConfig.mockReturnValue({
      basicConfig: undefined,
      isLoading: false,
    } as ReturnType<typeof useMarketBasicConfig>);

    const { result } = renderHook(() =>
      useHyperLiquidKlineSource('btc--0', ''),
    );

    expect(result.current).toEqual({
      isHyperLiquidSource: false,
      symbol: undefined,
      isLoading: false,
    });
  });

  it('selects the Hyperliquid source for configured BTC', () => {
    mockUseMarketBasicConfig.mockReturnValue({
      basicConfig: {
        HyperLiquidKlineSourceTokens: [
          {
            networkId: 'btc--0',
            tokenAddress: '',
            symbol: 'BTC',
          },
        ],
      },
      isLoading: false,
    } as ReturnType<typeof useMarketBasicConfig>);

    const { result } = renderHook(() =>
      useHyperLiquidKlineSource('btc--0', ''),
    );

    expect(result.current).toEqual({
      isHyperLiquidSource: true,
      symbol: 'BTC',
      isLoading: false,
    });
  });

  it('keeps an explicit fallback source ahead of the Hyperliquid whitelist', () => {
    mockUseMarketBasicConfig.mockReturnValue({
      basicConfig: {
        HyperLiquidKlineSourceTokens: [
          {
            networkId: 'btc--0',
            tokenAddress: '',
            symbol: 'BTC',
          },
        ],
      },
      isLoading: false,
    } as ReturnType<typeof useMarketBasicConfig>);

    const { result } = renderHook(() =>
      useHyperLiquidKlineSource('btc--0', '', { disabled: true }),
    );

    expect(result.current).toEqual({
      isHyperLiquidSource: false,
      symbol: undefined,
      isLoading: false,
    });
  });

  it('keeps using loaded config while it is being revalidated', () => {
    mockUseMarketBasicConfig.mockReturnValue({
      basicConfig: {
        HyperLiquidKlineSourceTokens: [
          {
            networkId: 'btc--0',
            tokenAddress: '',
            symbol: 'BTC',
          },
        ],
      },
      isLoading: true,
    } as ReturnType<typeof useMarketBasicConfig>);

    const { result } = renderHook(() =>
      useHyperLiquidKlineSource('btc--0', ''),
    );

    expect(result.current).toEqual({
      isHyperLiquidSource: true,
      symbol: 'BTC',
      isLoading: false,
    });
  });
});

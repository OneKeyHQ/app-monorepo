import { renderHook } from '@testing-library/react-native';

import { useTradingPrice } from './useTradingPrice';

let mockSpotMid: string | undefined;
let mockSpotMark: string | undefined;
let mockAllMids: string | undefined;
let mockPerpMid: string | undefined;
let mockMode: 'spot' | 'perp' = 'spot';
let mockActiveCoin = 'HYPE';
let mockContextCoin = 'HYPE';
const mockMidByCoin = jest.fn((_coin: string) => mockAllMids);

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [
    { mode: mockMode, coin: mockMode === 'spot' ? '@1' : mockActiveCoin },
  ],
  usePerpsMidByCoin: (coin: string) => mockMidByCoin(coin),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAssetCtxMidPriceBySource: (_source: string, coin?: string) =>
    coin === undefined || coin === mockContextCoin ? mockPerpMid : undefined,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/spot', () => ({
  useSpotActiveAssetCtxMidPriceAtom: () => [mockSpotMid],
  useSpotActiveAssetCtxMarkPriceAtom: () => [mockSpotMark],
}));

describe('useTradingPrice spot mid estimation', () => {
  beforeEach(() => {
    mockMode = 'spot';
    mockPerpMid = undefined;
    mockSpotMid = undefined;
    mockSpotMark = '102';
    mockAllMids = undefined;
  });

  it('does not substitute mark when a consumer requires mid', () => {
    const { result } = renderHook(() =>
      useTradingPrice({ allowSpotMarkPriceFallback: false }),
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.midPrice).toBeUndefined();
  });

  it('uses allMids rather than mark when the context mid is missing', () => {
    mockAllMids = '100';
    const { result } = renderHook(() =>
      useTradingPrice({ allowSpotMarkPriceFallback: false }),
    );
    expect(result.current.midPriceBN.toFixed()).toBe('100');
  });

  it('preserves the existing fallback for other consumers', () => {
    const { result } = renderHook(() => useTradingPrice());
    expect(result.current.midPriceBN.toFixed()).toBe('102');
  });
});

describe('useTradingPrice live perp mid', () => {
  beforeEach(() => {
    mockMode = 'perp';
    mockActiveCoin = 'HYPE';
    mockContextCoin = 'HYPE';
    mockPerpMid = '78.538';
    mockAllMids = '78.5';
  });

  it('updates with the live active context instead of retaining the previous price', () => {
    const { result, rerender } = renderHook(() => useTradingPrice());
    expect(result.current.midPrice).toBe('78.538');
    mockPerpMid = '78.542';
    rerender({});
    expect(result.current.midPrice).toBe('78.542');
    expect(result.current.isValid).toBe(true);
  });

  it('falls back to allMids and stays unavailable when neither mid feed has a value', () => {
    mockPerpMid = undefined;
    const { result, rerender } = renderHook(() => useTradingPrice());
    expect(result.current.midPrice).toBe('78.5');
    mockAllMids = undefined;
    rerender({});
    expect(result.current.midPrice).toBeUndefined();
    expect(result.current.isValid).toBe(false);
  });
});

it('binds a route quote to its coin while instrument and context switch independently', () => {
  mockMode = 'perp';
  mockActiveCoin = 'ETH';
  mockContextCoin = 'ETH';
  mockPerpMid = '3000';
  mockAllMids = '80000';
  const { result, rerender } = renderHook(() =>
    useTradingPrice({ perpCoin: 'BTC' }),
  );
  expect(mockMidByCoin).toHaveBeenLastCalledWith('BTC');
  expect(result.current.midPrice).toBe('80000');
  mockActiveCoin = 'BTC';
  rerender({});
  expect(result.current.midPrice).toBe('80000');
  mockAllMids = undefined;
  rerender({});
  expect(result.current.isValid).toBe(false);
  mockContextCoin = 'BTC';
  mockPerpMid = '80010';
  rerender({});
  expect(result.current.midPrice).toBe('80010');
});

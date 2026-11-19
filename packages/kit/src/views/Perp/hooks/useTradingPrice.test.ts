import { renderHook } from '@testing-library/react-native';

import { useTradingPrice } from './useTradingPrice';

let mockSpotMid: string | undefined;
let mockSpotMark: string | undefined;
let mockAllMids: string | undefined;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'spot', coin: '@1' }],
  usePerpsMidByCoin: () => mockAllMids,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAssetCtxMidPriceBySource: () => undefined,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/spot', () => ({
  useSpotActiveAssetCtxMidPriceAtom: () => [mockSpotMid],
  useSpotActiveAssetCtxMarkPriceAtom: () => [mockSpotMark],
}));

describe('useTradingPrice spot mid estimation', () => {
  beforeEach(() => {
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

/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';
import { BigNumber } from 'bignumber.js';

import { useTwapReferencePrice } from './useTwapReferencePrice';

let mockInstrumentMode: 'perp' | 'spot' = 'perp';
let mockCtxMarkPrice: string | undefined = '100';
let mockActiveAssetData: { markPx: string } | undefined;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [
    { coin: 'ETH', mode: mockInstrumentMode },
  ],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAssetCtxMarkPriceAtom: () => [mockCtxMarkPrice],
  usePerpsActiveAssetDataAtom: () => [mockActiveAssetData],
}));

describe('useTwapReferencePrice', () => {
  beforeEach(() => {
    mockInstrumentMode = 'perp';
    mockCtxMarkPrice = '100';
    mockActiveAssetData = undefined;
  });

  it('uses the market-wide mark price when available', () => {
    mockActiveAssetData = { markPx: '99' };

    const { result } = renderHook(() =>
      useTwapReferencePrice({ midPriceBN: new BigNumber(95) }),
    );

    expect(result.current.toFixed()).toBe('100');
  });

  it('falls back to the account mark while market context is loading', () => {
    mockCtxMarkPrice = undefined;
    mockActiveAssetData = { markPx: '99' };

    const { result } = renderHook(() =>
      useTwapReferencePrice({ midPriceBN: new BigNumber(95) }),
    );

    expect(result.current.toFixed()).toBe('99');
  });

  it('is not finite while both mark price feeds are loading', () => {
    mockCtxMarkPrice = undefined;
    mockActiveAssetData = undefined;

    const { result } = renderHook(() =>
      useTwapReferencePrice({ midPriceBN: new BigNumber(95) }),
    );

    expect(result.current.isFinite()).toBe(false);
  });

  it('uses the mid price for spot', () => {
    mockInstrumentMode = 'spot';

    const { result } = renderHook(() =>
      useTwapReferencePrice({ midPriceBN: new BigNumber(95) }),
    );

    expect(result.current.toFixed()).toBe('95');
  });
});

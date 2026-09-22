/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';
import { BigNumber } from 'bignumber.js';

import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useTradingCalculationsForSide } from './useTradingCalculationsForSide';

const mockFormData = {
  orderMode: 'twap' as const,
  sizeInputMode: EPerpsSizeInputMode.MANUAL,
  size: '2',
  sizePercent: 0,
  scaleReduceOnly: false,
  twapReduceOnly: false,
};
let mockActiveAssetCtx: { ctx: { markPrice: string } } | undefined = {
  ctx: { markPrice: '100' },
};
let mockActiveAssetData:
  | { leverage: { value: number }; markPx: string }
  | undefined;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ coin: 'ETH', mode: 'perp' }],
  useTradingFormCalculationParams: () => mockFormData,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAssetAtom: () => [
    {
      coin: 'ETH',
      universe: { maxLeverage: 20, szDecimals: 4 },
    },
  ],
  usePerpsActiveAssetCtxAtom: () => [mockActiveAssetCtx],
  usePerpsActiveAssetDataAtom: () => [mockActiveAssetData],
  useSpotBalancesAtom: () => [{ balances: [] }],
}));

jest.mock('./useOrderPrice', () => ({
  useOrderPrice: () => ({ price: new BigNumber(90), error: undefined }),
}));

jest.mock('./usePerpsAccountScopedActivePositions', () => ({
  usePerpsAccountScopedActivePositions: () => [],
}));

jest.mock('./useTradingPrice', () => ({
  useTradingPrice: () => ({ midPriceBN: new BigNumber(95) }),
}));

describe('useTradingCalculationsForSide', () => {
  beforeEach(() => {
    mockActiveAssetCtx = { ctx: { markPrice: '100' } };
    mockActiveAssetData = undefined;
  });

  it('uses market-wide mark price for TWAP while account data is loading', () => {
    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.computedSizeForSide.toFixed()).toBe('2');
    expect(result.current.orderValue.toFixed()).toBe('200');
  });

  it('uses the account mark for all TWAP calculations while market context is loading', () => {
    mockActiveAssetCtx = undefined;
    mockActiveAssetData = { leverage: { value: 2 }, markPx: '100' };

    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.computedSizeForSide.toFixed()).toBe('2');
    expect(result.current.orderValue.toFixed()).toBe('200');
    expect(result.current.marginRequired.toFixed()).toBe('100');
  });

  it('does not report insufficient margin while account data is still loading', () => {
    mockActiveAssetCtx = { ctx: { markPrice: '100' } };
    mockActiveAssetData = undefined;

    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.isNoEnoughMargin).toBe(false);
  });
});

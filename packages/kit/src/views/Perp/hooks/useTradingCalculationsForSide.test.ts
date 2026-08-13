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
  usePerpsActiveAssetCtxAtom: () => [{ ctx: { markPrice: '100' } }],
  usePerpsActiveAssetDataAtom: () => [undefined],
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
  it('uses market-wide mark price for TWAP while account data is loading', () => {
    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.computedSizeForSide.toFixed()).toBe('2');
    expect(result.current.orderValue.toFixed()).toBe('200');
  });
});

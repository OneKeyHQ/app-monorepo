/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';
import { BigNumber } from 'bignumber.js';

import {
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useTradingCalculationsForSide } from './useTradingCalculationsForSide';

const mockFormData = {
  orderMode: 'twap' as 'twap' | 'standard',
  sizeInputMode: EPerpsSizeInputMode.MANUAL,
  size: '2',
  sizePercent: 0,
  scaleReduceOnly: false,
  twapReduceOnly: false,
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
  usePerpsTwapMarkPrice: jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms/perps')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms/perps').usePerpsTwapMarkPrice,
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

function setMarketContext(markPrice: string | undefined, fundingRate = '0') {
  jotaiDefaultStore.set(
    perpsActiveAssetCtxAtom.atom(),
    markPrice
      ? {
          coin: 'ETH',
          assetId: 1,
          ctx: {
            midPrice: '95',
            lastPrice: '95',
            markPrice,
            oraclePrice: '100',
            prevDayPrice: '100',
            fundingRate,
            openInterest: '10',
            volume24h: '10',
            change24h: '0',
            change24hPercent: 0,
          },
        }
      : undefined,
  );
}

function setAccountMarkPrice() {
  mockActiveAssetData = { leverage: { value: 2 }, markPx: '100' };
  jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), {
    accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    coin: 'ETH',
    assetId: 1,
    leverage: { type: 'cross', value: 2 },
    maxTradeSzs: ['10', '10'],
    availableToTrade: ['500', '500'],
    markPx: '100',
  });
}

describe('useTradingCalculationsForSide', () => {
  beforeEach(() => {
    mockFormData.orderMode = 'twap';
    setMarketContext('100');
    mockActiveAssetData = undefined;
    jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), undefined);
  });

  it('uses market-wide mark price for TWAP while account data is loading', () => {
    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.computedSizeForSide.toFixed()).toBe('2');
    expect(result.current.orderValue.toFixed()).toBe('200');
  });

  it('uses the account mark for all TWAP calculations while market context is loading', () => {
    setMarketContext(undefined);
    setAccountMarkPrice();

    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.computedSizeForSide.toFixed()).toBe('2');
    expect(result.current.orderValue.toFixed()).toBe('200');
    expect(result.current.marginRequired.toFixed()).toBe('100');
  });

  it('preserves the order price for standard orders', () => {
    mockFormData.orderMode = 'standard';
    setAccountMarkPrice();

    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.orderValue.toFixed()).toBe('180');
  });

  it('does not rerender standard orders on TWAP market updates', () => {
    mockFormData.orderMode = 'standard';
    setAccountMarkPrice();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useTradingCalculationsForSide('long');
    });
    const initialRenders = renders;
    for (let i = 1; i <= 20; i += 1) {
      act(() => setMarketContext(String(100 + i), String(i)));
    }
    expect(renders).toBe(initialRenders);
  });

  it('does not report insufficient margin while account data is still loading', () => {
    setMarketContext('100');
    mockActiveAssetData = undefined;

    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.isNoEnoughMargin).toBe(false);
  });
});

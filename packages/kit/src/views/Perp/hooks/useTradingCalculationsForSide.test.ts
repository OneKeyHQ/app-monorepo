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
import { useTwapReferencePrice } from './useTwapReferencePrice';

const mockFormData = {
  orderMode: 'twap' as 'twap' | 'standard',
  sizeInputMode: EPerpsSizeInputMode.MANUAL,
  size: '2',
  sizePercent: 0,
  scaleReduceOnly: false,
  twapReduceOnly: false,
};
let mockInstrumentMode: 'perp' | 'spot' = 'perp';

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [
    { coin: 'ETH', mode: mockInstrumentMode },
  ],
  useTradingFormCalculationParams: () => mockFormData,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms/perps')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms/perps'),
  usePerpsActiveAssetAtom: () => [
    {
      coin: 'ETH',
      universe: { maxLeverage: 20, szDecimals: 4 },
    },
  ],
  useSpotActiveAssetCtxMarkPriceAtom: () => ['102'],
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
    mockInstrumentMode = 'perp';
    setMarketContext('100');
    jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), undefined);
  });

  it('uses market-wide mark price for TWAP while account data is loading', () => {
    const { result } = renderHook(() => useTradingCalculationsForSide('long'));

    expect(result.current.computedSizeForSide.toFixed()).toBe('2');
    expect(result.current.orderValue.toFixed()).toBe('200');
    expect(result.current.isNoEnoughMargin).toBe(false);
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
    act(() => setMarketContext('101', '0.01'));
    expect(renders).toBe(initialRenders);
  });

  it('separates spot sizing from mark conditions and subscribes to perp mark only for TWAP', () => {
    mockInstrumentMode = 'spot';
    let renders = 0;
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => {
        renders += 1;
        return useTwapReferencePrice({
          midPriceBN: new BigNumber(95),
          enabled,
        });
      },
      { initialProps: { enabled: false } },
    );
    expect(result.current.sizePriceBN.toFixed()).toBe('95');
    expect(result.current.markPriceBN.toFixed()).toBe('102');
    mockInstrumentMode = 'perp';
    rerender({ enabled: false });
    expect(result.current.markPriceBN.isFinite()).toBe(false);
    rerender({ enabled: true });
    act(() => setMarketContext('102'));
    expect(result.current.markPriceBN.toFixed()).toBe('102');
    expect(result.current.sizePriceBN.toFixed()).toBe('102');
    act(() => setMarketContext(undefined));
    expect(result.current.markPriceBN.isFinite()).toBe(false);
    rerender({ enabled: false });
    const stoppedRenders = renders;
    act(() => setMarketContext('103'));
    expect(renders).toBe(stoppedRenders);
  });
});

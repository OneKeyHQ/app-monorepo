/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';
import { BigNumber } from 'bignumber.js';

import {
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import type { IPerpsActiveAssetData } from '@onekeyhq/shared/types/hyperliquid';

import { useTwapReferencePrice } from './useTwapReferencePrice';

let mockInstrumentMode: 'perp' | 'spot' = 'perp';

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [
    { coin: 'ETH', mode: mockInstrumentMode },
  ],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () =>
  jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms/perps')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms/perps'),
);

const marketContext = {
  coin: 'ETH',
  assetId: 1,
  ctx: {
    midPrice: '95',
    lastPrice: '95',
    markPrice: '100',
    oraclePrice: '100',
    prevDayPrice: '100',
    fundingRate: '0',
    openInterest: '10',
    volume24h: '10',
    change24h: '0',
    change24hPercent: 0,
  },
};
const accountData: IPerpsActiveAssetData = {
  accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  coin: 'ETH',
  assetId: 1,
  leverage: { type: 'cross', value: 2 },
  maxTradeSzs: ['10', '10'],
  availableToTrade: ['500', '500'],
  markPx: '99',
};
const midPriceBN = new BigNumber(95);

function updateMarket(markPrice = '100', fundingRate = '0') {
  act(() => {
    jotaiDefaultStore.set(perpsActiveAssetCtxAtom.atom(), {
      ...marketContext,
      ctx: { ...marketContext.ctx, markPrice, fundingRate },
    });
  });
}

describe('useTwapReferencePrice', () => {
  beforeEach(() => {
    mockInstrumentMode = 'perp';
    jotaiDefaultStore.set(perpsActiveAssetCtxAtom.atom(), marketContext);
    jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), undefined);
  });

  it('uses the market-wide mark price when available', () => {
    jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), accountData);
    const { result } = renderHook(() =>
      useTwapReferencePrice({ midPriceBN, enabled: true }),
    );
    expect(result.current.toFixed()).toBe('100');
  });

  it('falls back to the account mark while market context is loading', () => {
    jotaiDefaultStore.set(perpsActiveAssetCtxAtom.atom(), undefined);
    jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), accountData);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useTwapReferencePrice({ midPriceBN, enabled: true });
    });
    const initialRenders = renders;
    expect(result.current.toFixed()).toBe('99');

    act(() => {
      jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), {
        ...accountData,
        leverage: { type: 'cross', value: 3 },
      });
    });
    expect(renders).toBe(initialRenders);

    act(() => {
      jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), {
        ...accountData,
        markPx: '101',
      });
    });
    expect(result.current.toFixed()).toBe('101');

    updateMarket('102');
    expect(result.current.toFixed()).toBe('102');
  });

  it('is not finite while both mark price feeds are loading', () => {
    jotaiDefaultStore.set(perpsActiveAssetCtxAtom.atom(), undefined);
    const { result } = renderHook(() =>
      useTwapReferencePrice({ midPriceBN, enabled: true }),
    );
    expect(result.current.isFinite()).toBe(false);
  });

  it('uses the mid price for spot without subscribing to perp feeds', () => {
    mockInstrumentMode = 'spot';
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useTwapReferencePrice({ midPriceBN, enabled: true });
    });
    const initialRenders = renders;
    updateMarket('101');
    expect(result.current.toFixed()).toBe('95');
    expect(renders).toBe(initialRenders);
  });

  it('ignores unrelated market and account updates while TWAP is enabled', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useTwapReferencePrice({ midPriceBN, enabled: true });
    });
    const initialRenders = renders;
    for (let i = 1; i <= 20; i += 1) {
      updateMarket('100', String(i));
    }
    act(() => {
      jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), accountData);
    });
    expect(renders).toBe(initialRenders);
  });

  it('starts and stops live subscriptions when switching into and out of TWAP', () => {
    let renders = 0;
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => {
        renders += 1;
        return useTwapReferencePrice({ midPriceBN, enabled });
      },
      { initialProps: { enabled: false } },
    );
    const disabledRenders = renders;
    updateMarket('101');
    act(() => {
      jotaiDefaultStore.set(perpsActiveAssetDataAtom.atom(), accountData);
    });
    expect(renders).toBe(disabledRenders);

    rerender({ enabled: true });
    expect(result.current.toFixed()).toBe('101');
    updateMarket('102');
    expect(result.current.toFixed()).toBe('102');

    rerender({ enabled: false });
    const stoppedRenders = renders;
    updateMarket('103');
    expect(renders).toBe(stoppedRenders);
  });
});

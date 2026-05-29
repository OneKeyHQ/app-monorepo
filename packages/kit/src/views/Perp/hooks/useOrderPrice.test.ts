/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';
import { BigNumber } from 'bignumber.js';

import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

import { calculateOrderPrice, useOrderPrice } from './useOrderPrice';

const now = 1_000_000;
let mockBbo: (HL.IWsBbo & { localReceivedAt?: number }) | null;
let mockFormData: {
  type: 'market' | 'limit';
  price: string;
  bboPriceMode?: { type: 'counterparty' | 'queue'; level: number } | null;
  orderMode?: 'standard' | 'trigger';
  triggerOrderType?: undefined;
  triggerPrice?: string;
  executionPrice?: string;
};
let mockMidPriceBN: BigNumber;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useBboAtom: () => [mockBbo],
  useTradingFormAtom: () => [mockFormData],
}));

jest.mock('./useTradingPrice', () => ({
  useTradingPrice: () => ({ midPriceBN: mockMidPriceBN }),
}));

function buildBbo({
  time = now,
  localReceivedAt = now,
}: {
  time?: number;
  localReceivedAt?: number;
} = {}): HL.IWsBbo & { localReceivedAt?: number } {
  return {
    coin: 'ETH',
    time,
    localReceivedAt,
    bbo: [
      { px: '100', sz: '1', n: 1 },
      { px: '101', sz: '1', n: 1 },
    ],
  };
}

describe('calculateOrderPrice BBO freshness', () => {
  it('uses a fresh BBO price for limit BBO orders', () => {
    const result = calculateOrderPrice(
      'limit',
      '',
      { type: 'counterparty', level: 1 },
      buildBbo(),
      new BigNumber(100.5),
      'long',
      'standard',
      undefined,
      undefined,
      undefined,
      now,
    );

    expect(result.error).toBeNull();
    expect(result.isValid).toBe(true);
    expect(result.price.toFixed()).toBe('101');
  });

  it('rejects stale BBO prices even when the server timestamp is ahead', () => {
    const result = calculateOrderPrice(
      'limit',
      '',
      { type: 'counterparty', level: 1 },
      buildBbo({
        time: now + 60_000,
        localReceivedAt: now - PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS - 1,
      }),
      new BigNumber(100.5),
      'long',
      'standard',
      undefined,
      undefined,
      undefined,
      now,
    );

    expect(result.error).toBe('bbo_unavailable');
    expect(result.isValid).toBe(false);
    expect(result.price.toFixed()).toBe('0');
  });
});

describe('useOrderPrice BBO freshness refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    mockBbo = buildBbo();
    mockFormData = {
      type: 'limit',
      price: '',
      bboPriceMode: { type: 'counterparty', level: 1 },
      orderMode: 'standard',
    };
    mockMidPriceBN = new BigNumber(100.5);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('recomputes the BBO error when the freshness TTL expires without BBO updates', () => {
    const { result } = renderHook(() => useOrderPrice('long'));

    expect(result.current.error).toBeNull();
    expect(result.current.price.toFixed()).toBe('101');

    act(() => {
      jest.setSystemTime(now + PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS + 1);
      jest.advanceTimersByTime(PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS + 1);
    });

    expect(result.current.error).toBe('bbo_unavailable');
    expect(result.current.isValid).toBe(false);
  });
});

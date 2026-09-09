import type { IPerpsBboWithLocalReceivedAt } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';

import {
  getAggressiveLimitPriceWarning,
  getAggressiveLimitPriceWarningFromBbo,
  shouldShowOrderConfirm,
} from './aggressiveLimitPrice';

const NOW = 10_000;
const freshBbo: IPerpsBboWithLocalReceivedAt = {
  coin: 'BTC',
  time: NOW,
  localReceivedAt: NOW,
  bbo: [
    { px: '99', sz: '1', n: 1 },
    { px: '100', sz: '1', n: 1 },
  ],
};

describe('aggressiveLimitPrice', () => {
  it('warns when a long limit is at least 3% above the best ask', () => {
    expect(
      getAggressiveLimitPriceWarning({
        side: 'long',
        limitPrice: '103',
        bestAsk: '100',
      }),
    ).toEqual({
      side: 'long',
      deviationPercent: 3,
      referencePrice: '100',
    });
  });

  it('warns when a short limit is at least 3% below the best bid', () => {
    expect(
      getAggressiveLimitPriceWarning({
        side: 'short',
        limitPrice: '96.03',
        bestBid: '99',
      }),
    ).toEqual({
      side: 'short',
      deviationPercent: 3,
      referencePrice: '99',
    });
  });

  it('does not warn below the threshold or for invalid prices', () => {
    expect(
      getAggressiveLimitPriceWarning({
        side: 'long',
        limitPrice: '102.99',
        bestAsk: '100',
      }),
    ).toBeUndefined();
    expect(
      getAggressiveLimitPriceWarning({
        side: 'short',
        limitPrice: '0',
        bestBid: '99',
      }),
    ).toBeUndefined();
  });

  it.each([
    { type: 'market' as const, orderMode: 'standard' as const },
    { type: 'limit' as const, orderMode: 'trigger' as const },
  ])('ignores unsupported order shape %#', ({ type, orderMode }) => {
    expect(
      getAggressiveLimitPriceWarningFromBbo({
        coin: 'BTC',
        side: 'long',
        type,
        orderMode,
        limitPrice: '110',
        bbo: freshBbo,
        now: NOW,
      }),
    ).toBeUndefined();
  });

  it('ignores post-only, BBO-priced, mismatched, or stale orders', () => {
    const baseParams = {
      coin: 'BTC',
      side: 'long' as const,
      type: 'limit' as const,
      orderMode: 'standard' as const,
      limitPrice: '110',
      bbo: freshBbo,
      now: NOW,
    };
    expect(
      getAggressiveLimitPriceWarningFromBbo({
        ...baseParams,
        limitTif: 'Alo',
      }),
    ).toBeUndefined();
    expect(
      getAggressiveLimitPriceWarningFromBbo({
        ...baseParams,
        bboPriceMode: { type: 'counterparty', offsetTicks: 0 },
      }),
    ).toBeUndefined();
    expect(
      getAggressiveLimitPriceWarningFromBbo({
        ...baseParams,
        coin: 'ETH',
      }),
    ).toBeUndefined();
    expect(
      getAggressiveLimitPriceWarningFromBbo({
        ...baseParams,
        now: NOW + 60_000,
      }),
    ).toBeUndefined();
  });

  it('forces confirmation for an aggressive order even when confirmations are skipped', () => {
    expect(
      shouldShowOrderConfirm({
        skipOrderConfirm: true,
        aggressiveLimitPriceWarning: {
          side: 'long',
          deviationPercent: 3,
          referencePrice: '100',
        },
      }),
    ).toBe(true);
    expect(
      shouldShowOrderConfirm({
        skipOrderConfirm: true,
      }),
    ).toBe(false);
    expect(
      shouldShowOrderConfirm({
        skipOrderConfirm: false,
      }),
    ).toBe(true);
  });

  it('detects a supported standard GTC order from a fresh BBO', () => {
    expect(
      getAggressiveLimitPriceWarningFromBbo({
        coin: 'BTC',
        side: 'long',
        type: 'limit',
        orderMode: 'standard',
        limitPrice: '103',
        limitTif: 'Gtc',
        bbo: freshBbo,
        now: NOW,
      }),
    ).toEqual({
      side: 'long',
      deviationPercent: 3,
      referencePrice: '100',
    });
  });
});

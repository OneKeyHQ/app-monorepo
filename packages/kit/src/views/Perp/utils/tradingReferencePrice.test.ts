import BigNumber from 'bignumber.js';

import { resolveStandardReferencePriceBN } from './tradingReferencePrice';

describe('resolveStandardReferencePriceBN', () => {
  const midPriceBN = new BigNumber('100.5');

  it('follows the live BBO order price while BBO is active, ignoring the stale form price', () => {
    const result = resolveStandardReferencePriceBN({
      type: 'limit',
      bboPriceMode: { type: 'counterparty', offsetTicks: 0 },
      orderPriceBN: new BigNumber('101'),
      formPrice: '99',
      midPriceBN,
    });
    expect(result.toFixed()).toBe('101');
  });

  it('tracks BBO updates so size conversion recomputes from the new price', () => {
    const args = {
      type: 'limit' as const,
      bboPriceMode: { type: 'counterparty', offsetTicks: 0 } as const,
      formPrice: '',
      midPriceBN,
    };
    const before = resolveStandardReferencePriceBN({
      ...args,
      orderPriceBN: new BigNumber('101'),
    });
    const after = resolveStandardReferencePriceBN({
      ...args,
      orderPriceBN: new BigNumber('102.5'),
    });
    expect(before.toFixed()).toBe('101');
    expect(after.toFixed()).toBe('102.5');
  });

  it('falls back to the typed form price once BBO is cleared', () => {
    const result = resolveStandardReferencePriceBN({
      type: 'limit',
      bboPriceMode: null,
      orderPriceBN: new BigNumber('101'),
      formPrice: '99',
      midPriceBN,
    });
    expect(result.toFixed()).toBe('99');
  });

  it('uses the mid price for market orders', () => {
    const result = resolveStandardReferencePriceBN({
      type: 'market',
      bboPriceMode: null,
      orderPriceBN: new BigNumber('101'),
      formPrice: '',
      midPriceBN,
    });
    expect(result.toFixed()).toBe('100.5');
  });
});

import { shouldApplyMinimumOrderGuard } from './minimumOrderGuard';

describe('shouldApplyMinimumOrderGuard', () => {
  it('skips the local minimum guard for standard spot limit orders', () => {
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: true,
        orderMode: 'standard',
        orderType: 'limit',
      }),
    ).toBe(false);
  });

  it('keeps the guard for spot BBO limit orders', () => {
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: true,
        orderMode: 'standard',
        orderType: 'limit',
        hasBboPriceMode: true,
      }),
    ).toBe(true);
  });

  it('keeps the guard for non-spot and non-standard-limit orders', () => {
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: false,
        orderMode: 'standard',
        orderType: 'limit',
      }),
    ).toBe(true);
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: true,
        orderMode: 'standard',
        orderType: 'market',
      }),
    ).toBe(true);
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: true,
        orderMode: 'trigger',
        orderType: 'limit',
      }),
    ).toBe(true);
  });
});

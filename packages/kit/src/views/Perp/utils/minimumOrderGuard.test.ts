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

  it('keeps the guard for perp standard limit orders', () => {
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: false,
        orderMode: 'standard',
        orderType: 'limit',
      }),
    ).toBe(true);
  });

  it('keeps the guard for spot standard market orders', () => {
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: true,
        orderMode: 'standard',
        orderType: 'market',
      }),
    ).toBe(true);
  });

  it('keeps the guard for spot trigger limit orders', () => {
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: true,
        orderMode: 'trigger',
        orderType: 'limit',
      }),
    ).toBe(true);
  });

  it('keeps the guard for scale orders', () => {
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: false,
        orderMode: 'scale',
        orderType: 'limit',
      }),
    ).toBe(true);
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: true,
        orderMode: 'scale',
        orderType: 'limit',
      }),
    ).toBe(true);
  });

  it('keeps the guard for twap orders', () => {
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: false,
        orderMode: 'twap',
        orderType: 'market',
      }),
    ).toBe(true);
    expect(
      shouldApplyMinimumOrderGuard({
        isSpot: true,
        orderMode: 'twap',
        orderType: 'market',
      }),
    ).toBe(true);
  });
});

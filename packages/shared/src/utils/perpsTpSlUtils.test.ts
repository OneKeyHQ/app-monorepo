import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { classifyTpSlOrder, getTpSlKind } from './perpsTpSlUtils';

// orderType is widened to string: some real runtime values (notably the bare
// "Trigger" position TP/SL) are not in the SDK's orderType union but do occur
// live, and that is exactly the case this helper must handle.
function mkOrder(
  partial: Partial<Omit<IPerpsFrontendOrder, 'orderType'>> & {
    orderType?: string;
  },
): IPerpsFrontendOrder {
  return {
    orderType: 'Limit',
    isPositionTpsl: false,
    triggerCondition: '',
    side: 'A',
    ...partial,
  } as unknown as IPerpsFrontendOrder;
}

describe('perpsTpSlUtils', () => {
  describe('classifyTpSlOrder', () => {
    test('Take Profit / Stop, market vs limit', () => {
      expect(
        classifyTpSlOrder(mkOrder({ orderType: 'Take Profit Market' })),
      ).toEqual({ kind: 'tp', isMarket: true });
      expect(
        classifyTpSlOrder(mkOrder({ orderType: 'Take Profit Limit' })),
      ).toEqual({ kind: 'tp', isMarket: false });
      expect(classifyTpSlOrder(mkOrder({ orderType: 'Stop Market' }))).toEqual({
        kind: 'sl',
        isMarket: true,
      });
      expect(classifyTpSlOrder(mkOrder({ orderType: 'Stop Limit' }))).toEqual({
        kind: 'sl',
        isMarket: false,
      });
    });

    // Regression guard: bare "Trigger" position TP/SL are market triggers
    // created by setPositionTpsl (isMarket: true), but orderType has no "Market"
    // suffix. They must classify as market so amend keeps them as market TP/SL.
    test('bare "Trigger" position TP/SL classifies as market with inferred kind', () => {
      expect(
        classifyTpSlOrder(
          mkOrder({
            orderType: 'Trigger',
            isPositionTpsl: true,
            triggerCondition: 'Price above 95000',
            side: 'A',
          }),
        ),
      ).toEqual({ kind: 'tp', isMarket: true });

      expect(
        classifyTpSlOrder(
          mkOrder({
            orderType: 'Trigger',
            isPositionTpsl: true,
            triggerCondition: 'Price below 89000',
            side: 'A',
          }),
        ),
      ).toEqual({ kind: 'sl', isMarket: true });

      expect(
        classifyTpSlOrder(
          mkOrder({
            orderType: 'Trigger',
            isPositionTpsl: true,
            triggerCondition: 'Price below 89000',
            side: 'B',
          }),
        ),
      ).toEqual({ kind: 'tp', isMarket: true });
    });

    test('"Trigger Limit" position TP/SL stays limit', () => {
      expect(
        classifyTpSlOrder(
          mkOrder({
            orderType: 'Trigger Limit',
            isPositionTpsl: true,
            triggerCondition: 'Price above 95000',
            side: 'A',
          }),
        ),
      ).toEqual({ kind: 'tp', isMarket: false });
    });

    test('non-TP/SL and non-position trigger orders return null', () => {
      expect(classifyTpSlOrder(mkOrder({ orderType: 'Limit' }))).toBeNull();
      expect(
        classifyTpSlOrder(
          mkOrder({
            orderType: 'Trigger',
            isPositionTpsl: false,
            triggerCondition: 'Price above 95000',
            side: 'A',
          }),
        ),
      ).toBeNull();
    });
  });

  test('getTpSlKind returns kind only', () => {
    expect(getTpSlKind(mkOrder({ orderType: 'Take Profit Market' }))).toBe(
      'tp',
    );
    expect(getTpSlKind(mkOrder({ orderType: 'Stop Limit' }))).toBe('sl');
    expect(getTpSlKind(mkOrder({ orderType: 'Limit' }))).toBeNull();
  });
});

import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  classifyTpSlOrder,
  getPerpsChaseOrderAmendKind,
  getPerpsOrderAmendKind,
  getTpSlKind,
} from './perpsTpSlUtils';

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

  describe('getPerpsOrderAmendKind', () => {
    test.each(['Gtc', 'Ioc', 'Alo'] as const)(
      'preserves the explicit %s limit TIF',
      (tif) => {
        expect(
          getPerpsOrderAmendKind(
            mkOrder({ orderType: 'Limit', isTrigger: false, tif }),
          ),
        ).toEqual({ kind: 'limit', tif });
      },
    );

    test('preserves trigger semantics including bare position TP/SL', () => {
      expect(
        getPerpsOrderAmendKind(
          mkOrder({
            orderType: 'Trigger',
            isTrigger: true,
            isPositionTpsl: true,
            triggerCondition: 'Price below 89000',
            side: 'A',
          }),
        ),
      ).toEqual({ kind: 'trigger', isMarket: true, tpsl: 'sl' });
    });

    test.each([null, 'FrontendMarket', 'LiquidationMarket'])(
      'fails closed for unsupported TIF %s',
      (tif) => {
        expect(
          getPerpsOrderAmendKind(
            mkOrder({
              orderType: 'Limit',
              isTrigger: false,
              tif,
            } as Parameters<typeof mkOrder>[0]),
          ),
        ).toBeNull();
      },
    );

    test('fails closed for unclassified trigger orders', () => {
      expect(
        getPerpsOrderAmendKind(
          mkOrder({
            orderType: 'Trigger',
            isTrigger: true,
            isPositionTpsl: false,
            triggerCondition: 'Price above 95000',
          }),
        ),
      ).toBeNull();
    });
  });

  describe('getPerpsChaseOrderAmendKind', () => {
    test('builds a Gtc limit amend for an eligible chase order', () => {
      expect(
        getPerpsChaseOrderAmendKind(
          mkOrder({
            orderType: 'Limit',
            isTrigger: false,
            isPositionTpsl: false,
            tif: 'Gtc',
          }),
        ),
      ).toEqual({ kind: 'limit', tif: 'Gtc' });
    });

    test.each(['Alo', 'Ioc', null] as const)(
      'rejects a latest order snapshot with TIF %s',
      (tif) => {
        expect(
          getPerpsChaseOrderAmendKind(
            mkOrder({
              orderType: 'Limit',
              isTrigger: false,
              isPositionTpsl: false,
              tif,
            }),
          ),
        ).toBeNull();
      },
    );
  });
});

import { computeMaxTradeSize } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  getSimpleOrderSummary,
  isSimplePositionSizedOrder,
} from './simpleOrderSummary';
import {
  applySimpleAmountKey,
  getSimpleLimitPricePreset,
  getSimpleOrderPreview,
  getSimpleSliderAmount,
  validateSimpleAmountInput,
} from './simpleTrading';

const orderMetadata = {
  oid: 1,
  cloid: null,
  timestamp: 1_700_000_000_000,
  children: [],
  tif: 'Gtc',
  triggerCondition: 'Price below 10',
} satisfies Partial<IPerpsFrontendOrder>;

const order = {
  inputAmount: '100',
  price: '50000',
  leverage: 5,
  szDecimals: 5,
  maxSize: '1',
  feeRate: '0.00045',
};

describe('simple order summaries', () => {
  it.each([false, true])(
    'uses the correct display price for a trigger=%s order',
    (isTrigger) => {
      const orderData = {
        ...orderMetadata,
        coin: 'xyz:SOXL',
        side: 'A' as const,
        reduceOnly: true,
        orderType: isTrigger ? 'Stop Limit' : 'Limit',
        sz: '0.3',
        origSz: '0.3',
        isPositionTpsl: false,
        limitPx: '12',
        triggerPx: '10',
        isTrigger,
      } as const;
      expect(getSimpleOrderSummary(orderData)).toEqual({
        coin: orderData.coin,
        side: 'A',
        reduceOnly: true,
        orderType: orderData.orderType,
        size: '0.3',
        price: isTrigger ? '10' : '12',
      });
    },
  );
});

it.each([
  [true, '0', '0', true],
  [true, '1', '1', false],
  [true, '1', '0', false],
  [false, '0', '0', false],
  [true, '', '', false],
] as const)(
  'recognizes position-sized TP/SL (%s, %s, %s)',
  (isPositionTpsl, origSz, sz, expected) => {
    const data = { isPositionTpsl, origSz, sz };
    expect(isSimplePositionSizedOrder(data)).toBe(expected);
    expect(
      getSimpleOrderSummary({
        ...orderMetadata,
        ...data,
        coin: 'UNI',
        side: 'A',
        orderType: 'Stop Market',
        reduceOnly: true,
        isTrigger: true,
        triggerPx: '6.5',
        limitPx: '6',
      }).size,
    ).toBe(expected ? '--' : sz);
  },
);

it.each([
  ['A', 'Price above 10', 'Take Profit Market'],
  ['A', 'Price below 10', 'Stop Market'],
  ['B', 'Price above 10', 'Stop Market'],
  ['B', 'Price below 10', 'Take Profit Market'],
] as const)(
  'normalizes a position trigger for %s / %s',
  (side, triggerCondition, expected) => {
    const summary = getSimpleOrderSummary({
      ...orderMetadata,
      side,
      triggerCondition,
      coin: 'UNI',
      sz: '0',
      origSz: '0',
      reduceOnly: true,
      // The exchange also returns bare Trigger values outside the SDK union.
      orderType: 'Trigger' as IPerpsFrontendOrder['orderType'],
      isPositionTpsl: true,
      isTrigger: true,
      triggerPx: '10',
      limitPx: '9',
    });
    expect(summary.orderType).toBe(expected);
    expect(summary.price).toBe('10');
  },
);

describe('simple slider percentage input', () => {
  const selection = {
    percent: 50,
    maxSize: '0.01',
    price: '50000',
    leverage: 10,
    decimals: 2,
    inputUnit: 'margin' as const,
  };
  it('keeps the selected percentage while recomputing amount with buying power', () => {
    expect(getSimpleSliderAmount(selection)).toBe('25');
    expect(getSimpleSliderAmount({ ...selection, maxSize: '0.02' })).toBe('50');
    expect(getSimpleSliderAmount({ ...selection, price: '60000' })).toBe('30');
    expect(selection.percent).toBe(50);
  });
  it('converts the same selection to each input unit', () => {
    expect(getSimpleSliderAmount({ ...selection, inputUnit: 'usd' })).toBe(
      '250',
    );
    expect(
      getSimpleSliderAmount({ ...selection, inputUnit: 'token', decimals: 5 }),
    ).toBe('0.005');
  });
  it('clamps percentages and handles unavailable leverage', () => {
    expect(getSimpleSliderAmount({ ...selection, percent: 120 })).toBe('50');
    expect(getSimpleSliderAmount({ ...selection, percent: -1 })).toBe('0');
    expect(getSimpleSliderAmount({ ...selection, leverage: 0 })).toBe('0');
  });
});

describe('simple limit price presets', () => {
  it.each([
    [0, '50000'],
    [1, '49500'],
    [2, '49000'],
    [3, '48500'],
  ] as const)(
    'applies %s percent below the reference price',
    (discount, expected) => {
      expect(getSimpleLimitPricePreset('50000', 5, discount, 'long')).toBe(
        expected,
      );
    },
  );
  it.each([
    [0, '50000'],
    [1, '50500'],
    [2, '51000'],
    [3, '51500'],
  ] as const)(
    'applies %s percent above the reference price for shorts',
    (percent, expected) => {
      expect(getSimpleLimitPricePreset('50000', 5, percent, 'short')).toBe(
        expected,
      );
    },
  );
  it('respects market price precision and rejects missing prices', () => {
    expect(getSimpleLimitPricePreset('77637', 5, 1, 'long')).toBe('76860');
    expect(getSimpleLimitPricePreset('77637', 5, 1, 'short')).toBe('78413');
    expect(getSimpleLimitPricePreset('', 5, 1, 'long')).toBe('');
    expect(getSimpleLimitPricePreset('', 5, 1, 'short')).toBe('');
  });
});

describe('simple order preview', () => {
  it('uses USD order size without multiplying it by leverage', () => {
    const preview = getSimpleOrderPreview({
      ...order,
      inputUnit: 'usd',
      inputAmount: '500',
    });
    expect(preview.size.toFixed()).toBe('0.01');
    expect(preview.error).toBeUndefined();
  });
  it('preserves an exact token lot with non-terminating margin conversion', () => {
    const preview = getSimpleOrderPreview({
      ...order,
      inputUnit: 'token',
      inputAmount: '0.00032',
      price: '75920',
      leverage: 27,
    });
    expect(preview.size.toFixed()).toBe('0.00032');
    expect(preview.error).toBeUndefined();
  });

  it('converts margin into notional and fees without changing the entered margin', () => {
    const preview = getSimpleOrderPreview(order);
    expect(preview.size.toFixed()).toBe('0.01');
    expect(preview.value.toFixed()).toBe('500');
    expect(preview.fees.toFixed()).toBe('0.225');
    expect(preview.error).toBeUndefined();
  });
  it('rounds the quantity down to the market lot size', () => {
    const preview = getSimpleOrderPreview({ ...order, price: '33333' });
    expect(preview.size.toFixed()).toBe('0.015');
    expect(preview.value.lte(500)).toBe(true);
  });
  it('uses the selected limit price for the order quantity and value', () => {
    const preview = getSimpleOrderPreview({ ...order, price: '25000' });
    expect(preview.size.toFixed()).toBe('0.02');
    expect(preview.value.toFixed()).toBe('500');
    expect(preview.error).toBeUndefined();
  });
  it.each(['', '-1', 'NaN', 'Infinity', '1e3', '0'])(
    'rejects invalid margin %s',
    (inputAmount) => {
      expect(
        getSimpleOrderPreview({ ...order, inputAmount }).error,
      ).toBeDefined();
    },
  );
  it('blocks dust and amounts above the account limit', () => {
    expect(getSimpleOrderPreview({ ...order, inputAmount: '1' }).error).toBe(
      'minimumOrderValue',
    );
    expect(getSimpleOrderPreview({ ...order, maxSize: '0.009' }).error).toBe(
      'insufficientMargin',
    );
  });
  it('reports the minimum order value when a positive margin rounds to zero tokens', () => {
    const preview = getSimpleOrderPreview({
      ...order,
      inputAmount: '0.04',
      price: '77639.5',
      leverage: 3,
    });
    expect(preview.error).toBe('minimumOrderValue');
  });
  it.each(['NaN', 'Infinity', '-0.001'])(
    'blocks unavailable or invalid fees %s',
    (feeRate) => {
      expect(getSimpleOrderPreview({ ...order, feeRate }).error).toBe(
        'feeUnavailable',
      );
    },
  );
  it('does not use a fallback leverage or an unavailable price to authorize an order', () => {
    expect(
      getSimpleOrderPreview({ ...order, leverage: 0 }).error,
    ).toBeDefined();
    expect(getSimpleOrderPreview({ ...order, price: '0' }).error).toBeDefined();
  });
});

describe('simple margin keypad', () => {
  it.each(['usd', 'margin'] as const)(
    'limits %s to 12 integer digits without consuming decimal precision',
    (unit) => {
      expect(validateSimpleAmountInput('999999999999.99', 2, unit)).toBe(true);
      expect(validateSimpleAmountInput('999999999999.', 2, unit)).toBe(true);
      expect(validateSimpleAmountInput('1000000000000', 2, unit)).toBe(false);
      expect(validateSimpleAmountInput('1.001', 2, unit)).toBe(false);
      expect(validateSimpleAmountInput('', 2, unit)).toBe(true);
      expect(validateSimpleAmountInput('1e12', 2, unit)).toBe(false);
    },
  );
  it('rejects a keypad digit beyond the fiat limit but permits backspace', () => {
    const value = '222222222222';
    expect(
      validateSimpleAmountInput(
        applySimpleAmountKey(value, '2'),
        2,
        'usd',
        value,
      ),
    ).toBe(false);
    expect(
      validateSimpleAmountInput(
        applySimpleAmountKey(value, 'backspace'),
        2,
        'usd',
        value,
      ),
    ).toBe(true);
  });
  it('allows deleting a legacy oversized draft without allowing it to grow', () => {
    const value = '2222222222222222.22';
    expect(
      validateSimpleAmountInput(value.slice(0, -1), 2, 'margin', value),
    ).toBe(true);
    expect(validateSimpleAmountInput(`${value}2`, 2, 'margin', value)).toBe(
      false,
    );
    expect(validateSimpleAmountInput('3333333333333', 2, 'margin', value)).toBe(
      false,
    );
  });
  it('matches Pro token precision without adding a fiat integer limit', () => {
    expect(validateSimpleAmountInput('1234567890123.12345', 5, 'token')).toBe(
      true,
    );
    expect(validateSimpleAmountInput('0.123456', 5, 'token')).toBe(false);
  });
  it.each([
    ['', '.', '0.'],
    ['0', '7', '7'],
    ['0.', '0', '0.0'],
    ['1.20', 'backspace', '1.2'],
    ['1.', '.', '1.'],
    ['', 'backspace', ''],
    ['12345678901234567890', '1', '123456789012345678901'],
    ['1', 'e', '1'],
  ])(
    'edits %s with %s without losing decimal precision',
    (value, key, result) => {
      expect(applySimpleAmountKey(value, key)).toBe(result);
    },
  );
});

it.each(['long', 'short'] as const)(
  'sizes a %s limit ticket from available margin at the entered price',
  (side) => {
    for (const price of ['25000', '60000']) {
      const maxSize = computeMaxTradeSize({
        side,
        price,
        markPrice: '50000',
        maxTradeSzs: ['0.01', '0.01'],
        leverageValue: 5,
        szDecimals: 5,
      }).toFixed();
      const margin = getSimpleSliderAmount({
        percent: 100,
        maxSize,
        price,
        leverage: 5,
        inputUnit: 'margin',
        decimals: 2,
      });
      expect(Number(margin)).toBeLessThanOrEqual(100);
      expect(Number(margin)).toBeGreaterThan(99.8);
    }
  },
);

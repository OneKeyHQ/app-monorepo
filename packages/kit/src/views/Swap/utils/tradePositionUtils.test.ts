import { isTradePositionVisible } from './tradePositionUtils';

describe('isTradePositionVisible', () => {
  it.each(['0.000000000000000001', '0.00000001', '0.1', '1'])(
    'keeps a Stock balance of %s regardless of its fiat value',
    (balance) => {
      for (const fiatValue of [undefined, '0', '0.000002233', '0.01', '0.1']) {
        expect(
          isTradePositionVisible({ balance, fiatValue, isStock: true }),
        ).toBe(true);
      }
    },
  );

  it.each([undefined, '', '0', '-1', 'NaN'])(
    'hides a Stock balance of %s even when its fiat value is positive',
    (balance) => {
      expect(
        isTradePositionVisible({ balance, fiatValue: '100', isStock: true }),
      ).toBe(false);
    },
  );

  it.each([
    [undefined, false],
    ['', false],
    ['0', false],
    ['0.1', false],
    ['1', false],
    ['NaN', false],
    ['1.000000000000000001', true],
    ['2', true],
  ] as const)(
    'preserves the strict Swap/Pro value floor for %s',
    (fiatValue, expected) => {
      expect(isTradePositionVisible({ balance: '0', fiatValue })).toBe(
        expected,
      );
    },
  );
});

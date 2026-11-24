import BigNumber from 'bignumber.js';

import { getSwapRawInputAmount } from './swapAmountUtils';
import {
  calcSwapPercentageStageAmount,
  calcSwapProSliderAmount,
  calcSwapProSliderAvailableBalance,
  calcSwapProSliderDisplayAmount,
  calcSwapProSliderPercent,
  getSwapProSliderDragDecimals,
} from './swapProAmountSliderUtils';

describe('swapProAmountSliderUtils', () => {
  describe('calcSwapProSliderAvailableBalance', () => {
    it('returns the full balance for non-native tokens', () => {
      const result = calcSwapProSliderAvailableBalance({
        balanceParsed: '123.456',
        isNative: false,
        reserveGas: '0.01',
      });
      expect(result.toFixed()).toBe('123.456');
    });

    it('deducts the gas reserve for native tokens', () => {
      const result = calcSwapProSliderAvailableBalance({
        balanceParsed: '1',
        isNative: true,
        reserveGas: '0.005',
      });
      expect(result.toFixed()).toBe('0.995');
    });

    it('never goes below zero when the reserve exceeds the balance', () => {
      const result = calcSwapProSliderAvailableBalance({
        balanceParsed: '0.001',
        isNative: true,
        reserveGas: '0.005',
      });
      expect(result.toFixed()).toBe('0');
    });

    it('returns zero for empty, invalid or zero balances', () => {
      expect(
        calcSwapProSliderAvailableBalance({
          balanceParsed: undefined,
        }).toFixed(),
      ).toBe('0');
      expect(
        calcSwapProSliderAvailableBalance({ balanceParsed: 'abc' }).toFixed(),
      ).toBe('0');
      expect(
        calcSwapProSliderAvailableBalance({ balanceParsed: '0' }).toFixed(),
      ).toBe('0');
    });

    it('ignores an invalid or zero reserve for native tokens', () => {
      const result = calcSwapProSliderAvailableBalance({
        balanceParsed: '2',
        isNative: true,
        reserveGas: undefined,
      });
      expect(result.toFixed()).toBe('2');
    });
  });

  describe('calcSwapProSliderPercent', () => {
    const base = new BigNumber('200');

    it('maps the amount to a rounded percentage of the available balance', () => {
      expect(
        calcSwapProSliderPercent({ amount: '50', availableBalance: base }),
      ).toBe(25);
      expect(
        calcSwapProSliderPercent({ amount: '100', availableBalance: base }),
      ).toBe(50);
      expect(
        calcSwapProSliderPercent({ amount: '200', availableBalance: base }),
      ).toBe(100);
    });

    it('clamps to 100 when the amount exceeds the available balance', () => {
      expect(
        calcSwapProSliderPercent({ amount: '500', availableBalance: base }),
      ).toBe(100);
    });

    it('returns 0 for empty, invalid or zero amounts', () => {
      expect(
        calcSwapProSliderPercent({ amount: '', availableBalance: base }),
      ).toBe(0);
      expect(
        calcSwapProSliderPercent({ amount: 'abc', availableBalance: base }),
      ).toBe(0);
      expect(
        calcSwapProSliderPercent({ amount: '0', availableBalance: base }),
      ).toBe(0);
    });

    it('returns 0 when the available balance is zero', () => {
      expect(
        calcSwapProSliderPercent({
          amount: '10',
          availableBalance: new BigNumber(0),
        }),
      ).toBe(0);
    });
  });

  describe('getSwapProSliderDragDecimals', () => {
    it('uses 4 decimals for balances >= 1', () => {
      expect(getSwapProSliderDragDecimals(new BigNumber('62.4826'))).toBe(4);
      expect(getSwapProSliderDragDecimals(new BigNumber('100'))).toBe(4);
    });

    it('extends by the leading zero decimals for sub-1 balances', () => {
      expect(getSwapProSliderDragDecimals(new BigNumber('0.000258'))).toBe(7);
      expect(getSwapProSliderDragDecimals(new BigNumber('0.0050905'))).toBe(6);
      expect(getSwapProSliderDragDecimals(new BigNumber('0.0000505'))).toBe(8);
    });
  });

  describe('calcSwapProSliderAmount', () => {
    it('keeps mid-drag amounts at the balance display precision', () => {
      expect(
        calcSwapProSliderAmount({
          percent: 37,
          availableBalance: new BigNumber('62.4826'),
          decimals: 18,
        }),
      ).toBe('23.1185');
      expect(
        calcSwapProSliderAmount({
          percent: 50,
          availableBalance: new BigNumber('0.0050905'),
          decimals: 18,
        }),
      ).toBe('0.002545');
    });

    it('keeps resolution when dragging small balances so steps stay visible', () => {
      expect(
        calcSwapProSliderAmount({
          percent: 44,
          availableBalance: new BigNumber('0.000258'),
          decimals: 18,
        }),
      ).toBe('0.0001135');
      expect(
        calcSwapProSliderAmount({
          percent: 45,
          availableBalance: new BigNumber('0.000258'),
          decimals: 18,
        }),
      ).toBe('0.0001161');
    });

    it('fills the full available balance at token precision on 100%', () => {
      expect(
        calcSwapProSliderAmount({
          percent: 100,
          availableBalance: new BigNumber('0.0050905'),
          decimals: 18,
        }),
      ).toBe('0.0050905');
      expect(
        calcSwapProSliderAmount({
          percent: 100,
          availableBalance: new BigNumber('15.620650675161812992'),
          decimals: 18,
        }),
      ).toBe('15.620650675161812992');
    });

    it('never exceeds the token decimals when they are below display precision', () => {
      expect(
        calcSwapProSliderAmount({
          percent: 33,
          availableBalance: new BigNumber('1'),
          decimals: 2,
        }),
      ).toBe('0.33');
    });

    it('keeps tiny balances usable across the whole drag range', () => {
      expect(
        calcSwapProSliderAmount({
          percent: 50,
          availableBalance: new BigNumber('0.0000505'),
          decimals: 18,
        }),
      ).toBe('0.00002525');
      expect(
        calcSwapProSliderAmount({
          percent: 1,
          availableBalance: new BigNumber('0.000258'),
          decimals: 18,
        }),
      ).toBe('0.0000025');
    });

    it('returns an empty amount for zero percent and zero for an empty balance', () => {
      expect(
        calcSwapProSliderAmount({
          percent: 0,
          availableBalance: new BigNumber('0.0050905'),
          decimals: 18,
        }),
      ).toBeUndefined();
      expect(
        calcSwapProSliderAmount({
          percent: 50,
          availableBalance: new BigNumber(0),
          decimals: 18,
        }),
      ).toBe('0');
    });
  });

  describe('calcSwapProSliderDisplayAmount', () => {
    it('matches the raw amount for tokens without a balance multiplier', () => {
      expect(
        calcSwapProSliderDisplayAmount({
          percent: 25,
          availableBalance: new BigNumber('0.0602951203'),
          decimals: 18,
          balanceMultiplier: undefined,
        }),
      ).toBe('0.01507');
    });

    it('rounds on the balance the user reads for rebasing tokens', () => {
      // Shown balance 123.4720305..., so a quarter keeps 4 decimals instead of
      // the 19 that rounding the raw amount and multiplying after would give.
      expect(
        calcSwapProSliderDisplayAmount({
          percent: 25,
          availableBalance: new BigNumber('123.456789'),
          decimals: 18,
          balanceMultiplier: '1.000123456789012',
        }),
      ).toBe('30.868');
      expect(
        calcSwapProSliderDisplayAmount({
          percent: 50,
          availableBalance: new BigNumber('10'),
          decimals: 8,
          balanceMultiplier: '1.0234567891',
        }),
      ).toBe('5.1172');
    });

    it('never fills more than the raw balance allows', () => {
      const availableBalance = new BigNumber('123.456789');
      const balanceMultiplier = '1.000123456789012';
      const displayAmount = calcSwapProSliderDisplayAmount({
        percent: 75,
        availableBalance,
        decimals: 18,
        balanceMultiplier,
      });
      const rawAmount = getSwapRawInputAmount(
        displayAmount ?? '',
        { balanceMultiplier, decimals: 18 },
        'down',
      );
      expect(
        new BigNumber(rawAmount ?? 'NaN').lte(
          availableBalance.multipliedBy(0.75),
        ),
      ).toBe(true);
    });

    it('returns nothing for a multiplier that cannot be applied', () => {
      expect(
        calcSwapProSliderDisplayAmount({
          percent: 50,
          availableBalance: new BigNumber('10'),
          decimals: 8,
          balanceMultiplier: 'not-a-number',
        }),
      ).toBeUndefined();
    });
  });

  describe('calcSwapPercentageStageAmount', () => {
    it('fills the rounded share of the balance', () => {
      expect(
        calcSwapPercentageStageAmount({
          percent: 50,
          availableBalance: new BigNumber('0.0001419286'),
          decimals: 18,
          balanceMultiplier: undefined,
        }),
      ).toBe('0.0000709');
    });

    it('fills 0 when the share is below the smallest unit of the token', () => {
      // A tap must always answer: leaving the previous amount in place would
      // read as that amount being the chosen share.
      expect(
        calcSwapPercentageStageAmount({
          percent: 25,
          availableBalance: new BigNumber('3'),
          decimals: 0,
          balanceMultiplier: undefined,
        }),
      ).toBe('0');
      expect(
        calcSwapPercentageStageAmount({
          percent: 25,
          availableBalance: new BigNumber('0.03'),
          decimals: 2,
          balanceMultiplier: undefined,
        }),
      ).toBe('0');
    });

    it('rounds rebasing tokens on the balance the user reads', () => {
      expect(
        calcSwapPercentageStageAmount({
          percent: 25,
          availableBalance: new BigNumber('123.456789'),
          decimals: 18,
          balanceMultiplier: '1.000123456789012',
        }),
      ).toBe('30.868');
    });

    it('returns nothing for a multiplier that cannot be applied', () => {
      expect(
        calcSwapPercentageStageAmount({
          percent: 25,
          availableBalance: new BigNumber('3'),
          decimals: 0,
          balanceMultiplier: 'not-a-number',
        }),
      ).toBeUndefined();
    });
  });

  describe('exact shares near the smallest unit', () => {
    it('does not let the percentage division round a share up or away', () => {
      // 20 decimals, one raw unit: half a unit cannot be spent, so a drag
      // keeps the previous amount and a tap answers 0.
      const oneUnit20 = new BigNumber('0.00000000000000000001');
      expect(
        calcSwapProSliderAmount({
          percent: 50,
          availableBalance: oneUnit20,
          decimals: 20,
        }),
      ).toBeUndefined();
      expect(
        calcSwapPercentageStageAmount({
          percent: 50,
          availableBalance: oneUnit20,
          decimals: 20,
          balanceMultiplier: undefined,
        }),
      ).toBe('0');
      // 24 decimals, four raw units: a quarter is exactly one unit.
      expect(
        calcSwapPercentageStageAmount({
          percent: 25,
          availableBalance: new BigNumber('0.000000000000000000000004'),
          decimals: 24,
          balanceMultiplier: undefined,
        }),
      ).toBe('0.000000000000000000000001');
    });

    it('keeps the spendable unit of a rebasing token when rounding would lose it', () => {
      // Shown balance 0.0000000409..., a quarter is exactly one raw unit, but
      // 0.00000001 on the shown balance converts back to zero raw units.
      const params = {
        percent: 25,
        availableBalance: new BigNumber('0.00000004'),
        decimals: 8,
        balanceMultiplier: '1.0234567891',
      };
      for (const displayAmount of [
        calcSwapPercentageStageAmount(params),
        calcSwapProSliderDisplayAmount(params),
      ]) {
        expect(
          getSwapRawInputAmount(
            displayAmount ?? '',
            { balanceMultiplier: params.balanceMultiplier, decimals: 8 },
            'down',
          ),
        ).toBe('0.00000001');
      }
    });

    it('fills the one whole unit inside a share of one and a half units', () => {
      // Three raw units at 50%: the share holds one spendable unit.
      const params = {
        percent: 50,
        availableBalance: new BigNumber('0.00000003'),
        decimals: 8,
        balanceMultiplier: '1.0234567891',
      };
      for (const displayAmount of [
        calcSwapPercentageStageAmount(params),
        calcSwapProSliderDisplayAmount(params),
      ]) {
        expect(
          getSwapRawInputAmount(
            displayAmount ?? '',
            { balanceMultiplier: params.balanceMultiplier, decimals: 8 },
            'down',
          ),
        ).toBe('0.00000001');
      }
    });

    it('treats a rebasing share below one raw unit as nothing to spend', () => {
      const params = {
        percent: 25,
        availableBalance: new BigNumber('0.00000003'),
        decimals: 8,
        balanceMultiplier: '1.0234567891',
      };
      expect(calcSwapPercentageStageAmount(params)).toBe('0');
      expect(calcSwapProSliderDisplayAmount(params)).toBeUndefined();
    });
  });

  describe('precision balance', () => {
    it('rounds on the grid of the balance the user reads, not the spendable one', () => {
      // 0.10009 shown, 0.005 reserved for gas: the share comes from 0.09509
      // but keeps the 4 decimals of the shown balance.
      expect(
        calcSwapProSliderDisplayAmount({
          percent: 25,
          availableBalance: new BigNumber('0.09509'),
          precisionBalance: new BigNumber('0.10009'),
          decimals: 18,
          balanceMultiplier: undefined,
        }),
      ).toBe('0.0237');
    });

    it('falls back to the spendable balance when no shown balance is given', () => {
      expect(
        calcSwapProSliderDisplayAmount({
          percent: 25,
          availableBalance: new BigNumber('0.09509'),
          decimals: 18,
          balanceMultiplier: undefined,
        }),
      ).toBe('0.02377');
    });
  });
});

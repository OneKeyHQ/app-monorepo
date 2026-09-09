import BigNumber from 'bignumber.js';

import {
  calcSwapProSliderAmount,
  calcSwapProSliderAvailableBalance,
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
});

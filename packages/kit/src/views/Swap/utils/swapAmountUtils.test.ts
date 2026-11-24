import {
  getSwapDisplayAmount,
  getSwapDisplayDecimals,
  getSwapDisplayRate,
  getSwapLimitOrderBaseUnits,
  getSwapRawAmount,
  getSwapRawInputAmount,
  isSwapReviewMultiplierCurrent,
} from './swapAmountUtils';

describe('swap amount units', () => {
  it('invalidates a pending review when a selected multiplier changes', () => {
    expect(
      isSwapReviewMultiplierCurrent(
        { balanceMultiplier: '2' },
        { balanceMultiplier: '2' },
      ),
    ).toBe(true);
    expect(
      isSwapReviewMultiplierCurrent(
        { balanceMultiplier: '2' },
        { balanceMultiplier: '3' },
      ),
    ).toBe(false);
    expect(isSwapReviewMultiplierCurrent({}, { balanceMultiplier: '2' })).toBe(
      false,
    );
    expect(isSwapReviewMultiplierCurrent({}, undefined)).toBe(false);
  });
  it('converts raw amounts on any network using their multiplier', () => {
    expect(getSwapDisplayAmount('0.02752389', '1.0005117992960542')).toBe(
      '0.027537976707526673234838',
    );
    expect(getSwapDisplayAmount('5', '0.5')).toBe('2.5');
    expect(getSwapDisplayAmount('5', undefined)).toBe('5');
  });

  it('converts entered amounts to raw units with explicit rounding', () => {
    expect(getSwapRawAmount('1', '3', 2, 'down')).toBe('0.33');
    expect(getSwapRawAmount('1', '3', 2, 'up')).toBe('0.34');
    expect(getSwapRawAmount('2.5', '0.5', 8, 'down')).toBe('5');
    expect(getSwapRawAmount('2.5', undefined, 8, 'down')).toBe('2.5');
    expect(
      getSwapRawAmount(
        '0.0000000000000000000000000000000000000001',
        '3',
        40,
        'up',
      ),
    ).toBe('0.0000000000000000000000000000000000000001');
  });

  it('does not interpret invalid multiplier metadata as an ordinary token', () => {
    expect(getSwapDisplayAmount('5', '0')).toBeUndefined();
    expect(getSwapRawAmount('5', 'invalid', 8, 'down')).toBeUndefined();
    expect(getSwapRawAmount('5', '2', -1, 'down')).toBeUndefined();
    expect(getSwapRawAmount('-1', '2', 8, 'down')).toBeUndefined();
    expect(
      getSwapRawInputAmount(
        '',
        { decimals: 8, balanceMultiplier: '0' },
        'down',
      ),
    ).toBeUndefined();
  });

  it('retains display precision for multipliers below one', () => {
    expect(getSwapDisplayDecimals(2, '0.001')).toBe(5);
    expect(getSwapDisplayAmount('0.01', '0.001')).toBe('0.00001');
    expect(getSwapRawAmount('0.00001', '0.001', 2, 'down')).toBe('0.01');
  });

  it('converts rates using the multiplier of each side', () => {
    expect(getSwapDisplayRate('4', '2', '3')).toBe('6');
    expect(getSwapDisplayRate('4', undefined, undefined)).toBe('4');
    expect(getSwapDisplayRate('4', '0', '3')).toBeUndefined();
  });

  it('constructs limit order amounts in integer raw base units', () => {
    const token = { decimals: 2, balanceMultiplier: '3' };
    expect(
      getSwapLimitOrderBaseUnits({ displayAmount: '1', token, rounding: 'up' }),
    ).toBe('34');
    expect(
      getSwapLimitOrderBaseUnits({
        displayAmount: '1',
        token,
        rounding: 'down',
      }),
    ).toBe('33');
    expect(
      getSwapLimitOrderBaseUnits({
        rawFallback: '0.27',
        token,
        rounding: 'up',
      }),
    ).toBe('27');
    expect(
      getSwapLimitOrderBaseUnits({
        displayAmount: '0.001',
        token,
        rounding: 'down',
      }),
    ).toBeUndefined();
  });
});

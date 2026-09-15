import { act, renderHook } from '@testing-library/react-native';
import BigNumber from 'bignumber.js';

import { getPerpsDepositMinimumCheck } from './depositTokenDisplayUtils';
import { usePerpsAmountInput } from './usePerpsAmountInput';

const initialProps: Parameters<typeof usePerpsAmountInput>[0] = {
  unit: 'usd',
  tokenPrice: '0.999894',
  tokenDecimals: 6,
};

describe('usePerpsAmountInput', () => {
  it('preserves both the entered USD amount and transfer quantity over repeated switches', () => {
    const { result, rerender } = renderHook(usePerpsAmountInput, {
      initialProps,
    });
    act(() => result.current.setAmount('3.04'));
    const quantity = result.current.tokenAmountBN.toFixed();

    for (let i = 0; i < 20; i += 1) {
      rerender({ ...initialProps, unit: 'token' });
      expect(result.current.amount).toBe('3.040322');
      expect(result.current.tokenAmountBN.toFixed()).toBe(quantity);
      rerender(initialProps);
      expect(result.current.amount).toBe('3.04');
      expect(result.current.tokenAmountBN.toFixed()).toBe(quantity);
    }
  });

  it('retains full token precision when USD is only a rounded display', () => {
    const { result, rerender } = renderHook(usePerpsAmountInput, {
      initialProps: { ...initialProps, unit: 'token' },
    });
    act(() => result.current.setAmount('3.040322'));
    rerender(initialProps);
    expect(result.current.amount).toBe('3.04');
    expect(result.current.tokenAmountBN.toFixed()).toBe('3.040322');
    rerender({ ...initialProps, unit: 'token' });
    expect(result.current.amount).toBe('3.040322');
  });

  it('uses edits in the newly selected unit as the new source', () => {
    const { result, rerender } = renderHook(usePerpsAmountInput, {
      initialProps,
    });
    act(() => result.current.setAmount('3.04'));
    rerender({ ...initialProps, unit: 'token' });
    act(() => result.current.setAmount('10'));
    rerender(initialProps);
    expect(result.current.amount).toBe('10.00');
    expect(result.current.tokenAmountBN.toFixed()).toBe('10');
    act(() => result.current.setAmount('4.50'));
    rerender({ ...initialProps, unit: 'token' });
    rerender(initialProps);
    expect(result.current.amount).toBe('4.50');
    act(() => result.current.setAmount(''));
    rerender({ ...initialProps, unit: 'token' });
    expect(result.current.amount).toBe('');
    expect(result.current.tokenAmountBN.isZero()).toBe(true);
  });

  it('revalues the original input on a price refresh, without compounding rounding', () => {
    const { result, rerender } = renderHook(usePerpsAmountInput, {
      initialProps,
    });
    act(() => result.current.setAmount('3.04'));
    rerender({ ...initialProps, unit: 'token', tokenPrice: '0.99' });
    expect(result.current.amount).toBe('3.070707');
    rerender({ ...initialProps, tokenPrice: '0.99' });
    expect(result.current.amount).toBe('3.04');
  });

  it('keeps minimum validation based on the input instead of the truncated token display', () => {
    const { result, rerender } = renderHook(usePerpsAmountInput, {
      initialProps,
    });
    act(() => result.current.setAmount('5'));
    rerender({ ...initialProps, unit: 'token' });
    expect(
      new BigNumber(result.current.amount)
        .multipliedBy(initialProps.tokenPrice ?? '0')
        .lt(5),
    ).toBe(true);
    expect(
      getPerpsDepositMinimumCheck({
        inputAmount: result.current.source.amount,
        isUsdInput: result.current.source.unit === 'usd',
        tokenPrice: initialProps.tokenPrice,
        tokenDecimals: initialProps.tokenDecimals,
      }).value,
    ).toBe(true);
  });

  it('does not increase a full token balance when the USD display rounds up', () => {
    const props = { ...initialProps, tokenPrice: '3210.57', tokenDecimals: 18 };
    const { result, rerender } = renderHook(usePerpsAmountInput, {
      initialProps: { ...props, unit: 'token' },
    });
    const balance = '0.123456789012345678';
    act(() => result.current.setAmount(balance));
    rerender(props);
    expect(result.current.tokenAmountBN.toFixed()).toBe(balance);
    rerender({ ...props, unit: 'token' });
    expect(result.current.amount).toBe(balance);
  });

  it('preserves partial input and clears the old source when the form resets', () => {
    const { result, rerender } = renderHook(usePerpsAmountInput, {
      initialProps,
    });
    act(() => result.current.setAmount('0.'));
    expect(result.current.amount).toBe('0.');
    act(() => result.current.setAmount('12.30'));
    rerender({ ...initialProps, unit: 'token' });
    act(() => result.current.setAmount(''));
    rerender({ ...initialProps, tokenPrice: '2000', tokenDecimals: 18 });
    expect(result.current.amount).toBe('');
    expect(result.current.tokenAmountBN.isZero()).toBe(true);
    act(() => result.current.setAmount('10'));
    rerender({
      ...initialProps,
      unit: 'token',
      tokenPrice: '2000',
      tokenDecimals: 18,
    });
    expect(result.current.amount).toBe('0.005');
  });
});

/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useForm } from './useFormBase';

describe('useForm submit', () => {
  it('ignores a second submit while the first is still running', async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useForm<{ name: string }>({
        defaultValues: { name: 'Wallet 1' },
        onSubmit,
      }),
    );

    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    await act(async () => {
      first = result.current.submit?.();
      second = result.current.submit?.();
    });
    resolveSubmit?.();
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.submit?.();
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

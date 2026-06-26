/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { useDebouncedValidation } from './useDebouncedValidation';

describe('useDebouncedValidation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('cancels pending validation when validateFn changes', async () => {
    const validateFn = jest.fn<Promise<string | boolean>, [string]>(
      async () => 'invalid',
    );
    const nextValidateFn = jest.fn<Promise<string | boolean>, [string]>(
      async () => true,
    );
    const { result, rerender } = renderHook(
      ({ fn }) => useDebouncedValidation(fn, 300),
      {
        initialProps: {
          fn: validateFn,
        },
      },
    );

    let resolvedValue: string | boolean | undefined;
    let validationPromise: Promise<string | boolean> | undefined;

    act(() => {
      validationPromise = result.current.validate('0xabc').then((value) => {
        resolvedValue = value;
        return value;
      });
    });

    rerender({ fn: nextValidateFn });

    await act(async () => {
      await Promise.resolve();
    });

    await expect(validationPromise).resolves.toBe(false);
    expect(resolvedValue).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(validateFn).not.toHaveBeenCalled();
    expect(nextValidateFn).not.toHaveBeenCalled();
  });
});

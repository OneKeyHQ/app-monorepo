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

  it('re-runs pending validation with the latest validateFn when it changes mid-debounce', async () => {
    // Regression for bulk send ManyToMany: validateFn identity changes while a
    // debounce timer is pending (e.g. `network` / `vaultSettings` settle right
    // after the user pastes addresses). The pending validation must resolve
    // with the LATEST validator's real result — NOT a spurious `false`, which
    // would leave the field invalid with an empty error message (Next button
    // stuck disabled + no visible error for bad addresses).
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

    // validateFn identity churns before the debounce fires.
    rerender({ fn: nextValidateFn });

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await expect(validationPromise).resolves.toBe(true);
    expect(resolvedValue).toBe(true);
    // The stale validator must not run; the latest one validates the value.
    expect(validateFn).not.toHaveBeenCalled();
    expect(nextValidateFn).toHaveBeenCalledWith('0xabc');
  });

  it('re-runs in-flight validation when validateFn changes after the debounce fires', async () => {
    let resolveStaleValidation: ((value: string | boolean) => void) | undefined;
    let resolveLatestValidation:
      | ((value: string | boolean) => void)
      | undefined;
    const validateFn = jest.fn<Promise<string | boolean>, [string]>(
      () =>
        new Promise((resolve) => {
          resolveStaleValidation = resolve;
        }),
    );
    const nextValidateFn = jest.fn<Promise<string | boolean>, [string]>(
      () =>
        new Promise((resolve) => {
          resolveLatestValidation = resolve;
        }),
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

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(validateFn).toHaveBeenCalledWith('0xabc');

    rerender({ fn: nextValidateFn });

    await act(async () => {
      await Promise.resolve();
    });
    expect(nextValidateFn).toHaveBeenCalledWith('0xabc');

    await act(async () => {
      resolveStaleValidation?.('stale invalid');
      await Promise.resolve();
    });
    expect(resolvedValue).toBeUndefined();

    await act(async () => {
      resolveLatestValidation?.(true);
      await Promise.resolve();
    });

    await expect(validationPromise).resolves.toBe(true);
    expect(resolvedValue).toBe(true);
  });

  it('resolves with the validator result once the debounce fires', async () => {
    const validateFn = jest.fn<Promise<string | boolean>, [string]>(
      async (value) => (value === '0xgood' ? true : 'bad address'),
    );
    const { result } = renderHook(() =>
      useDebouncedValidation(validateFn, 300),
    );

    let validPromise: Promise<string | boolean> | undefined;
    act(() => {
      validPromise = result.current.validate('0xgood');
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    await expect(validPromise).resolves.toBe(true);

    let invalidPromise: Promise<string | boolean> | undefined;
    act(() => {
      invalidPromise = result.current.validate('0xbad');
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    // A genuine invalid result must still surface the error message string.
    await expect(invalidPromise).resolves.toBe('bad address');
  });

  it('only resolves the latest value when validate is called repeatedly', async () => {
    const validateFn = jest.fn<Promise<string | boolean>, [string]>(
      async (value) => value,
    );
    const { result } = renderHook(() =>
      useDebouncedValidation(validateFn, 300),
    );

    let firstResolved: string | boolean | undefined;
    let secondResolved: string | boolean | undefined;

    act(() => {
      void result.current.validate('first').then((v) => {
        firstResolved = v;
      });
    });
    // Second call before the first debounce fires supersedes it.
    act(() => {
      void result.current.validate('second').then((v) => {
        secondResolved = v;
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    // First promise is settled (never hangs) and the latest value is validated.
    expect(firstResolved).toBeDefined();
    expect(secondResolved).toBe('second');
    expect(validateFn).toHaveBeenCalledTimes(1);
    expect(validateFn).toHaveBeenCalledWith('second');
  });
});

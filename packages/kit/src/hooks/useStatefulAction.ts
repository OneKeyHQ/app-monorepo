import { useCallback, useEffect, useRef, useState } from 'react';

type IStatefulActionOptions<T> = {
  // the initial value
  value: T;
  // the action handler
  onAction: (next: T) => Promise<void>;
  // the error handler
  onError?: (error: unknown, prev: T) => void;
  // whether to disable the toggle
  disableToggle?: boolean;
  // the lock duration
  lockDurationMs?: number;
};

export function useStatefulAction<T>({
  value,
  onAction,
  onError,
  disableToggle,
  lockDurationMs = 300,
}: IStatefulActionOptions<T>) {
  const [innerValue, setInnerValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const prevValueRef = useRef(value);
  const clickLockRef = useRef(false);

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  // wrap the click to avoid duplicate triggers
  const withClickLock = useCallback(
    <Args extends any[]>(fn: (...args: Args) => any) =>
      (...args: Args) => {
        if (clickLockRef.current || isLoading) return;
        clickLockRef.current = true;
        setTimeout(() => {
          clickLockRef.current = false;
        }, lockDurationMs);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return fn(...args);
      },
    [isLoading, lockDurationMs],
  );

  // the action handler
  const run = useCallback(
    async (next: T) => {
      if (isLoading) return;
      prevValueRef.current = innerValue;
      setInnerValue(next);
      setIsLoading(true);
      try {
        await onAction(next);
      } catch (e) {
        console.error('=========>>>>>>>> useStatefulAction error', e);
        setInnerValue(prevValueRef.current);
        onError?.(e, prevValueRef.current);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, innerValue, onAction, onError],
  );

  const toggle = useCallback(() => {
    if (disableToggle) return;
    if (typeof innerValue === 'boolean') {
      void run(!innerValue as unknown as T);
    }
  }, [disableToggle, innerValue, run]);

  return {
    value: innerValue,
    loading: isLoading,
    disabled: isLoading,
    onChange: run,
    onToggle: toggle,
    // wrap the click to avoid duplicate triggers
    withClickLock,
  };
}

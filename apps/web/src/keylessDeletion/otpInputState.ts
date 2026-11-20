import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export function otpCooldownDeadline(seconds: number) {
  return (
    globalThis.performance.now() +
    Math.min(seconds * 1000, Number.MAX_SAFE_INTEGER)
  );
}

export function useCountdown(deadline: number) {
  const [now, setNow] = useState(() => globalThis.performance.now());
  useEffect(() => {
    const start = globalThis.performance.now();
    setNow(start);
    if (deadline <= start) {
      return;
    }
    const timer = globalThis.setInterval(() => {
      const current = globalThis.performance.now();
      setNow(current);
      if (current >= deadline) {
        globalThis.clearInterval(timer);
      }
    }, 250);
    return () => globalThis.clearInterval(timer);
  }, [deadline]);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

type IOtpButtonOptions = { visible?: boolean; ready?: boolean; busy?: boolean };

export function getOtpButtonState({
  visible = true,
  ready = true,
  busy = false,
}: IOtpButtonOptions) {
  return { visible, disabled: !visible || !ready || busy };
}

export function useOtpResend({
  deadline,
  ready = true,
  ...options
}: IOtpButtonOptions & { deadline: number }) {
  const seconds = useCountdown(deadline);
  return {
    ...getOtpButtonState({ ...options, ready: ready && seconds === 0 }),
    seconds,
  };
}

export function useOtpInputFocus(
  input: RefObject<{ focus(): void } | null>,
  {
    enabled,
    focusKey,
    delayMs = 0,
  }: {
    enabled: boolean;
    focusKey?: string;
    delayMs?: number;
  },
) {
  const lastFocusedKey = useRef<string | undefined>(undefined);
  const focus = useCallback(() => input.current?.focus(), [input]);
  useEffect(() => {
    if (
      !enabled ||
      (focusKey !== undefined && lastFocusedKey.current === focusKey)
    ) {
      return;
    }
    const focusOnce = () => {
      if (input.current) {
        focus();
        lastFocusedKey.current = focusKey;
      }
    };
    if (delayMs === 0) {
      focusOnce();
      return;
    }
    const timer = globalThis.setTimeout(focusOnce, delayMs);
    return () => globalThis.clearTimeout(timer);
  }, [delayMs, enabled, focus, focusKey, input]);
  return focus;
}

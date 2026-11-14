import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import type {
  IFetchQuoteResult,
  ISwapReviewQuoteValidity,
} from '@onekeyhq/shared/types/swap/types';

const MAX_TIMER_DELAY = 2_147_483_647;

export function useSwapReviewQuoteExpiry({
  enabled,
  quoteResult,
  expiredTime,
  expiryKey,
  ready,
}: {
  enabled: boolean;
  quoteResult?: IFetchQuoteResult;
  expiredTime?: number;
  expiryKey?: string;
  ready: boolean;
}) {
  const expiryRef = useRef<
    | {
        key: string | IFetchQuoteResult;
        deadline?: number;
      }
    | undefined
  >(undefined);
  const [expired, setExpired] = useState(false);
  const [revision, setRevision] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!enabled || !quoteResult || !ready) {
      return;
    }
    const key = expiryKey ?? quoteResult;
    if (expiryRef.current?.key === key) {
      return;
    }

    const duration = expiredTime;
    let deadline: number | undefined;
    if (duration !== undefined) {
      deadline =
        Number.isFinite(duration) && duration > 0
          ? Date.now() + duration * 1000
          : Date.now();
      if (!Number.isFinite(deadline)) deadline = Date.now();
    }
    expiryRef.current = { key, deadline };
    setExpired(deadline !== undefined && deadline <= Date.now());
    setRevision((value) => value + 1);
  }, [enabled, expiredTime, expiryKey, quoteResult, ready]);

  const checkExpired = useCallback(() => {
    const deadline = expiryRef.current?.deadline;
    const isExpired = deadline !== undefined && Date.now() >= deadline;
    if (isExpired) {
      setExpired(true);
    }
    return isExpired;
  }, []);

  const captureQuoteValidity = useCallback(() => {
    const expiry = expiryRef.current;
    const isValid: ISwapReviewQuoteValidity = () => {
      const deadline = expiry?.deadline;
      const isExpired = deadline !== undefined && Date.now() >= deadline;
      if (isExpired && mountedRef.current && expiryRef.current === expiry) {
        setExpired(true);
      }
      return !isExpired;
    };
    isValid.deadline = expiry?.deadline;
    return isValid;
  }, []);

  useEffect(() => {
    const deadline = expiryRef.current?.deadline;
    if (!enabled || deadline === undefined) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setExpired(true);
        return;
      }
      timer = setTimeout(schedule, Math.min(remaining, MAX_TIMER_DELAY));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled, revision]);

  const onAppActive = useCallback(() => {
    checkExpired();
  }, [checkExpired]);
  useHandleAppStateActive(enabled ? onAppActive : undefined);

  return { expired: enabled && expired, checkExpired, captureQuoteValidity };
}

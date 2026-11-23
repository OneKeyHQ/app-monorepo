import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

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
        confirmed?: boolean;
      }
    | undefined
  >(undefined);
  const [expired, setExpired] = useState(false);
  const [revision, setRevision] = useState(0);

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
    const expiry = expiryRef.current;
    const deadline = expiry?.deadline;
    const isExpired =
      !expiry?.confirmed && deadline !== undefined && Date.now() >= deadline;
    if (isExpired) {
      setExpired(true);
    }
    return isExpired;
  }, []);

  const confirmQuote = useCallback(() => {
    if (checkExpired()) return undefined;
    const expiry = expiryRef.current;
    if (!expiry || expiry.confirmed) return () => {};
    expiry.confirmed = true;
    setRevision((value) => value + 1);
    return () => {
      if (expiryRef.current !== expiry || !expiry.confirmed) return;
      expiry.confirmed = false;
      checkExpired();
      setRevision((value) => value + 1);
    };
  }, [checkExpired]);

  // Keep the execution guard present without carrying a post-confirm deadline.
  const captureQuoteValidity = useCallback(() => () => true, []);

  useEffect(() => {
    const expiry = expiryRef.current;
    const deadline = expiry?.deadline;
    if (!enabled || !expiry || expiry.confirmed || deadline === undefined) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      if (expiryRef.current !== expiry || expiry.confirmed) return;
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

  return {
    expired: enabled && expired,
    checkExpired,
    confirmQuote,
    captureQuoteValidity,
  };
}

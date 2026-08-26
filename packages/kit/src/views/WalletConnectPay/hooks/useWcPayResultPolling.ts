import { useEffect, useState } from 'react';

import type { IWcPayConfirmResult } from '@onekeyhq/shared/src/walletConnect/payTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const DEFAULT_POLL_MS = 3000;
export const MAX_POLL_COUNT = 60;

/**
 * Polls `serviceWalletConnectPay.confirmPayment` with a fixed `(paymentId,
 * optionId, signatures)` triple until the result is final or polling gives
 * up, re-arming the timer after each response using `pollInMs` (falling
 * back to `DEFAULT_POLL_MS`).
 *
 * `enabled` lets a caller mount this hook before `signatures` exists (e.g.
 * while the user is still signing) with `enabled: false` — nothing is
 * scheduled and no request is made until it flips to `true`, at which point
 * polling starts from `initialResult`.
 *
 * Callers do not need to memoize `signatures`: identity (whether to keep the
 * current poll loop running vs. start over) is derived from the *content* of
 * `paymentId` + `optionId` + `signatures`, not object/array reference. When
 * that content changes, `result` and `pollExhausted` reset and polling
 * restarts fresh from the new `initialResult` — this is what lets the same
 * hook instance be reused across a retried payment attempt.
 *
 * `pollExhausted` becomes true after `MAX_POLL_COUNT` polls without a final
 * result; `result.status` is never overwritten to a synthetic Failed in that
 * case, since the payment may still settle later out-of-band.
 */
export function useWcPayResultPolling({
  paymentId,
  optionId,
  signatures,
  initialResult,
  enabled,
}: {
  paymentId: string;
  optionId: string;
  signatures: string[];
  initialResult: IWcPayConfirmResult;
  enabled: boolean;
}): { result: IWcPayConfirmResult; pollExhausted: boolean } {
  // Content key, not the array reference: a caller that re-creates the
  // `signatures` array on every render (Task 6 does not promise to memoize
  // it) must not re-arm the polling effect on every render — that would
  // either restart the MAX_POLL_COUNT budget forever, or, if the parent
  // re-renders faster than the poll interval, clear the timer before it
  // ever fires again.
  const signaturesKey = signatures.join(',');
  const identityKey = `${paymentId}:${optionId}:${signaturesKey}`;

  const [result, setResult] = useState<IWcPayConfirmResult>(initialResult);
  // polling gave up without a final status; the payment may still settle
  // later, so don't fake a Failed status — just let the user leave
  const [pollExhausted, setPollExhausted] = useState(false);
  const [trackedIdentityKey, setTrackedIdentityKey] = useState(identityKey);

  // Reset state from props without remounting: when the request identity
  // changes (e.g. the caller retries with a new signature set), start over
  // from the new `initialResult` instead of showing the previous attempt's
  // stale result/pollExhausted. This is the React-documented render-time
  // reset pattern — the guarded setState here re-runs the component body
  // with the new state before anything is committed or painted.
  if (identityKey !== trackedIdentityKey) {
    setTrackedIdentityKey(identityKey);
    setResult(initialResult);
    setPollExhausted(false);
  }

  useEffect(() => {
    if (!enabled || result.isFinal) {
      return;
    }
    let cancelled = false;
    let pollCount = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled) {
        return;
      }
      if (pollCount >= MAX_POLL_COUNT) {
        setPollExhausted(true);
        return;
      }
      pollCount += 1;
      try {
        const next =
          await backgroundApiProxy.serviceWalletConnectPay.confirmPayment({
            paymentId,
            optionId,
            signatures,
          });
        if (cancelled) {
          return;
        }
        setResult(next);
        if (!next.isFinal) {
          timer = setTimeout(poll, next.pollInMs ?? DEFAULT_POLL_MS);
        }
      } catch {
        if (!cancelled) {
          timer = setTimeout(poll, DEFAULT_POLL_MS);
        }
      }
    };

    timer = setTimeout(poll, result.pollInMs ?? DEFAULT_POLL_MS);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
    // `result` is intentionally excluded: the effect must not restart mid-flight
    // when a poll updates it, only when the request identity or `enabled` changes.
    // `signaturesKey` (not `signatures`) drives identity so a caller that
    // does not memoize but passes a content-equal array does not re-arm
    // this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, optionId, signaturesKey, enabled]);

  return { result, pollExhausted };
}

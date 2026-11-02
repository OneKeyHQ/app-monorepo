import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getBinanceDepositEventContext } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/binanceDeposit';
import type {
  IBinanceDepositAsset,
  IBinanceDepositSnapshot,
} from '@onekeyhq/shared/types/binanceDeposit';

import {
  getBinanceDepositErrorCode,
  getBinanceDepositErrorTitle,
} from './binanceDepositErrors';

// Local reads only; the service asks the server at its own pace.
const SNAPSHOT_POLL_INTERVAL_MS = 1500;
// A return link arrives right after the app comes back; a session still
// waiting by then was left by the user.
const MANUAL_RETURN_CHECK_DELAY_MS = 2000;
// The switch to Binance only starts once the open resolves and takes most
// of a second; past this the app is taken to have stayed.
const OPENING_HOLD_MAX_MS = 2000;

function waitUntilAppLeaves(maxMs: number): Promise<void> {
  if (AppState.currentState === 'background') {
    return Promise.resolve();
  }
  let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<void>((resolve) => {
    subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        resolve();
      }
    });
    timer = setTimeout(resolve, maxMs);
  }).finally(() => {
    subscription?.remove();
    clearTimeout(timer);
  });
}

function isSameSnapshot(
  a: IBinanceDepositSnapshot | null | undefined,
  b: IBinanceDepositSnapshot | undefined,
): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.localId === b.localId &&
      a.phase === b.phase &&
      a.status === b.status &&
      a.failReason === b.failReason &&
      a.destination?.address === b.destination?.address &&
      a.destination?.addressTag === b.destination?.addressTag &&
      a.destination?.minAmount === b.destination?.minAmount)
  );
}

// The deposit session behind the recipient card: starting it, opening
// Binance, noticing the return and following the session to its address.
export function useBinanceDepositSession({
  asset,
  onAssetStale,
  onAssetDisabled,
}: {
  asset: IBinanceDepositAsset | null | undefined;
  onAssetStale: () => void;
  onAssetDisabled: () => void;
}) {
  const intl = useIntl();
  // null from the tap until the first server answer, so the card shows at
  // once instead of waiting on the create request; undefined when the user
  // isn't sending to Binance.
  const [snapshot, setSnapshot] = useState<IBinanceDepositSnapshot | null>();
  const [isBusy, setIsBusy] = useState(false);
  // The attempt holding the busy lock. A new attempt frees it, so a request
  // left behind by a cancel can't keep the next card's buttons locked.
  const busyAttemptRef = useRef<number | undefined>(undefined);
  // Bumped by every start, every exit and on unmount: an answer that arrives
  // for an older attempt must not open Binance.
  const attemptRef = useRef(0);
  useEffect(
    () => () => {
      attemptRef.current += 1;
    },
    [],
  );

  const runExclusive = useCallback(async (task: () => Promise<void>) => {
    if (busyAttemptRef.current !== undefined) {
      return;
    }
    const attempt = attemptRef.current;
    busyAttemptRef.current = attempt;
    setIsBusy(true);
    try {
      await task();
    } finally {
      if (busyAttemptRef.current === attempt) {
        busyAttemptRef.current = undefined;
        setIsBusy(false);
      }
    }
  }, []);

  // The card's button can be tapped while the open after a start is still
  // on its way; the link is opened once per attempt.
  const openingAttemptRef = useRef<number | undefined>(undefined);
  const [isOpening, setIsOpening] = useState(false);

  const releaseLocks = useCallback(() => {
    busyAttemptRef.current = undefined;
    setIsBusy(false);
    openingAttemptRef.current = undefined;
    setIsOpening(false);
  }, []);
  // The session Binance was last opened for, until the app comes back.
  const openedLocalIdRef = useRef<string | undefined>(undefined);
  const openBinance = useCallback(
    async (
      session: IBinanceDepositSnapshot,
      attempt: number,
      isReopen: boolean,
    ) => {
      const { localId } = session;
      if (openingAttemptRef.current === attempt) {
        return;
      }
      openingAttemptRef.current = attempt;
      setIsOpening(true);
      try {
        // The link only lives in this local variable: it is not stored,
        // logged or put into navigation.
        const { link } =
          await backgroundApiProxy.serviceBinanceDeposit.prepareOpenLink(
            localId,
          );
        if (attempt !== attemptRef.current) {
          return;
        }
        // Set first: the app may be away before the open resolves.
        openedLocalIdRef.current = localId;
        // The system has to open it: the in-app browser would not hand a
        // universal link over to the Binance app.
        await openUrlUtils.linkingOpenURL(link);
        defaultLogger.transaction.send.binanceDepositOpen({
          ...getBinanceDepositEventContext(session),
          isReopen,
        });
        // Still opening while the system switches over: the line asking
        // whether Binance showed up is only for someone who came back.
        await waitUntilAppLeaves(OPENING_HOLD_MAX_MS);
      } catch (error) {
        openedLocalIdRef.current = undefined;
        if (attempt !== attemptRef.current) {
          return;
        }
        // An expired link fails the session, and the card then says so and
        // offers to try again: no toast on top.
        const next =
          await backgroundApiProxy.serviceBinanceDeposit.getSnapshot(localId);
        if (attempt !== attemptRef.current) {
          return;
        }
        if (next?.phase === 'failed') {
          setSnapshot((current) =>
            current?.localId === localId ? next : current,
          );
          return;
        }
        Toast.error({ title: getBinanceDepositErrorTitle(intl, error) });
      } finally {
        if (openingAttemptRef.current === attempt) {
          openingAttemptRef.current = undefined;
          setIsOpening(false);
        }
      }
    },
    [intl],
  );

  const onAppActive = useCallback(() => {
    const openedLocalId = openedLocalIdRef.current;
    openedLocalIdRef.current = undefined;
    if (!openedLocalId) {
      return;
    }
    setTimeout(() => {
      void backgroundApiProxy.serviceBinanceDeposit
        .getSnapshot(openedLocalId)
        .then(
          (next) => {
            if (next?.phase === 'awaiting') {
              defaultLogger.transaction.send.binanceDepositReturn({
                ...getBinanceDepositEventContext(next),
                returnType: 'manual',
              });
            }
          },
          () => undefined,
        );
    }, MANUAL_RETURN_CHECK_DELAY_MS);
  }, []);
  useHandleAppStateActive(onAppActive);

  const applyCreateResult = useCallback(
    async (attempt: number, next: IBinanceDepositSnapshot) => {
      if (attempt !== attemptRef.current) {
        return;
      }
      setSnapshot(next);
      // Only a session still waiting for the authorization has a link to
      // open; a resumed one the user already confirmed has none.
      if (
        next.phase === 'awaiting' &&
        next.status === EBinanceDepositSessionStatus.INIT
      ) {
        await openBinance(next, attempt, false);
      }
    },
    [openBinance],
  );

  const handleCreateError = useCallback(
    async ({
      attempt,
      error,
      asset: failedAsset,
      localId,
    }: {
      attempt: number;
      error: unknown;
      asset: Pick<IBinanceDepositAsset, 'networkId' | 'cryptoCurrency'>;
      localId?: string;
    }) => {
      if (attempt !== attemptRef.current) {
        return;
      }
      Toast.error({ title: getBinanceDepositErrorTitle(intl, error) });
      const code = getBinanceDepositErrorCode(error);
      defaultLogger.transaction.send.binanceDepositFail({
        ...getBinanceDepositEventContext(failedAsset),
        reason: 'request_rejected',
        errorCode: code,
      });
      if (code === EBinanceDepositErrorCode.CapabilityStale) {
        onAssetStale();
      } else if (
        code === EBinanceDepositErrorCode.FeatureDisabled ||
        code === EBinanceDepositErrorCode.DepositDisabled
      ) {
        onAssetDisabled();
      }
      const next = localId
        ? await backgroundApiProxy.serviceBinanceDeposit.getSnapshot(localId)
        : undefined;
      if (attempt !== attemptRef.current) {
        return;
      }
      setSnapshot(next);
    },
    [intl, onAssetDisabled, onAssetStale],
  );

  // A start that picks up an address already released only waits for the
  // server to confirm it: the card says it is getting the address rather
  // than opening Binance.
  const [isResuming, setIsResuming] = useState(false);

  // Not behind the busy lock: after a cancel the card must come back at
  // once. The service runs starts one after another and picks up the
  // unfinished session, so this tap gets the answer of a create still
  // running.
  const start = useCallback(
    async (trigger: 'entry' | 'tryAgain') => {
      if (!asset) {
        return;
      }
      defaultLogger.transaction.send.binanceDepositStart({
        ...getBinanceDepositEventContext(asset),
        trigger,
      });
      attemptRef.current += 1;
      const attempt = attemptRef.current;
      releaseLocks();
      // A local read, asked before the card shows so it opens with the
      // right line.
      const resuming = await backgroundApiProxy.serviceBinanceDeposit
        .hasResumableAddress(asset)
        .catch(() => false);
      if (attempt !== attemptRef.current) {
        return;
      }
      setIsResuming(resuming);
      setSnapshot(null);
      try {
        await applyCreateResult(
          attempt,
          await backgroundApiProxy.serviceBinanceDeposit.startSession(asset),
        );
      } catch (error) {
        await handleCreateError({ attempt, error, asset });
      }
    },
    [applyCreateResult, asset, handleCreateError, releaseLocks],
  );

  // A retry keeps the session key of the first attempt.
  const retryCreate = useCallback(
    () =>
      runExclusive(async () => {
        if (!snapshot) {
          return;
        }
        const attempt = attemptRef.current;
        defaultLogger.transaction.send.binanceDepositStart({
          ...getBinanceDepositEventContext(snapshot),
          trigger: 'tryAgain',
        });
        try {
          await applyCreateResult(
            attempt,
            await backgroundApiProxy.serviceBinanceDeposit.retryCreate(
              snapshot.localId,
            ),
          );
        } catch (error) {
          await handleCreateError({
            attempt,
            error,
            asset: snapshot,
            localId: snapshot.localId,
          });
        }
      }),
    [applyCreateResult, handleCreateError, runExclusive, snapshot],
  );

  const reopenBinance = useCallback(
    () =>
      runExclusive(async () => {
        if (snapshot) {
          await openBinance(snapshot, attemptRef.current, true);
        }
      }),
    [openBinance, runExclusive, snapshot],
  );

  // Leaves the Binance flow; editing the recipient means a plain send. An
  // unfinished session is kept for the entry to pick up again, a failed one
  // is dropped. A start still waiting for the server is let go: its answer
  // no longer opens Binance.
  const exit = useCallback(async () => {
    attemptRef.current += 1;
    releaseLocks();
    const current = snapshot;
    setSnapshot(undefined);
    if (current?.phase === 'failed') {
      await backgroundApiProxy.serviceBinanceDeposit.discardSession(
        current.localId,
      );
    }
  }, [releaseLocks, snapshot]);

  const localId = snapshot?.localId;
  const phase = snapshot?.phase;
  useEffect(() => {
    if (!localId || phase === 'failed') {
      return;
    }
    let cancelled = false;
    const timer = setInterval(() => {
      void backgroundApiProxy.serviceBinanceDeposit.getSnapshot(localId).then(
        (next) => {
          if (cancelled) {
            return;
          }
          setSnapshot((current) => {
            if (current?.localId !== localId || isSameSnapshot(current, next)) {
              return current;
            }
            return next;
          });
        },
        () => undefined,
      );
    }, SNAPSHOT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [localId, phase]);

  return {
    snapshot,
    isBusy,
    isOpening,
    isResuming,
    start,
    retryCreate,
    reopenBinance,
    exit,
  };
}

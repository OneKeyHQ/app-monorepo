import { memo, useCallback, useEffect, useRef } from 'react';

import { getDialogInstances, rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import type { IReceiveKytIntroEntryPoint } from '@onekeyhq/shared/types/kyt';

import {
  type IPrimeSubscriptionPurchaseSuccessPayload,
  getErrorMessage,
} from '../../../Prime/primeSubscriptionPurchaseSuccess';

import { useKytIntroDialogPresenter } from './useKytIntroDialogPresenter';

type IKytIntroActiveClaim = {
  claimId: string;
  entryPoint: IReceiveKytIntroEntryPoint;
  isPresented: boolean;
  onekeyUserId: string;
};

// The buffered purchase-success trigger for the current runtime; the claimId
// is meaningless without the user it belongs to, so they travel as one value.
type IKytIntroPendingPurchase = {
  userId: string;
  claimId?: string;
};

function isKytPurchaseSurfaceOpen() {
  const rootState = rootNavigationRef.current?.getRootState();
  if (!rootState) {
    return true;
  }
  const top = rootState.routes[rootState.index ?? 0];
  if (top?.name === ERootRoutes.WebView) {
    return true;
  }
  // The Prime purchase WebView mounts as Modal -> WebViewModal
  // (openUrlByWebviewPro), not under ERootRoutes.WebView. Right after
  // navigate the nested state may not be materialized yet, so fall back to
  // the pending params screen.
  if (top?.name === ERootRoutes.Modal) {
    const nestedRoutes = (
      top.state as { routes?: { name: string }[] } | undefined
    )?.routes;
    if (nestedRoutes) {
      return nestedRoutes.some(
        (route) => route.name === EModalRoutes.WebViewModal,
      );
    }
    return (
      (top.params as { screen?: string } | undefined)?.screen ===
      EModalRoutes.WebViewModal
    );
  }
  return false;
}

function hasOpenBlockingDialog() {
  return getDialogInstances().some((instance) => instance.isExist());
}

function useKYTIntroDialog() {
  const [{ onekeyUserId }] = usePrimePersistAtom();
  const showDialog = useKytIntroDialogPresenter();
  // True once the intro has been shown (or is mid-show) for the current Prime
  // user; reset on account switch so each user is still evaluated once.
  const dialogShownRef = useRef(false);
  const pendingPurchaseRef = useRef<IKytIntroPendingPurchase | undefined>(
    undefined,
  );
  const activeClaimRef = useRef<IKytIntroActiveClaim | undefined>(undefined);
  // Serializes async attempts so concurrent triggers can't open two dialogs.
  const attemptInFlightRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  // Retry timers and purchase events must invoke the latest attempt without a
  // useCallback dependency cycle or a stale account closure.
  const attemptShowRef = useRef<(() => void) | undefined>(undefined);
  // Latest Prime user id, read inside the async attempt to detect an account
  // switch that happened mid-flight (see attemptShow). Kept as a ref because the
  // in-flight closure otherwise only sees the user captured when it started.
  const onekeyUserIdRef = useRef(onekeyUserId);
  onekeyUserIdRef.current = onekeyUserId;

  const canShowKytIntroNow = useCallback(
    () => !isKytPurchaseSurfaceOpen() && !hasOpenBlockingDialog(),
    [],
  );

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
  }, []);

  const releaseClaim = useCallback(
    async (claim: Pick<IKytIntroActiveClaim, 'claimId' | 'onekeyUserId'>) => {
      try {
        await backgroundApiProxy.serviceSetting.releaseKytIntroClaim({
          onekeyUserId: claim.onekeyUserId,
          ownerId: appEventBus.nodeId,
          claimId: claim.claimId,
        });
      } catch (error) {
        defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
          stage: 'claimRelease',
          errorMessage: getErrorMessage(error),
        });
      }
    },
    [],
  );

  // Releases and forgets the buffered purchase trigger when it can no longer
  // apply (account switch, unmount, or an event for another user).
  const releaseStalePendingPurchase = useCallback(() => {
    const pending = pendingPurchaseRef.current;
    pendingPurchaseRef.current = undefined;
    if (
      pending?.claimId &&
      pending.claimId !== activeClaimRef.current?.claimId
    ) {
      void releaseClaim({
        claimId: pending.claimId,
        onekeyUserId: pending.userId,
      });
    }
  }, [releaseClaim]);

  // Releases a claim this attempt no longer intends to present and clears the
  // active-claim slot if it still points at that claim.
  const abandonActiveClaim = useCallback(
    async (claim: Pick<IKytIntroActiveClaim, 'claimId' | 'onekeyUserId'>) => {
      await releaseClaim(claim);
      if (activeClaimRef.current?.claimId === claim.claimId) {
        activeClaimRef.current = undefined;
      }
    },
    [releaseClaim],
  );

  // Covers non-route dialogs closing, transient RPC failures, and another UI
  // runtime abandoning an expired lease. Overlay retries are bounded; a lease
  // retry waits directly for the persisted expiry and does not consume them.
  const scheduleRetry = useCallback(
    ({
      delayMs = 1000,
      incrementRetryCount = true,
    }: {
      delayMs?: number;
      incrementRetryCount?: boolean;
    } = {}) => {
      if (retryTimerRef.current) {
        return;
      }
      if (incrementRetryCount && retryCountRef.current >= 15) {
        return;
      }
      retryTimerRef.current = setTimeout(
        () => {
          retryTimerRef.current = undefined;
          if (incrementRetryCount) {
            retryCountRef.current += 1;
          }
          if (!isMountedRef.current || dialogShownRef.current) {
            return;
          }
          attemptShowRef.current?.();
        },
        Math.max(0, delayMs),
      );
    },
    [],
  );

  const attemptShow = useCallback(() => {
    // Covers re-entries that bypass the timer's own guard (the finally-block
    // re-invoke and the route/atom triggers racing an unmount).
    if (!isMountedRef.current) {
      return;
    }

    const currentUserId = onekeyUserIdRef.current;
    if (
      pendingPurchaseRef.current &&
      pendingPurchaseRef.current.userId !== currentUserId
    ) {
      // A purchase event belongs to the account that initiated it. Never carry
      // it across an account switch.
      releaseStalePendingPurchase();
    }

    const isPurchaseSuccessTrigger =
      !!currentUserId && pendingPurchaseRef.current?.userId === currentUserId;
    if (!currentUserId || !isPurchaseSuccessTrigger) {
      return;
    }
    if (dialogShownRef.current) {
      if (pendingPurchaseRef.current?.userId === currentUserId) {
        pendingPurchaseRef.current = undefined;
      }
      return;
    }
    if (attemptInFlightRef.current) {
      return;
    }

    const requestEntryPoint = 'primeSubscribeSuccess';
    if (!canShowKytIntroNow()) {
      scheduleRetry();
      return;
    }

    attemptInFlightRef.current = true;
    // Snapshot the user this attempt is evaluating; if the Prime user switches
    // while we await below, the results belong to a stale user and must not be
    // applied to the (now different) current user's "shown" guard.
    const requestUserId = currentUserId;
    const pendingPurchaseUserIdAtStart = pendingPurchaseRef.current?.userId;
    void (async () => {
      try {
        const claimResult =
          await backgroundApiProxy.serviceSetting.tryClaimKytIntro({
            onekeyUserId: requestUserId,
            ownerId: appEventBus.nodeId,
            entryPoint: requestEntryPoint,
            claimId:
              pendingPurchaseRef.current?.claimId ??
              (activeClaimRef.current?.onekeyUserId === requestUserId
                ? activeClaimRef.current.claimId
                : undefined),
          });

        if (claimResult.status !== 'claimed') {
          if (
            claimResult.status === 'shown' ||
            claimResult.status === 'enabled'
          ) {
            dialogShownRef.current = true;
            activeClaimRef.current = undefined;
            if (pendingPurchaseRef.current?.userId === requestUserId) {
              pendingPurchaseRef.current = undefined;
            }
          } else if (claimResult.status === 'claimedByOther') {
            scheduleRetry({
              delayMs: claimResult.retryAfterMs + 100,
              incrementRetryCount: false,
            });
          }
          return;
        }

        const entryPoint = claimResult.entryPoint;
        const activeClaim: IKytIntroActiveClaim = {
          claimId: claimResult.claimId,
          entryPoint,
          isPresented: false,
          onekeyUserId: requestUserId,
        };
        activeClaimRef.current = activeClaim;

        if (
          requestUserId !== onekeyUserIdRef.current ||
          !isMountedRef.current
        ) {
          await abandonActiveClaim(activeClaim);
          return;
        }
        // Overlay state may have changed during the awaits — re-check the gate
        // for the final (possibly upgraded) trigger.
        if (!canShowKytIntroNow()) {
          scheduleRetry();
          return;
        }

        const isClaimPresented =
          await backgroundApiProxy.serviceSetting.markKytIntroClaimPresented({
            onekeyUserId: requestUserId,
            ownerId: appEventBus.nodeId,
            claimId: activeClaim.claimId,
          });
        if (!isClaimPresented) {
          activeClaimRef.current = undefined;
          scheduleRetry();
          return;
        }

        const canShowAfterMarking =
          requestUserId === onekeyUserIdRef.current &&
          isMountedRef.current &&
          canShowKytIntroNow();
        if (!canShowAfterMarking) {
          await abandonActiveClaim(activeClaim);
          scheduleRetry();
          return;
        }

        clearRetry();
        try {
          showDialog({
            entryPoint,
            onClose: () => {
              if (activeClaimRef.current?.claimId === activeClaim.claimId) {
                activeClaimRef.current = undefined;
              }
            },
            targetUserId: requestUserId,
          });
        } catch (error) {
          await abandonActiveClaim(activeClaim);
          throw error;
        }
        activeClaim.isPresented = true;
        dialogShownRef.current = true;
        // Persist "shown" the moment the dialog is actually on screen instead
        // of waiting for onClose: a runtime destroyed mid-display (extension
        // popup closed, process reclaimed, crash) would otherwise leave a
        // presented lease owned by a dead nodeId — suppressing other surfaces
        // for up to 30 minutes and re-popping the intro once it expires.
        // complete() also drops the lease atomically with the "shown" write;
        // onClose repeats it as an idempotent fallback.
        void backgroundApiProxy.serviceSetting
          .completeKytIntroClaim({ onekeyUserId: requestUserId })
          .catch((error) => {
            defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
              stage: 'claimComplete',
              errorMessage: getErrorMessage(error),
            });
          });
        if (pendingPurchaseRef.current?.userId === requestUserId) {
          pendingPurchaseRef.current = undefined;
        }
      } catch (error) {
        defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
          stage: 'eligibility',
          errorMessage: getErrorMessage(error),
        });
        if (
          requestUserId === onekeyUserIdRef.current &&
          isMountedRef.current &&
          pendingPurchaseRef.current?.userId === requestUserId
        ) {
          scheduleRetry();
        }
      } finally {
        attemptInFlightRef.current = false;
        // The user switched mid-flight: the early returns above intentionally
        // skipped the now-current user, and that switch's own trigger was
        // dropped by the in-flight guard. Re-evaluate once for the new user.
        if (
          requestUserId !== onekeyUserIdRef.current ||
          (pendingPurchaseUserIdAtStart !==
            pendingPurchaseRef.current?.userId &&
            pendingPurchaseRef.current?.userId === onekeyUserIdRef.current)
        ) {
          attemptShowRef.current?.();
        }
      }
    })();
  }, [
    canShowKytIntroNow,
    scheduleRetry,
    clearRetry,
    abandonActiveClaim,
    releaseStalePendingPurchase,
    showDialog,
  ]);

  useEffect(() => {
    attemptShowRef.current = attemptShow;
  }, [attemptShow]);

  useEffect(() => {
    const handlePurchaseSuccess = (
      payload: IPrimeSubscriptionPurchaseSuccessPayload,
    ) => {
      if (
        !payload?.onekeyUserId ||
        payload.onekeyUserId !== onekeyUserIdRef.current ||
        dialogShownRef.current
      ) {
        if (
          payload?.onekeyUserId &&
          payload.claimId &&
          payload.claimId !== activeClaimRef.current?.claimId
        ) {
          void releaseClaim({
            claimId: payload.claimId,
            onekeyUserId: payload.onekeyUserId,
          });
        }
        return;
      }
      pendingPurchaseRef.current = {
        userId: payload.onekeyUserId,
        claimId: payload.claimId,
      };
      retryCountRef.current = 0;
      clearRetry();
      attemptShowRef.current?.();
    };
    appEventBus.on(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      handlePurchaseSuccess,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
        handlePurchaseSuccess,
      );
    };
  }, [clearRetry, releaseClaim]);

  // Reset the per-user "shown" guard when the Prime user switches so each
  // account is evaluated once. Declared before the attempt triggers so that, on
  // a user change, the guard is cleared before attemptShow re-runs this commit.
  useEffect(() => {
    dialogShownRef.current = false;
    const activeClaim = activeClaimRef.current;
    if (
      activeClaim &&
      activeClaim.onekeyUserId !== onekeyUserId &&
      !activeClaim.isPresented
    ) {
      void releaseClaim(activeClaim);
      activeClaimRef.current = undefined;
    }
    if (
      pendingPurchaseRef.current &&
      pendingPurchaseRef.current.userId !== onekeyUserId
    ) {
      releaseStalePendingPurchase();
    }
    retryCountRef.current = 0;
    clearRetry();
  }, [onekeyUserId, clearRetry, releaseClaim, releaseStalePendingPurchase]);

  useEffect(() => {
    attemptShow();
  }, [attemptShow, onekeyUserId]);

  useEffect(() => {
    // Re-arm on every (re)mount — with only a cleanup, a StrictMode replay or a
    // genuine remount would leave the ref permanently false and silently kill
    // the retry timer and the attempt guards.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearRetry();
      const activeClaim = activeClaimRef.current;
      if (activeClaim && !activeClaim.isPresented) {
        void releaseClaim(activeClaim);
        activeClaimRef.current = undefined;
      }
      releaseStalePendingPurchase();
    };
  }, [clearRetry, releaseClaim, releaseStalePendingPurchase]);
}

function BasicKYTIntroOnMount() {
  useKYTIntroDialog();
  return null;
}

function KYTIntroOnMountGate() {
  // Standalone web has no automatic post-purchase intro.
  if (platformEnv.isWeb) {
    return null;
  }
  return <BasicKYTIntroOnMount />;
}

export const KYTIntroOnMount = memo(KYTIntroOnMountGate);

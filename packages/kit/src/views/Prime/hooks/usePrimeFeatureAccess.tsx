import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { shouldRunOneKeyIdAuthInExtExpandTab } from '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePrimeFreeTrialAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import {
  PrimeLoginDialogCancelError,
  PrimeLoginHandedOffToExtExpandTabError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import {
  createPrimeFreeTrialAttempt,
  getPrimeFreeTrialAccessDeniedResult,
} from '@onekeyhq/shared/src/utils/primeFreeTrialAnalytics';
import {
  getPrimeFreeTrialError,
  getPrimeFreeTrialHeldReservationEnd,
  hasPrimeFreeTrialReservationInfo,
} from '@onekeyhq/shared/src/utils/primeFreeTrialUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IPrimeFreeTrialError,
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialNotOpenReason,
  IPrimeFreeTrialPendingAction,
  IPrimeFreeTrialReservation,
  IPrimeFreeTrialStartResult,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import {
  PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
  isPrimeFreeTrialUsageFeatureId,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import {
  getPrimeFreeTrialQuotaOfUser,
  isPrimeFreeTrialStayOnPageFeature,
  resolvePrimeFreeTrialAccess,
} from '../utils/primeFreeTrialAccess';
import { getPrimeFreeTrialNoticeCopy } from '../utils/primeFreeTrialCopy';

import { usePrimeFreeTrialUpgrade } from './usePrimeFreeTrialUpgrade';

import type { IPrimeFreeTrialAccess } from '../utils/primeFreeTrialAccess';
import type { IPrimeFreeTrialNotice } from '../utils/primeFreeTrialCopy';

// Upper bound for the public config request of a logged-out entry. A slow
// request must not block the entry: an unknown config still offers the login.
// The request keeps running and fills the cache.
const ENTRY_REQUEST_TIMEOUT_MS = 5000;
// A public config answered within this (cached or fast) shows no loading, so
// the loading dialog never just flashes.
const ENTRY_LOADING_DELAY_MS = 300;

export type IPrimeFeatureAccessResult =
  | {
      granted: true;
      entitlementSource: 'prime' | 'freeTrial';
      // Extension popup only: the feature opens the expand tab, which runs
      // the login and page-level gate itself.
      deferredToExpandTab?: boolean;
    }
  | { granted: false };

export type IPrimeFeatureAccessExtPopupMode =
  // The feature already opens the expand tab (bulk send / revoke): let it
  // through without logging in inside the popup.
  | { mode: 'passThrough' }
  // Save the action in the background slot, then hand the login off to the
  // expand tab, which continues the action after login.
  | {
      mode: 'pendingAction';
      action: Omit<IPrimeFreeTrialPendingAction, 'createdAt' | 'expiresAt'>;
    };

export type IPrimeFeatureAccessDeniedReason =
  | 'loginCancelled'
  | 'contextChanged'
  | 'exhausted'
  | 'notOpen'
  | 'handedOffToExpandTab';

export function isPrimeFreeTrialTravelMode() {
  return (
    travelModeManager.getRuntimeEnvironmentSync().profile.kind === 'travel-mode'
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    timerUtils.wait(timeoutMs).then(() => undefined),
  ]);
}

export function usePrimeFeatureAccess() {
  const intl = useIntl();
  const { isPrimeSubscriptionActive, isLoggedIn, user, loginOneKeyId } =
    useOneKeyAuth();
  const [freeTrial] = usePrimeFreeTrialAtom();
  const freeTrialRef = useRef(freeTrial);
  freeTrialRef.current = freeTrial;

  const getCachedAccess = useCallback(
    (featureId: IPrimeFreeTrialFeatureId): IPrimeFreeTrialAccess =>
      resolvePrimeFreeTrialAccess({
        featureId,
        isPrimeSubscriptionActive: Boolean(isPrimeSubscriptionActive),
        isLoggedIn: Boolean(isLoggedIn),
        config: freeTrial.config.data,
        quota: getPrimeFreeTrialQuotaOfUser({
          quota: freeTrial.quota,
          onekeyUserId: user?.onekeyUserId,
        }),
      }),
    [
      freeTrial.config.data,
      freeTrial.quota,
      isLoggedIn,
      isPrimeSubscriptionActive,
      user?.onekeyUserId,
    ],
  );

  const { openPrimeDashboard, getPrime } = usePrimeFreeTrialUpgrade();

  const renderGetPrimeButton = useCallback(
    ({
      featureId,
      networkId,
      afterPageExit,
      freeTrialReason,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      networkId?: string;
      afterPageExit?: boolean;
      freeTrialReason?: 'exhausted' | 'notOpen';
    }) => (
      <Button
        testID="prime-free-trial-get-prime-btn"
        size="small"
        variant="tertiary"
        color="$textSuccess"
        onPress={() =>
          getPrime({ featureId, networkId, afterPageExit, freeTrialReason })
        }
      >
        {intl.formatMessage({ id: ETranslations.prime_get_prime })}
      </Button>
    ),
    [getPrime, intl],
  );

  // A rejection toast with the notice copy (shared with the remaining hint)
  // and, unless the dashboard is already open, a "Get Prime" button.
  const showFreeTrialNoticeToast = useCallback(
    ({
      featureId,
      notice,
      networkId,
      toastId,
      afterPageExit,
      showGetPrime = true,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      notice: IPrimeFreeTrialNotice;
      networkId?: string;
      toastId?: string;
      afterPageExit?: boolean;
      showGetPrime?: boolean;
    }) => {
      const { toastTitle, toastMessage } = getPrimeFreeTrialNoticeCopy({
        intl,
        featureId,
        notice,
      });
      Toast.message({
        toastId,
        title: toastTitle,
        message: toastMessage,
        actionsAlign: 'left',
        actions: showGetPrime
          ? renderGetPrimeButton({
              featureId,
              networkId,
              afterPageExit,
              freeTrialReason:
                notice.kind === 'exhausted' || notice.kind === 'reservationHeld'
                  ? 'exhausted'
                  : 'notOpen',
            })
          : undefined,
      });
    },
    [intl, renderGetPrimeButton],
  );

  // Feedback after the user actively tried a feature that is exhausted or
  // not open:
  // - exhausted: the dashboard and a toast saying why;
  // - not open: just the dashboard;
  // - translate stays on its page: a toast with "Get Prime" instead;
  // - the quota only held by live reservations of earlier uses (the server's
  //   reservation fields, which cover every device): a toast saying so, since
  //   nothing was used up and it comes back by itself.
  // Synchronous: callers run it right on the press, or right after their own
  // request while their page is still on top, so it never lands later.
  const showActiveRejectedFeedback = useCallback(
    ({
      featureId,
      reason,
      resetAt,
      networkId,
      afterPageExit,
      notOpenReason,
      reservation,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      reason: 'exhausted' | 'notOpen';
      resetAt?: number;
      networkId?: string;
      afterPageExit?: boolean;
      notOpenReason?: IPrimeFreeTrialNotOpenReason;
      // Reservation fields of the rejection (90600 data or the quota).
      reservation?: IPrimeFreeTrialReservation;
    }) => {
      const openDashboard = !isPrimeFreeTrialStayOnPageFeature(featureId);
      if (reason === 'notOpen') {
        // The details case: the feature itself is open.
        if (notOpenReason === 'detailsNotEligible') {
          showFreeTrialNoticeToast({
            featureId,
            notice: { kind: 'detailsNotEligible' },
            networkId,
            afterPageExit,
          });
          return;
        }
        if (openDashboard) {
          openPrimeDashboard({
            featureId,
            networkId,
            freeTrialReason: 'notOpen',
            afterPageExit,
          });
          return;
        }
        showFreeTrialNoticeToast({
          featureId,
          notice: { kind: 'notOpen' },
          networkId,
          afterPageExit,
        });
        return;
      }
      const heldUntil =
        isPrimeFreeTrialUsageFeatureId(featureId) &&
        hasPrimeFreeTrialReservationInfo(reservation)
          ? getPrimeFreeTrialHeldReservationEnd(reservation)
          : undefined;
      if (heldUntil) {
        showFreeTrialNoticeToast({
          featureId,
          notice: { kind: 'reservationHeld', heldUntil },
          networkId,
          afterPageExit,
        });
        return;
      }
      defaultLogger.prime.subscription.primeFreeTrialQuotaExhausted({
        featureName: featureId,
        featureId,
        trigger: 'active',
      });
      if (openDashboard) {
        openPrimeDashboard({
          featureId,
          networkId,
          freeTrialReason: 'exhausted',
          afterPageExit,
        });
      }
      showFreeTrialNoticeToast({
        featureId,
        notice: { kind: 'exhausted', resetAt },
        networkId,
        afterPageExit,
        showGetPrime: !openDashboard,
      });
    },
    [openPrimeDashboard, showFreeTrialNoticeToast],
  );

  const getResetAtOfSnapshot = useCallback(
    () => freeTrialRef.current.quota.data?.resetAt,
    [],
  );

  // Rejected start of a bulk tool (exhausted / notOpen).
  const handleStartRejected = useCallback(
    ({
      result,
      networkId,
    }: {
      result: Extract<
        IPrimeFreeTrialStartResult,
        { status: 'exhausted' } | { status: 'notOpen' }
      >;
      networkId?: string;
    }) => {
      showActiveRejectedFeedback({
        featureId: result.featureId,
        reason: result.status,
        resetAt:
          result.status === 'exhausted'
            ? (result.data.resetAt ?? getResetAtOfSnapshot())
            : undefined,
        networkId,
        reservation: result.status === 'exhausted' ? result.data : undefined,
      });
    },
    [getResetAtOfSnapshot, showActiveRejectedFeedback],
  );

  // Normalized free-trial error from a metered API (e.g. address check).
  // Returns true when the error was a free-trial error and is handled.
  const handleFreeTrialError = useCallback(
    ({
      error,
      networkId,
      afterPageExit,
    }: {
      error: unknown;
      networkId?: string;
      afterPageExit?: boolean;
    }): IPrimeFreeTrialError | undefined => {
      const freeTrialError = getPrimeFreeTrialError(error);
      if (!freeTrialError) {
        return undefined;
      }
      if (freeTrialError.code === PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE) {
        showActiveRejectedFeedback({
          featureId: freeTrialError.data.featureId,
          reason: 'exhausted',
          resetAt: freeTrialError.data.resetAt ?? getResetAtOfSnapshot(),
          networkId,
          afterPageExit,
          reservation: freeTrialError.data,
        });
        return freeTrialError;
      }
      const { featureId, reason } = freeTrialError.data;
      if (reason === 'detailsNotEligible') {
        // Details are only for addresses checked this month. With no use left
        // in the local snapshot, or an unknown quota, the address cannot be
        // checked again either, so this is the exhausted feedback. Uses left
        // (e.g. the month turned while the result page stayed open) keep the
        // details sentence. Feedback only: the local quota stays as it is.
        const access = getCachedAccess(featureId);
        const hasUsesLeft =
          access.status === 'available' &&
          (access.featureQuota?.remaining ?? 0) > 0;
        if (!hasUsesLeft) {
          showActiveRejectedFeedback({
            featureId,
            reason: 'exhausted',
            resetAt: access.status === 'exhausted' ? access.resetAt : undefined,
            networkId,
            afterPageExit,
          });
          return freeTrialError;
        }
      }
      showActiveRejectedFeedback({
        featureId,
        reason: 'notOpen',
        networkId,
        afterPageExit,
        notOpenReason: reason,
      });
      return freeTrialError;
    },
    [getCachedAccess, getResetAtOfSnapshot, showActiveRejectedFeedback],
  );

  // Both attempts share one ENTRY_REQUEST_TIMEOUT_MS budget; a timeout is an
  // unknown config, never "not open".
  const getPublicConfigWithRetry = useCallback(
    () =>
      withTimeout(
        (async () => {
          const config =
            await backgroundApiProxy.servicePrimeFreeTrial.getPublicConfig();
          if (config) {
            return config;
          }
          return backgroundApiProxy.servicePrimeFreeTrial.getPublicConfig({
            forceRefresh: true,
          });
        })(),
        ENTRY_REQUEST_TIMEOUT_MS,
      ),
    [],
  );

  // Most entries are menu items that close before the gate runs, so there
  // is no pressed button left to spin: a slow public config request shows a
  // loading dialog instead. It is closed before any login dialog or feedback.
  const runWithEntryLoading = useCallback(
    async <T,>(showLoading: boolean, task: () => Promise<T>): Promise<T> => {
      if (!showLoading) {
        return task();
      }
      let loadingDialog: ReturnType<typeof Dialog.loading> | undefined;
      const timer = setTimeout(() => {
        loadingDialog = Dialog.loading({
          title: intl.formatMessage({ id: ETranslations.global_preparing }),
        });
      }, ENTRY_LOADING_DELAY_MS);
      try {
        return await task();
      } finally {
        clearTimeout(timer);
        await loadingDialog?.close();
      }
    },
    [intl],
  );

  /**
   * Unified feature gate for Prime features with a free trial.
   * - Prime: granted right away, no free-trial request.
   * - Travel mode: legacy Prime behavior (dashboard).
   * - Logged out: open trial -> log in, then continue; not open -> dashboard.
   * - Logged-in free user, judged right away on the local quota snapshot
   *   (never waiting for a request, so the answer never lands after the user
   *   moved on): used up -> the dashboard and a toast; not open -> the
   *   dashboard; anything else -> granted. That covers uses left, an unknown
   *   quota (e.g. right after a login) and uses held by earlier unfinished
   *   ones, which may come back (released on another device, or expired)
   *   without this snapshot knowing. The page's remaining hint shows the
   *   held state and refreshes; its start or metered API is the final judge.
   *   With `loginOnly` (address risk check entries) the user only has to log
   *   in, to read the history; the check button judges the quota.
   * Translate never leaves its page: a toast with "Get Prime" instead.
   */
  const ensureFeatureAccessImpl = useCallback(
    async ({
      featureId,
      networkId,
      isContextValid,
      extPopup,
      onDenied,
      onAttemptDenied,
      showLoading = true,
      loginOnly = false,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      networkId?: string;
      // Continuations and page-mount checks are not new user attempts.
      trackAttempt?: boolean;
      onAttemptDenied?: (
        reason: IPrimeFeatureAccessDeniedReason | 'loginFailed',
      ) => void;
      // false when the caller already shows its own loading, e.g. on the
      // pressed button that stays on screen. Only a logged-out user waits
      // (for the public config).
      showLoading?: boolean;
      // Address risk check entries: only a login is needed, to read the
      // history; the check button judges the quota.
      loginOnly?: boolean;
      // Re-checked before granting after any async step (login, background
      // checks); false drops the continuation.
      isContextValid?: () => boolean | Promise<boolean>;
      extPopup?: IPrimeFeatureAccessExtPopupMode;
      // Runs before any dashboard / toast feedback, e.g. to leave the page
      // first.
      onDenied?: (
        reason: IPrimeFeatureAccessDeniedReason,
      ) => void | Promise<void>;
    }): Promise<IPrimeFeatureAccessResult> => {
      const deny = async (reason: IPrimeFeatureAccessDeniedReason) => {
        onAttemptDenied?.(reason);
        await onDenied?.(reason);
      };
      if (isPrimeSubscriptionActive) {
        return { granted: true, entitlementSource: 'prime' };
      }
      // The wallet, network or input the caller acts on, or its page, may be
      // gone after any wait: a stale context gets no login, no grant and no
      // denied feedback. Checked before onDenied, so a gate that leaves the
      // page itself still hands off to the dashboard.
      const isContextGone = async () =>
        isContextValid ? !(await isContextValid()) : false;
      const grantIfContextValid = async (
        result: Extract<IPrimeFeatureAccessResult, { granted: true }>,
      ): Promise<IPrimeFeatureAccessResult> => {
        if (await isContextGone()) {
          await deny('contextChanged');
          return { granted: false };
        }
        return result;
      };
      const afterPageExit = Boolean(onDenied);
      if (isPrimeFreeTrialTravelMode()) {
        await deny('notOpen');
        openPrimeDashboard({ featureId, networkId, afterPageExit });
        return { granted: false };
      }

      const loggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (!loggedIn) {
        const config = await runWithEntryLoading(
          showLoading,
          getPublicConfigWithRetry,
        );
        if (await isContextGone()) {
          await deny('contextChanged');
          return { granted: false };
        }
        const loggedOutAccess = resolvePrimeFreeTrialAccess({
          featureId,
          isPrimeSubscriptionActive: false,
          isLoggedIn: false,
          config,
          quota: undefined,
        });
        if (loggedOutAccess.status === 'notOpen') {
          await deny('notOpen');
          showActiveRejectedFeedback({
            featureId,
            reason: 'notOpen',
            networkId,
            afterPageExit,
          });
          return { granted: false };
        }
        if (shouldRunOneKeyIdAuthInExtExpandTab()) {
          if (extPopup?.mode === 'passThrough') {
            return grantIfContextValid({
              granted: true,
              entitlementSource: 'freeTrial',
              deferredToExpandTab: true,
            });
          }
          if (extPopup?.mode === 'pendingAction') {
            await backgroundApiProxy.servicePrimeFreeTrial.savePendingAction(
              extPopup.action,
            );
          }
        }
        try {
          await loginOneKeyId({
            keepFreeTrialPendingAction: extPopup?.mode === 'pendingAction',
          });
        } catch (error) {
          if (error instanceof PrimeLoginHandedOffToExtExpandTabError) {
            // The expand tab continues the saved action after login.
            await deny('handedOffToExpandTab');
            return { granted: false };
          }
          defaultLogger.prime.subscription.primeFreeTrialLoginResult({
            featureName: featureId,
            featureId,
            result:
              error instanceof PrimeLoginDialogCancelError
                ? 'cancelled'
                : 'failed',
          });
          if (!(error instanceof PrimeLoginDialogCancelError))
            onAttemptDenied?.('loginFailed');
          await deny('loginCancelled');
          return { granted: false };
        }
        defaultLogger.prime.subscription.primeFreeTrialLoginResult({
          featureName: featureId,
          featureId,
          result: 'success',
        });
        if (
          (await isContextGone()) ||
          !(await backgroundApiProxy.servicePrime.isLoggedIn())
        ) {
          await deny('contextChanged');
          return { granted: false };
        }
      }

      // The hook value may lag right after a login or a purchase.
      if (await backgroundApiProxy.servicePrime.isPrimeSubscriptionActive()) {
        return grantIfContextValid({
          granted: true,
          entitlementSource: 'prime',
        });
      }
      // The local snapshot as of the press. Right after a login in this call
      // it still reads logged out (`loginRequired`): the quota of the new
      // login is unknown then anyway, so the user is let in. The page's
      // remaining hint refreshes the snapshot.
      const access = getCachedAccess(featureId);
      if (await isContextGone()) {
        await deny('contextChanged');
        return { granted: false };
      }
      if (loginOnly) {
        return { granted: true, entitlementSource: 'freeTrial' };
      }
      if (access.status === 'notOpen') {
        await deny('notOpen');
        showActiveRejectedFeedback({
          featureId,
          reason: 'notOpen',
          networkId,
          afterPageExit,
        });
        return { granted: false };
      }
      // Blocked only when nothing can come back. A bulk tool's uses may be
      // held by an earlier one (released elsewhere or expired later), so it
      // is blocked only when the server says nothing is held; an older
      // server without the fields is unknown and lets the user in too.
      if (
        access.status === 'exhausted' &&
        (!isPrimeFreeTrialUsageFeatureId(featureId) ||
          (hasPrimeFreeTrialReservationInfo(access.featureQuota) &&
            !(Number(access.featureQuota.reserved) > 0)))
      ) {
        await deny('exhausted');
        showActiveRejectedFeedback({
          featureId,
          reason: 'exhausted',
          resetAt: access.resetAt,
          networkId,
          afterPageExit,
        });
        return { granted: false };
      }
      return { granted: true, entitlementSource: 'freeTrial' };
    },
    [
      getCachedAccess,
      getPublicConfigWithRetry,
      isPrimeSubscriptionActive,
      loginOneKeyId,
      openPrimeDashboard,
      runWithEntryLoading,
      showActiveRejectedFeedback,
    ],
  );

  const ensureFeatureAccess = useCallback(
    (
      params: Parameters<typeof ensureFeatureAccessImpl>[0],
    ): Promise<IPrimeFeatureAccessResult> => {
      if (
        params.trackAttempt === false ||
        params.loginOnly ||
        isPrimeSubscriptionActive ||
        isPrimeFreeTrialTravelMode()
      ) {
        return ensureFeatureAccessImpl(params);
      }
      const attempt = createPrimeFreeTrialAttempt({
        featureId: params.featureId,
        stage: 'access',
      });
      const promise = (async () => {
        try {
          const access = await ensureFeatureAccessImpl({
            ...params,
            onAttemptDenied: (reason) => {
              attempt.finish(
                getPrimeFreeTrialAccessDeniedResult(reason),
                reason === 'exhausted' || reason === 'notOpen'
                  ? 'client'
                  : undefined,
              );
            },
          });
          if (access.granted) {
            let result: 'handedOffToExpandTab' | 'unlimited' | 'granted' =
              'granted';
            if (access.deferredToExpandTab) result = 'handedOffToExpandTab';
            else if (access.entitlementSource === 'prime') result = 'unlimited';
            attempt.finish(result);
          }
          return access;
        } catch (error) {
          attempt.finish('failed');
          throw error;
        }
      })();
      return promise;
    },
    [ensureFeatureAccessImpl, isPrimeSubscriptionActive],
  );

  return useMemo(
    () => ({
      getCachedAccess,
      ensureFeatureAccess,
      openPrimeDashboard,
      showFreeTrialNoticeToast,
      showActiveRejectedFeedback,
      handleStartRejected,
      handleFreeTrialError,
    }),
    [
      ensureFeatureAccess,
      getCachedAccess,
      handleFreeTrialError,
      handleStartRejected,
      openPrimeDashboard,
      showActiveRejectedFeedback,
      showFreeTrialNoticeToast,
    ],
  );
}

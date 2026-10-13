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
  IPrimeFreeTrialQuota,
  IPrimeFreeTrialReservation,
  IPrimeFreeTrialStartResult,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import {
  PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
  isPrimeFreeTrialUsageFeatureId,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import {
  getPrimeFreeTrialQuotaOfUser,
  resolvePrimeFreeTrialAccess,
} from '../utils/primeFreeTrialAccess';
import {
  PRIME_FREE_TRIAL_COPY,
  getPrimeFreeTrialNoticeCopy,
} from '../utils/primeFreeTrialCopy';

import { usePrimeFreeTrialUpgrade } from './usePrimeFreeTrialUpgrade';

import type { IPrimeFreeTrialAccess } from '../utils/primeFreeTrialAccess';
import type { IPrimeFreeTrialNotice } from '../utils/primeFreeTrialCopy';

// Upper bound for each gate request on feature entry (public config, quota
// refresh). A slow request must not block the entry: an unknown config still
// offers the login and an unknown quota lets the user in, and start or the
// metered API decides. The request keeps running and fills the cache.
const ENTRY_REQUEST_TIMEOUT_MS = 5000;
// Gate requests answered within this (cached or fast) show no loading, so the
// loading dialog never just flashes.
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
        {PRIME_FREE_TRIAL_COPY.getPrime}
      </Button>
    ),
    [getPrime],
  );

  // A rejection toast: the notice copy (shared with the remaining hint) and a
  // "Get Prime" button. The dashboard only opens on that press, never
  // automatically.
  const showFreeTrialNoticeToast = useCallback(
    ({
      featureId,
      notice,
      networkId,
      toastId,
      afterPageExit,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      notice: IPrimeFreeTrialNotice;
      networkId?: string;
      toastId?: string;
      afterPageExit?: boolean;
    }) => {
      const { toastTitle, toastMessage } = getPrimeFreeTrialNoticeCopy({
        featureId,
        notice,
      });
      Toast.message({
        toastId,
        title: toastTitle,
        message: toastMessage,
        actionsAlign: 'left',
        actions: renderGetPrimeButton({
          featureId,
          networkId,
          afterPageExit,
          freeTrialReason:
            notice.kind === 'exhausted' || notice.kind === 'reservationHeld'
              ? 'exhausted'
              : 'notOpen',
        }),
      });
    },
    [renderGetPrimeButton],
  );

  // Feedback after the user actively tried a feature that is exhausted or
  // not open: a toast with a "Get Prime" button, never the dashboard by
  // itself. When the quota is only held by live reservations of earlier uses,
  // the toast says so instead, since nothing was used up and it comes back by
  // itself. The server's reservation fields cover every device; an older
  // server without them falls back to this device's own records.
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
      if (reason === 'notOpen') {
        showFreeTrialNoticeToast({
          featureId,
          notice: {
            kind:
              notOpenReason === 'detailsNotEligible'
                ? 'detailsNotEligible'
                : 'notOpen',
          },
          networkId,
          afterPageExit,
        });
        return;
      }
      void (async () => {
        if (isPrimeFreeTrialUsageFeatureId(featureId)) {
          let heldUntil: number | undefined;
          if (hasPrimeFreeTrialReservationInfo(reservation)) {
            heldUntil = getPrimeFreeTrialHeldReservationEnd(reservation);
          } else {
            try {
              heldUntil =
                await backgroundApiProxy.servicePrimeFreeTrial.getHeldReservationEnd(
                  { featureId },
                );
            } catch {
              // Fall back to the exhausted feedback.
            }
          }
          if (heldUntil) {
            showFreeTrialNoticeToast({
              featureId,
              notice: { kind: 'reservationHeld', heldUntil },
              networkId,
              afterPageExit,
            });
            return;
          }
        }
        defaultLogger.prime.subscription.primeFreeTrialQuotaExhausted({
          featureName: featureId,
          featureId,
          trigger: 'active',
        });
        showFreeTrialNoticeToast({
          featureId,
          notice: { kind: 'exhausted', resetAt },
          networkId,
          afterPageExit,
        });
      })();
    },
    [showFreeTrialNoticeToast],
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

  // A refresh that fails or does not answer in time leaves the quota unknown,
  // which lets the user in. The cached snapshot is not used instead: its 0
  // may be a use released since.
  const loadQuotaOfLoggedInFreeUser = useCallback(
    async (): Promise<IPrimeFreeTrialQuota | null | undefined> =>
      withTimeout(
        backgroundApiProxy.servicePrimeFreeTrial.refreshQuota({ dedupe: true }),
        ENTRY_REQUEST_TIMEOUT_MS,
      ),
    [],
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
  // is no pressed button left to spin: a slow gate request shows a loading
  // dialog instead. It is closed before any login dialog or feedback.
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
   * - Logged-in free user: exhausted / not open -> a toast with "Get Prime",
   *   else granted.
   *   With `deferQuotaCheck` (feature entries) the user is let in without a
   *   quota check; the submit inside the page decides.
   */
  const ensureFeatureAccess = useCallback(
    async ({
      featureId,
      networkId,
      isContextValid,
      extPopup,
      onDenied,
      showLoading = true,
      deferQuotaCheck = false,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      networkId?: string;
      // false when the caller already shows its own loading, e.g. on the
      // pressed button that stays on screen.
      showLoading?: boolean;
      // Feature entries: only log in here and let a logged-in free user in
      // whatever the quota; the submit (start, the metered API or a check on
      // the page's first step) shows the exhausted / not open feedback.
      deferQuotaCheck?: boolean;
      // Re-checked before granting after any async step (login, background
      // checks, quota refresh); false drops the continuation.
      isContextValid?: () => boolean | Promise<boolean>;
      extPopup?: IPrimeFeatureAccessExtPopupMode;
      // Runs before any dashboard / toast feedback, e.g. to leave the page
      // first.
      onDenied?: (
        reason: IPrimeFeatureAccessDeniedReason,
      ) => void | Promise<void>;
    }): Promise<IPrimeFeatureAccessResult> => {
      if (isPrimeSubscriptionActive) {
        return { granted: true, entitlementSource: 'prime' };
      }
      // The wallet, network or input the caller acts on may change while
      // this waits; a grant for a stale context is dropped.
      const grantIfContextValid = async (
        result: Extract<IPrimeFeatureAccessResult, { granted: true }>,
      ): Promise<IPrimeFeatureAccessResult> => {
        if (isContextValid && !(await isContextValid())) {
          await onDenied?.('contextChanged');
          return { granted: false };
        }
        return result;
      };
      const afterPageExit = Boolean(onDenied);
      if (isPrimeFreeTrialTravelMode()) {
        await onDenied?.('notOpen');
        openPrimeDashboard({ featureId, networkId, afterPageExit });
        return { granted: false };
      }

      const loggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (!loggedIn) {
        const config = await runWithEntryLoading(
          showLoading,
          getPublicConfigWithRetry,
        );
        const loggedOutAccess = resolvePrimeFreeTrialAccess({
          featureId,
          isPrimeSubscriptionActive: false,
          isLoggedIn: false,
          config,
          quota: undefined,
        });
        if (loggedOutAccess.status === 'notOpen') {
          await onDenied?.('notOpen');
          openPrimeDashboard({
            featureId,
            networkId,
            freeTrialReason: 'notOpen',
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
            await onDenied?.('handedOffToExpandTab');
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
          await onDenied?.('loginCancelled');
          return { granted: false };
        }
        defaultLogger.prime.subscription.primeFreeTrialLoginResult({
          featureName: featureId,
          featureId,
          result: 'success',
        });
        if (
          (isContextValid && !(await isContextValid())) ||
          !(await backgroundApiProxy.servicePrime.isLoggedIn())
        ) {
          await onDenied?.('contextChanged');
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
      if (deferQuotaCheck) {
        return grantIfContextValid({
          granted: true,
          entitlementSource: 'freeTrial',
        });
      }

      // Fast path for a user who was already logged in: a snapshot that
      // shows uses left lets them in right away and refreshes in the
      // background (start / the metered API is the final judge). Only a
      // snapshot of 0 / not open / unknown, or a fresh login, waits for the
      // refresh so the routing is right.
      if (loggedIn) {
        const localUser =
          await backgroundApiProxy.servicePrime.getLocalUserInfo();
        const cachedAccess = resolvePrimeFreeTrialAccess({
          featureId,
          isPrimeSubscriptionActive: false,
          isLoggedIn: true,
          config: undefined,
          quota: getPrimeFreeTrialQuotaOfUser({
            quota: freeTrialRef.current.quota,
            onekeyUserId: localUser.onekeyUserId,
          }),
        });
        if (cachedAccess.status === 'available' && cachedAccess.featureQuota) {
          void backgroundApiProxy.servicePrimeFreeTrial.refreshQuota({
            dedupe: true,
          });
          return grantIfContextValid({
            granted: true,
            entitlementSource: 'freeTrial',
          });
        }
      }

      const { quota, config } = await runWithEntryLoading(
        showLoading,
        async () => {
          const freshQuota = await loadQuotaOfLoggedInFreeUser();
          // null for a free user: nothing may be open; the public config
          // decides.
          const publicConfig =
            freshQuota === null
              ? ((await withTimeout(
                  backgroundApiProxy.servicePrimeFreeTrial.getPublicConfig(),
                  ENTRY_REQUEST_TIMEOUT_MS,
                )) ?? freeTrialRef.current.config.data)
              : undefined;
          return { quota: freshQuota, config: publicConfig };
        },
      );
      const access = resolvePrimeFreeTrialAccess({
        featureId,
        isPrimeSubscriptionActive: false,
        isLoggedIn: true,
        config,
        quota,
      });
      if (access.status === 'exhausted') {
        await onDenied?.('exhausted');
        showActiveRejectedFeedback({
          featureId,
          reason: 'exhausted',
          resetAt: access.resetAt,
          networkId,
          afterPageExit,
          reservation: access.featureQuota,
        });
        return { granted: false };
      }
      if (access.status === 'notOpen') {
        await onDenied?.('notOpen');
        showActiveRejectedFeedback({
          featureId,
          reason: 'notOpen',
          networkId,
          afterPageExit,
        });
        return { granted: false };
      }
      return grantIfContextValid({
        granted: true,
        entitlementSource: 'freeTrial',
      });
    },
    [
      getPublicConfigWithRetry,
      isPrimeSubscriptionActive,
      loadQuotaOfLoggedInFreeUser,
      loginOneKeyId,
      openPrimeDashboard,
      runWithEntryLoading,
      showActiveRejectedFeedback,
    ],
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

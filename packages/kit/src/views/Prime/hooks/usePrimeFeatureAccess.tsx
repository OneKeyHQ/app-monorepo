import { useCallback, useMemo, useRef } from 'react';

import { Button, Toast, rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { shouldRunOneKeyIdAuthInExtExpandTab } from '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimeFreeTrialAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import {
  PrimeLoginDialogCancelError,
  PrimeLoginHandedOffToExtExpandTabError,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import {
  formatPrimeFreeTrialReservationEnd,
  formatPrimeFreeTrialResetDate,
  getPrimeFreeTrialError,
} from '@onekeyhq/shared/src/utils/primeFreeTrialUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IPrimeFreeTrialError,
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialPendingAction,
  IPrimeFreeTrialQuota,
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
import { PRIME_FREE_TRIAL_COPY } from '../utils/primeFreeTrialCopy';

import type { IPrimeFreeTrialAccess } from '../utils/primeFreeTrialAccess';

// Upper bound for the quota refresh on feature entry. A slow request must not
// block the entry: an unknown quota lets the user in and start decides.
const ENTRY_QUOTA_REFRESH_TIMEOUT_MS = 5000;

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
  const navigation = useAppNavigation();
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

  const openPrimeDashboard = useCallback(
    ({
      featureId,
      networkId,
      freeTrialReason,
      afterPageExit,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      networkId?: string;
      freeTrialReason?: 'exhausted' | 'notOpen';
      // The calling page was just closed: its navigation object may no
      // longer resolve the root stack, so navigate from the root ref.
      afterPageExit?: boolean;
    }) => {
      const params = {
        fromFeature: featureId,
        networkId,
        freeTrialReason,
      };
      if (afterPageExit) {
        rootNavigationRef.current?.navigate(ERootRoutes.iOSFullScreen, {
          screen: EModalRoutes.PrimeModal,
          params: { screen: EPrimePages.PrimeDashboard, params },
        });
        return;
      }
      navigation.pushFullModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDashboard,
        params,
      });
    },
    [navigation],
  );

  const renderGetPrimeButton = useCallback(
    ({
      featureId,
      networkId,
      afterPageExit,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      networkId?: string;
      afterPageExit?: boolean;
    }) => (
      <Button
        testID="prime-free-trial-get-prime-btn"
        size="small"
        variant="tertiary"
        color="$textSuccess"
        onPress={() => {
          defaultLogger.prime.subscription.primeFreeTrialUpgradeClick({
            featureName: featureId,
            featureId,
          });
          openPrimeDashboard({
            featureId,
            networkId,
            freeTrialReason: 'exhausted',
            afterPageExit,
          });
        }}
      >
        {PRIME_FREE_TRIAL_COPY.getPrime}
      </Button>
    ),
    [openPrimeDashboard],
  );

  // Exhausted quota: a toast with a "Get Prime" button. The dashboard only
  // opens on that press, never automatically.
  const showQuotaExhaustedToast = useCallback(
    ({
      featureId,
      resetAt,
      networkId,
      toastId,
      afterPageExit,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      resetAt: number | undefined;
      networkId?: string;
      toastId?: string;
      afterPageExit?: boolean;
    }) => {
      const date = formatPrimeFreeTrialResetDate(resetAt);
      Toast.message({
        toastId,
        title: PRIME_FREE_TRIAL_COPY.exhaustedTitle[featureId],
        message: date ? PRIME_FREE_TRIAL_COPY.resetsOn(date) : undefined,
        actionsAlign: 'left',
        actions: renderGetPrimeButton({ featureId, networkId, afterPageExit }),
      });
    },
    [renderGetPrimeButton],
  );

  // Feedback after the user actively tried a feature that is exhausted or
  // not open. Not open: open the dashboard (the legacy Prime-only flow).
  // Exhausted: a toast with a "Get Prime" button; when the quota is only held
  // by a reservation of an earlier use on this device, the toast says so
  // instead, since nothing was used up and it comes back by itself.
  const showActiveRejectedFeedback = useCallback(
    ({
      featureId,
      reason,
      resetAt,
      networkId,
      afterPageExit,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      reason: 'exhausted' | 'notOpen';
      resetAt?: number;
      networkId?: string;
      afterPageExit?: boolean;
    }) => {
      if (reason === 'notOpen') {
        openPrimeDashboard({
          featureId,
          networkId,
          freeTrialReason: reason,
          afterPageExit,
        });
        return;
      }
      void (async () => {
        if (isPrimeFreeTrialUsageFeatureId(featureId)) {
          let heldUntil: number | undefined;
          try {
            heldUntil =
              await backgroundApiProxy.servicePrimeFreeTrial.getHeldReservationEnd(
                { featureId },
              );
          } catch {
            // Fall back to the exhausted feedback.
          }
          const time = formatPrimeFreeTrialReservationEnd(heldUntil);
          if (time) {
            Toast.message({
              title: PRIME_FREE_TRIAL_COPY.reservationHeldTitle[featureId],
              message: PRIME_FREE_TRIAL_COPY.reservationHeldMessage(time),
              actionsAlign: 'left',
              actions: renderGetPrimeButton({
                featureId,
                networkId,
                afterPageExit,
              }),
            });
            return;
          }
        }
        defaultLogger.prime.subscription.primeFreeTrialQuotaExhausted({
          featureName: featureId,
          featureId,
          trigger: 'active',
        });
        showQuotaExhaustedToast({
          featureId,
          resetAt,
          networkId,
          afterPageExit,
        });
      })();
    },
    [openPrimeDashboard, renderGetPrimeButton, showQuotaExhaustedToast],
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
        });
      } else {
        showActiveRejectedFeedback({
          featureId: freeTrialError.data.featureId,
          reason: 'notOpen',
          networkId,
          afterPageExit,
        });
      }
      return freeTrialError;
    },
    [getResetAtOfSnapshot, showActiveRejectedFeedback],
  );

  const loadQuotaOfLoggedInFreeUser = useCallback(async (): Promise<
    IPrimeFreeTrialQuota | null | undefined
  > => {
    const fresh = await withTimeout(
      backgroundApiProxy.servicePrimeFreeTrial.refreshQuota({ dedupe: true }),
      ENTRY_QUOTA_REFRESH_TIMEOUT_MS,
    );
    if (fresh !== undefined) {
      return fresh;
    }
    const localUser = await backgroundApiProxy.servicePrime.getLocalUserInfo();
    return getPrimeFreeTrialQuotaOfUser({
      quota: freeTrialRef.current.quota,
      onekeyUserId: localUser.onekeyUserId,
    });
  }, []);

  const getPublicConfigWithRetry = useCallback(async () => {
    const config =
      await backgroundApiProxy.servicePrimeFreeTrial.getPublicConfig();
    if (config) {
      return config;
    }
    return backgroundApiProxy.servicePrimeFreeTrial.getPublicConfig({
      forceRefresh: true,
    });
  }, []);

  /**
   * Unified feature gate for Prime features with a free trial.
   * - Prime: granted right away, no free-trial request.
   * - Travel mode: legacy Prime behavior (dashboard).
   * - Logged out: open trial -> log in, then continue; not open -> dashboard.
   * - Logged-in free user: exhausted / not open -> dashboard, else granted.
   */
  const ensureFeatureAccess = useCallback(
    async ({
      featureId,
      networkId,
      isContextValid,
      extPopup,
      onDenied,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      networkId?: string;
      // Re-checked after an async login; false drops the continuation.
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
      const afterPageExit = Boolean(onDenied);
      if (isPrimeFreeTrialTravelMode()) {
        await onDenied?.('notOpen');
        openPrimeDashboard({ featureId, networkId, afterPageExit });
        return { granted: false };
      }

      const loggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (!loggedIn) {
        const config = await getPublicConfigWithRetry();
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
            return {
              granted: true,
              entitlementSource: 'freeTrial',
              deferredToExpandTab: true,
            };
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
        return { granted: true, entitlementSource: 'prime' };
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
          return { granted: true, entitlementSource: 'freeTrial' };
        }
      }

      const quota = await loadQuotaOfLoggedInFreeUser();
      // null for a free user: nothing may be open; the public config decides.
      const config =
        quota === null
          ? ((await backgroundApiProxy.servicePrimeFreeTrial.getPublicConfig()) ??
            freeTrialRef.current.config.data)
          : undefined;
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
      return { granted: true, entitlementSource: 'freeTrial' };
    },
    [
      getPublicConfigWithRetry,
      isPrimeSubscriptionActive,
      loadQuotaOfLoggedInFreeUser,
      loginOneKeyId,
      openPrimeDashboard,
      showActiveRejectedFeedback,
    ],
  );

  return useMemo(
    () => ({
      getCachedAccess,
      ensureFeatureAccess,
      openPrimeDashboard,
      showQuotaExhaustedToast,
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
      showQuotaExhaustedToast,
    ],
  );
}

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  IPrimeFreeTrialUsageFeatureId,
  IPrimeFreeTrialUsageResult,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { getPrimeFreeTrialErrorToastTitle } from '../utils/primeFreeTrialAccess';

import { usePrimeFeatureAccess } from './usePrimeFeatureAccess';

export type IPrimeFreeTrialUsageStartOutcome =
  // Prime (locally or on the server): run without any metering.
  | { status: 'notMetered' }
  // Free user with a reservation: run and settle this usage id.
  | { status: 'granted'; usageId: string }
  // Exhausted / not open (feedback already shown), or the page closed while
  // starting: do not run.
  | { status: 'rejected' }
  // Start failed or stayed unknown: do not run.
  | { status: 'error'; error: unknown };

const USER_CANCEL_HARDWARE_CODES = new Set<number>([
  HardwareErrorCode.ActionCancelled,
  HardwareErrorCode.CallQueueActionCancelled,
  HardwareErrorCode.PinCancelled,
]);

const USER_CANCEL_CLASS_NAMES = new Set<string>([
  EOneKeyErrorClassNames.HardwareUserCancelFromOutside,
  EOneKeyErrorClassNames.PasswordPromptDialogCancel,
]);

// Settles still being written in the background, per feature, across pages
// (a result page settles, then the review page may start again). A new start
// waits for them, so the background already knows the previous round ended
// and can confirm its release before asking for another reservation.
const pendingSettles = new Map<
  IPrimeFreeTrialUsageFeatureId,
  Set<Promise<void>>
>();

async function waitForPendingSettles(featureId: IPrimeFreeTrialUsageFeatureId) {
  const settles = pendingSettles.get(featureId);
  if (settles?.size) {
    await Promise.allSettled(settles);
  }
}

// cancelled and failed both release the reservation; they only differ in
// analytics, so a best-effort classification is enough.
export function isPrimeFreeTrialUserCancelError(error: unknown) {
  const e = error as { code?: unknown; className?: unknown } | undefined;
  return (
    USER_CANCEL_HARDWARE_CODES.has(Number(e?.code)) ||
    USER_CANCEL_CLASS_NAMES.has(String(e?.className))
  );
}

// Usage metering of one bulk tool for free users. Prime users never start a
// usage (no id, no start / finish, no pending record).
export function usePrimeFreeTrialUsage({
  featureId,
}: {
  featureId: IPrimeFreeTrialUsageFeatureId;
}) {
  const intl = useIntl();
  const { isPrimeSubscriptionActive } = useOneKeyAuth();
  const { handleStartRejected, ensureFeatureAccess } = usePrimeFeatureAccess();
  // Set as soon as the page starts leaving (back / close), before its close
  // animation ends and it unmounts: the callers' own unmount refs lag behind
  // by that animation. The bulk tool pages never prevent their removal.
  const reactNavigation = useNavigation();
  const isPageLeavingRef = useRef(false);
  useEffect(
    () =>
      reactNavigation.addListener('beforeRemove', () => {
        isPageLeavingRef.current = true;
      }),
    [reactNavigation],
  );

  const settleUsage = useCallback(
    async (
      usageId: string | undefined,
      result: Exclude<IPrimeFreeTrialUsageResult, 'success'>,
    ) => {
      if (!usageId) {
        return;
      }
      const settle = (async () => {
        try {
          await backgroundApiProxy.servicePrimeFreeTrial.settleUsage({
            featureId,
            usageId,
            result,
          });
        } catch (error) {
          defaultLogger.prime.subscription.primeFreeTrialTrace({
            featureId,
            stage: 'settleUsage',
            reason: (error as Error | undefined)?.message,
          });
        }
      })();
      const settles = pendingSettles.get(featureId) ?? new Set();
      settles.add(settle);
      pendingSettles.set(featureId, settles);
      try {
        await settle;
      } finally {
        settles.delete(settle);
      }
    },
    [featureId],
  );

  const startUsage = useCallback(
    async ({
      networkId,
      isCallerGone,
    }: {
      networkId?: string;
      // True once the page that starts has closed: a use granted meanwhile
      // is released, the caller is told not to run, and a rejection gives
      // no feedback. Required so no caller forgets it.
      isCallerGone: () => boolean;
    }): Promise<IPrimeFreeTrialUsageStartOutcome> => {
      const isGone = () => isPageLeavingRef.current || isCallerGone();
      const isContextValid = () => !isGone();
      if (isPrimeSubscriptionActive) {
        return { status: 'notMetered' };
      }
      await waitForPendingSettles(featureId);
      // `allowLogin`: at most one login detour. The background reports a
      // missing login (e.g. the token was cleared after the page opened);
      // the unified gate asks the user to log in, then start runs once more.
      const startOnce = async (
        allowLogin: boolean,
      ): Promise<IPrimeFreeTrialUsageStartOutcome> => {
        const usageId = generateUUID();
        try {
          const result =
            await backgroundApiProxy.servicePrimeFreeTrial.startUsage({
              featureId,
              usageId,
            });
          if (result.status === 'unlimited') {
            return { status: 'notMetered' };
          }
          if (result.status === 'granted') {
            return { status: 'granted', usageId };
          }
          if (result.status === 'loginRequired') {
            if (!allowLogin) {
              return { status: 'rejected' };
            }
            const access = await ensureFeatureAccess({
              featureId,
              networkId,
              isContextValid,
            });
            if (!access.granted) {
              return { status: 'rejected' };
            }
            if (access.entitlementSource === 'prime') {
              return { status: 'notMetered' };
            }
            return await startOnce(false);
          }
          handleStartRejected({ result, networkId, isContextValid });
          return { status: 'rejected' };
        } catch (error) {
          defaultLogger.prime.subscription.primeFreeTrialTrace({
            featureId,
            stage: 'startUsage',
            reason: (error as Error | undefined)?.message,
          });
          // Errors flagged autoToast are already toasted by the background
          // proxy; never leave the press without any feedback.
          if (!(error as { autoToast?: boolean } | undefined)?.autoToast) {
            Toast.error({
              title: getPrimeFreeTrialErrorToastTitle({ error, intl }),
            });
          }
          return { status: 'error', error };
        }
      };
      const outcome = await startOnce(true);
      if (
        isGone() &&
        (outcome.status === 'granted' || outcome.status === 'notMetered')
      ) {
        if (outcome.status === 'granted') {
          await settleUsage(outcome.usageId, 'cancelled');
        }
        return { status: 'rejected' };
      }
      return outcome;
    },
    [
      ensureFeatureAccess,
      featureId,
      handleStartRejected,
      intl,
      isPrimeSubscriptionActive,
      settleUsage,
    ],
  );

  const markUsageSuccess = useCallback(
    async (usageId: string | undefined) => {
      if (!usageId) {
        return;
      }
      try {
        await backgroundApiProxy.servicePrimeFreeTrial.markUsageSuccess({
          featureId,
          usageId,
        });
      } catch (error) {
        defaultLogger.prime.subscription.primeFreeTrialTrace({
          featureId,
          stage: 'markUsageSuccess',
          reason: (error as Error | undefined)?.message,
        });
      }
    },
    [featureId],
  );

  const getUsageResult = useCallback(
    async (usageId: string | undefined) => {
      if (!usageId) {
        return undefined;
      }
      try {
        return await backgroundApiProxy.servicePrimeFreeTrial.getUsageResult({
          featureId,
          usageId,
        });
      } catch {
        return undefined;
      }
    },
    [featureId],
  );

  // "Retry failed items" on a result page. A usage that already broadcast is
  // reused (no new start, no second charge); a settled usage without any
  // broadcast needs a new start, and `proceed: false` keeps the result page
  // as it is. `usageId` undefined means the round was not metered: the start
  // checks again, as a Prime subscription may have lapsed since, and a Prime
  // user is still not metered.
  const prepareRetryUsage = useCallback(
    async ({
      usageId,
      succeededLocally,
      networkId,
      isCallerGone,
    }: {
      usageId: string | undefined;
      succeededLocally: boolean;
      networkId?: string;
      isCallerGone: () => boolean;
    }): Promise<{
      proceed: boolean;
      usageId: string | undefined;
      isNewUsage: boolean;
    }> => {
      if (
        usageId &&
        (succeededLocally || (await getUsageResult(usageId)) === 'success')
      ) {
        // A reused usage is never released, but a page closed meanwhile
        // runs no retry.
        return {
          proceed: !isPageLeavingRef.current && !isCallerGone(),
          usageId,
          isNewUsage: false,
        };
      }
      const outcome = await startUsage({ networkId, isCallerGone });
      if (outcome.status === 'rejected' || outcome.status === 'error') {
        return { proceed: false, usageId, isNewUsage: false };
      }
      return {
        proceed: true,
        usageId: outcome.status === 'granted' ? outcome.usageId : undefined,
        isNewUsage: true,
      };
    },
    [getUsageResult, startUsage],
  );

  return useMemo(
    () => ({
      startUsage,
      markUsageSuccess,
      settleUsage,
      getUsageResult,
      prepareRetryUsage,
    }),
    [
      getUsageResult,
      markUsageSuccess,
      prepareRetryUsage,
      settleUsage,
      startUsage,
    ],
  );
}

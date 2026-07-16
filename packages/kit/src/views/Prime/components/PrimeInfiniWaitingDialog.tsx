/* cspell:ignore Infini */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  SizableText,
  Spinner,
  Toast,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import type {
  IDialogInstance,
  IDialogShowProps,
} from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IPrimeInfiniSubscriptionPlan } from '@onekeyhq/shared/types/prime/primeTypes';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

// Fixed USD prices of the Infini crypto plans, used for analytics only.
// The actual charged amount is finalized on the server / Infini side.
const INFINI_PLAN_USD_AMOUNT: Record<IPrimeInfiniSubscriptionPlan, number> = {
  monthly: 29.99,
  yearly: 239,
};

function PrimeInfiniWaitingDialogContent({
  plan,
  featureName,
  checkoutUrl,
  renewalBaselineExpiresAt,
  renewalBaselineInfiniPeriodEnd,
}: {
  plan: IPrimeInfiniSubscriptionPlan;
  featureName?: EPrimeFeatures;
  checkoutUrl: string;
  renewalBaselineExpiresAt?: number;
  renewalBaselineInfiniPeriodEnd?: number;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const [isTimedOut, setIsTimedOut] = useState(false);
  // Guard against duplicated success handling when the interval poll and the
  // manual refresh resolve at (nearly) the same time
  const isSuccessHandledRef = useRef(false);

  const handleSuccess = useCallback(() => {
    if (isSuccessHandledRef.current) {
      return;
    }
    isSuccessHandledRef.current = true;
    defaultLogger.prime.subscription.primeSubscribeSuccess({
      planType: plan,
      amount: INFINI_PLAN_USD_AMOUNT[plan],
      currency: 'USD',
      featureName,
      paymentMethod: 'crypto',
    });
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.prime_payment_successful,
      }),
      message: intl.formatMessage({
        id: ETranslations.prime_payment_successful_description,
      }),
    });
    void dialogInstance.close();
  }, [dialogInstance, featureName, intl, plan]);

  const checkPaymentStatus = useCallback(async (): Promise<boolean> => {
    try {
      const { primeSubscription } =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      if (renewalBaselineExpiresAt) {
        // Renewal flow (integration plan §7.2): the user is still Prime while
        // paying the renewal invoice, so isPrime cannot be the signal here —
        // success means the expiry moved past the pre-renewal baseline
        if (
          primeSubscription?.isActive &&
          primeSubscription.expiresAt > renewalBaselineExpiresAt
        ) {
          handleSuccess();
          return true;
        }
        // Dual-channel guard: when the user's RevenueCat expiry exceeds the
        // Infini period end, paying the Infini renewal invoice extends only
        // the Infini period, so the merged account expiry (max of channels)
        // never moves past the baseline above and the payment would look
        // undetected forever. The Infini record's own currentPeriodEnd moving
        // past its captured baseline is the direct signal that the payment
        // landed. Only enabled when the caller captured a concrete Infini
        // baseline — 0 means a confirmed absence of an Infini subscription at
        // purchase time (any period end appearing later is the signal) —
        // because without one a pre-existing period end would fire a false
        // success.
        if (renewalBaselineInfiniPeriodEnd !== undefined) {
          const infiniSubscription =
            await backgroundApiProxy.servicePrime.apiGetInfiniSubscription();
          if (
            infiniSubscription?.currentPeriodEnd &&
            infiniSubscription.currentPeriodEnd > renewalBaselineInfiniPeriodEnd
          ) {
            handleSuccess();
            return true;
          }
        }
        return false;
      }
      // Prime access is granted by the server webhook; isPrime flipping to
      // true is the success signal. Callers must pass renewalBaselineExpiresAt
      // whenever the buyer is already Prime (renew / in-period re-purchase),
      // so this branch only ever serves buyers who are not Prime yet.
      if (primeSubscription?.isActive) {
        handleSuccess();
        return true;
      }
    } catch {
      // Transient network errors are ignored, the next poll retries
    }
    return false;
  }, [handleSuccess, renewalBaselineExpiresAt, renewalBaselineInfiniPeriodEnd]);

  useEffect(() => {
    // Nudge the server to pull the latest Infini state once; failures are
    // ignored because the polling below is the actual fallback
    void backgroundApiProxy.servicePrime.apiSyncInfiniWebhook().catch(() => {});

    const intervalId = setInterval(() => {
      void checkPaymentStatus();
    }, POLL_INTERVAL_MS);
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      setIsTimedOut(true);
    }, POLL_TIMEOUT_MS);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [checkPaymentStatus]);

  return (
    <YStack gap="$4" alignItems="center">
      {isTimedOut ? null : <Spinner size="large" />}
      <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
        {isTimedOut
          ? // TODO: i18n pending translation key
            'We haven’t detected your payment yet. If you have already paid, tap “I’ve completed payment” to refresh, or check back later.'
          : // TODO: i18n pending translation key
            'Complete the payment in your browser. On-chain confirmation may take a few minutes, and your subscription will be activated automatically once confirmed.'}
      </SizableText>
      {/* Recovery affordance: on web the initial window.open runs after async
          gaps and can be blocked by the popup blocker, so always let the user
          (re)open the checkout page from a direct user gesture */}
      <Button
        size="small"
        variant="secondary"
        icon="ArrowTopRightOutline"
        testID="prime-infini-open-checkout"
        onPress={() => {
          // System browser required for wallet-app / Binance Pay deep links
          // (integration plan §8)
          openUrlUtils.openUrlExternal(checkoutUrl, { useSystemBrowser: true });
        }}
      >
        {/* TODO: i18n pending translation key */}
        Open checkout page
      </Button>
      <Dialog.Footer
        showCancelButton
        showConfirmButton
        onCancelText={intl.formatMessage({
          id: ETranslations.global_later,
        })}
        // TODO: i18n pending translation key
        onConfirmText="I’ve completed payment"
        onConfirm={async ({ preventClose }) => {
          preventClose();
          const isActive = await checkPaymentStatus();
          if (!isActive) {
            Toast.message({
              // TODO: i18n pending translation key
              title: 'Payment not confirmed yet',
              // TODO: i18n pending translation key
              message:
                'On-chain confirmation may take a few minutes. Please try again later.',
            });
          }
        }}
      />
    </YStack>
  );
}

// Single-instance semantics: at most one waiting dialog (and thus one poller)
// may exist at a time, otherwise retried purchases would stack dialogs that
// each fire their own success toast and analytics event
let activeWaitingDialog: IDialogInstance | undefined;

export function showPrimeInfiniWaitingDialog({
  plan,
  featureName,
  checkoutUrl,
  renewalBaselineExpiresAt,
  renewalBaselineInfiniPeriodEnd,
  onClose,
  ...dialogProps
}: IDialogShowProps & {
  plan: IPrimeInfiniSubscriptionPlan;
  featureName?: EPrimeFeatures;
  checkoutUrl: string;
  // Pass the current expiry when the dialog waits for a renewal payment of a
  // still-active subscription; success is then detected by expiry extension
  renewalBaselineExpiresAt?: number;
  // Additionally pass the Infini record's own currentPeriodEnd (0 when no
  // Infini subscription exists yet) whenever the buyer is already Prime: for
  // dual-channel users the merged account expiry may never move (see the
  // dual-channel guard in checkPaymentStatus), so the Infini period end
  // moving forward is polled as a second success signal. Leave undefined
  // only when the pre-purchase Infini state is unknown.
  renewalBaselineInfiniPeriodEnd?: number;
}) {
  void activeWaitingDialog?.close();
  const dialog: IDialogInstance = Dialog.show({
    icon: 'ClockTimeHistoryOutline',
    // TODO: i18n pending translation key
    title: 'Waiting for payment',
    dismissOnOverlayPress: false,
    renderContent: (
      <PrimeInfiniWaitingDialogContent
        plan={plan}
        featureName={featureName}
        checkoutUrl={checkoutUrl}
        renewalBaselineExpiresAt={renewalBaselineExpiresAt}
        renewalBaselineInfiniPeriodEnd={renewalBaselineInfiniPeriodEnd}
      />
    ),
    onClose: async (extra) => {
      if (activeWaitingDialog === dialog) {
        activeWaitingDialog = undefined;
      }
      await onClose?.(extra);
    },
    ...dialogProps,
  });
  activeWaitingDialog = dialog;
  return dialog;
}

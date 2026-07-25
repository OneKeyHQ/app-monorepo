/* cspell:ignore Infini */
import { useCallback, useEffect, useRef } from 'react';

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
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IPrimeInfiniPurchaseStatusSnapshot,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { isPrimeInfiniPurchaseCompleted } from '../hooks/primeInfiniPaymentUtils';
import { usePrimePurchaseMonitor } from '../hooks/usePrimePurchaseMonitor';
import { logPrimeInfiniPaymentFlow } from '../primeInfiniPaymentLogger';
import {
  finishPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
} from '../primeSubscriptionPurchaseSuccess';

import type {
  IPrimePurchaseMonitorAdapter,
  IPrimePurchaseMonitorEvent,
} from '../hooks/usePrimePurchaseMonitor';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

type IExternalCheckoutTerminalReason = 'purchaseUserChanged';

function getExternalPollingFailureReason(reason: string) {
  if (reason === 'adapterFailed') {
    return 'purchaseStatusUnavailable';
  }
  if (reason === 'successHandlerFailed' || reason === 'terminalHandlerFailed') {
    return 'pollProcessingFailed';
  }
  return reason;
}

// Fixed USD prices of the Infini crypto plans, used for analytics only.
// The actual charged amount is finalized on the server / Infini side.
const INFINI_PLAN_USD_AMOUNT: Record<IPrimeInfiniSubscriptionPlan, number> = {
  monthly: 29.99,
  yearly: 239,
};

function PrimeInfiniWaitingDialogContent({
  plan,
  onekeyUserId,
  featureName,
  checkoutUrl,
  renewalBaselineExpiresAt,
  renewalBaselineInfiniPeriodEnd,
}: {
  plan: IPrimeInfiniSubscriptionPlan;
  onekeyUserId: string;
  featureName?: EPrimeFeatures;
  checkoutUrl: string;
  renewalBaselineExpiresAt?: number;
  renewalBaselineInfiniPeriodEnd?: number;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  // Guard against duplicated success handling across retries if the
  // post-purchase side effect partially completes before throwing.
  const isSuccessHandledRef = useRef(false);
  const purchaseUserMismatchLoggedRef = useRef(false);

  const ensurePurchaseUserIsCurrent = useCallback(async () => {
    const currentUser =
      await backgroundApiProxy.servicePrime.getLocalUserInfo();
    if (currentUser.isLoggedIn && currentUser.onekeyUserId === onekeyUserId) {
      return true;
    }
    if (!purchaseUserMismatchLoggedRef.current) {
      purchaseUserMismatchLoggedRef.current = true;
      logPrimeInfiniPaymentFlow({
        stage: 'externalCheckout',
        status: 'blocked',
        plan,
        featureName,
        checkoutType: 'externalWallet',
        reason: 'purchaseUserChanged',
      });
    }
    await dialogInstance.close();
    return false;
  }, [dialogInstance, featureName, onekeyUserId, plan]);

  const handleSuccess = useCallback(async () => {
    if (isSuccessHandledRef.current) {
      return;
    }
    isSuccessHandledRef.current = true;
    logPrimeInfiniPaymentFlow({
      stage: 'purchaseCompletion',
      status: 'started',
      plan,
      featureName,
      checkoutType: 'externalWallet',
    });
    try {
      if (!(await ensurePurchaseUserIsCurrent())) {
        return;
      }
      const successPayload =
        await preparePrimeSubscriptionPurchaseSuccess(onekeyUserId);
      const finishSuccess = () => {
        void (async () => {
          await timerUtils.wait(350);
          await finishPrimeSubscriptionPurchaseSuccess(successPayload);
        })().catch((error) => {
          errorToastUtils.showToastOfError(error);
        });
      };
      if (!(await ensurePurchaseUserIsCurrent())) {
        finishSuccess();
        return;
      }
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
      await dialogInstance.close();
      finishSuccess();
      logPrimeInfiniPaymentFlow({
        stage: 'purchaseCompletion',
        status: 'succeeded',
        plan,
        featureName,
        checkoutType: 'externalWallet',
      });
    } catch (error) {
      isSuccessHandledRef.current = false;
      logPrimeInfiniPaymentFlow({
        stage: 'purchaseCompletion',
        status: 'failed',
        plan,
        featureName,
        checkoutType: 'externalWallet',
        error,
      });
      throw error;
    }
  }, [
    dialogInstance,
    ensurePurchaseUserIsCurrent,
    featureName,
    intl,
    onekeyUserId,
    plan,
  ]);

  const adapter = useCallback<
    IPrimePurchaseMonitorAdapter<
      IPrimeInfiniPurchaseStatusSnapshot,
      IExternalCheckoutTerminalReason
    >
  >(async () => {
    try {
      if (!(await ensurePurchaseUserIsCurrent())) {
        return {
          status: 'terminal',
          reason: 'purchaseUserChanged',
        };
      }
      const purchaseStatus =
        await backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot(
          {
            expectedOneKeyUserId: onekeyUserId,
          },
        );
      if (purchaseStatus.onekeyUserId !== onekeyUserId) {
        if (!purchaseUserMismatchLoggedRef.current) {
          purchaseUserMismatchLoggedRef.current = true;
          logPrimeInfiniPaymentFlow({
            stage: 'paymentPolling',
            status: 'blocked',
            plan,
            featureName,
            checkoutType: 'externalWallet',
            reason: 'purchaseUserChanged',
          });
        }
        await dialogInstance.close();
        return {
          status: 'terminal',
          reason: 'purchaseUserChanged',
        };
      }
      const purchaseCompleted = isPrimeInfiniPurchaseCompleted({
        baseline: {
          onekeyUserId,
          wasPrimeActive: renewalBaselineExpiresAt !== undefined,
          primeExpiresAt: renewalBaselineExpiresAt,
          infiniPeriodEnd: renewalBaselineInfiniPeriodEnd,
        },
        primeSubscription: purchaseStatus.primeSubscription,
        infiniSubscription: purchaseStatus.infiniSubscription,
      });
      return {
        status: purchaseCompleted ? 'succeeded' : 'pending',
        data: purchaseStatus,
      };
    } catch (error) {
      return {
        status: 'pending',
        issue: {
          reason: 'purchaseStatusUnavailable',
          error,
        },
      };
    }
  }, [
    dialogInstance,
    ensurePurchaseUserIsCurrent,
    featureName,
    onekeyUserId,
    plan,
    renewalBaselineExpiresAt,
    renewalBaselineInfiniPeriodEnd,
  ]);

  const handleMonitorEvent = useCallback(
    (event: IPrimePurchaseMonitorEvent<IPrimeInfiniPurchaseStatusSnapshot>) => {
      const context = {
        stage: 'paymentPolling' as const,
        plan,
        featureName,
        checkoutType: 'externalWallet' as const,
      };
      if (event.type === 'started') {
        logPrimeInfiniPaymentFlow({
          ...context,
          status: 'started',
        });
      } else if (event.type === 'refreshed') {
        logPrimeInfiniPaymentFlow({
          ...context,
          status: 'refreshed',
          reason: 'manualRefresh',
        });
      } else if (event.type === 'failed') {
        logPrimeInfiniPaymentFlow({
          ...context,
          status: 'failed',
          retryCount: event.retryCount,
          reason: getExternalPollingFailureReason(event.issue.reason),
          error: event.issue.error,
        });
      } else if (event.type === 'recovered') {
        logPrimeInfiniPaymentFlow({
          ...context,
          status: 'recovered',
          retryCount: event.retryCount,
        });
      } else if (event.type === 'timedOut') {
        logPrimeInfiniPaymentFlow({
          ...context,
          status: 'failed',
          reason: 'paymentDetectionTimedOut',
        });
      }
    },
    [featureName, plan],
  );

  const monitor = usePrimePurchaseMonitor<
    IPrimeInfiniPurchaseStatusSnapshot,
    IExternalCheckoutTerminalReason
  >({
    sessionKey: [
      onekeyUserId,
      plan,
      checkoutUrl,
      renewalBaselineExpiresAt ?? '',
      renewalBaselineInfiniPeriodEnd ?? '',
    ].join(':'),
    enabled: true,
    adapter,
    onSuccess: handleSuccess,
    onTerminal: () => undefined,
    onEvent: handleMonitorEvent,
    pollIntervalMs: POLL_INTERVAL_MS,
    timeoutMs: POLL_TIMEOUT_MS,
  });

  useEffect(() => {
    // Nudge the server while the monitor independently checks the current
    // subscription snapshot. Neither request blocks the other.
    void (async () => {
      if (await ensurePurchaseUserIsCurrent()) {
        await backgroundApiProxy.servicePrime.apiSyncInfiniWebhook({
          expectedOneKeyUserId: onekeyUserId,
        });
      }
    })().catch((error) => {
      logPrimeInfiniPaymentFlow({
        stage: 'paymentPolling',
        status: 'failed',
        plan,
        featureName,
        checkoutType: 'externalWallet',
        reason: 'initialWebhookSyncFailed',
        error,
      });
    });
  }, [ensurePurchaseUserIsCurrent, featureName, onekeyUserId, plan]);

  return (
    <YStack gap="$4" alignItems="center">
      {monitor.isTimedOut ? null : <Spinner size="large" />}
      <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
        {monitor.isTimedOut
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
          logPrimeInfiniPaymentFlow({
            stage: 'externalCheckout',
            status: 'refreshed',
            plan,
            featureName,
            checkoutType: 'externalWallet',
            reason: 'checkoutReopened',
          });
          void (async () => {
            if (await ensurePurchaseUserIsCurrent()) {
              // System browser required for wallet-app / Binance Pay deep links
              // (integration plan §8)
              openUrlUtils.openUrlExternal(checkoutUrl, {
                useSystemBrowser: true,
              });
            }
          })();
        }}
      >
        {/* TODO: i18n pending translation key */}
        Open checkout page
      </Button>
      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        // TODO: i18n pending translation key
        onConfirmText="I’ve completed payment"
        onConfirm={async ({ preventClose }) => {
          preventClose();
          const refreshResult = await monitor.refresh();
          if (refreshResult === 'pending' || refreshResult === 'failed') {
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
  onekeyUserId,
  featureName,
  checkoutUrl,
  renewalBaselineExpiresAt,
  renewalBaselineInfiniPeriodEnd,
  onClose,
  ...dialogProps
}: IDialogShowProps & {
  plan: IPrimeInfiniSubscriptionPlan;
  onekeyUserId: string;
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
        onekeyUserId={onekeyUserId}
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

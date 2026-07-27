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
  IPrimeInfiniPendingPaymentSession,
  IPrimeInfiniPurchaseStatusSnapshot,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { isPrimeInfiniPurchaseCompleted } from '../hooks/primeInfiniPaymentUtils';
import { usePrimeInfiniPaymentPolling } from '../hooks/usePrimeInfiniPaymentPolling';
import { usePrimePurchaseMonitor } from '../hooks/usePrimePurchaseMonitor';
import {
  logPrimeInfiniPaymentFlow,
  logPrimeInfiniPaymentMonitorEvent,
} from '../primeInfiniPaymentLogger';
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
type IInternalPaymentWaitingSession = Omit<
  IPrimeInfiniPendingPaymentSession,
  'featureName'
> & {
  featureName?: EPrimeFeatures;
};
type IPrimeInfiniCompletionPaymentContext = {
  paymentId: string;
  networkId: string;
  tokenSymbol: string;
  amountDue: string;
  sendStarted: true;
};

export type IPrimeInfiniWaitingContext =
  | {
      checkoutType: 'externalWallet';
      plan: IPrimeInfiniSubscriptionPlan;
      onekeyUserId: string;
      featureName?: EPrimeFeatures;
      checkoutUrl: string;
      // Pass the current expiry when the dialog waits for a renewal payment of
      // a still-active subscription; success is then detected by expiry extension.
      renewalBaselineExpiresAt?: number;
      // The Infini period end is an additional renewal success signal when the
      // merged Prime expiry does not move for dual-channel subscribers.
      renewalBaselineInfiniPeriodEnd?: number;
    }
  | {
      checkoutType: 'internalWallet';
      session: IInternalPaymentWaitingSession;
    };

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

function usePrimeInfiniPurchaseCompletion({
  plan,
  onekeyUserId,
  featureName,
  checkoutType,
  subscriptionPeriod,
  beforeComplete,
}: {
  plan: IPrimeInfiniSubscriptionPlan;
  onekeyUserId: string;
  featureName?: EPrimeFeatures;
  checkoutType: IPrimeInfiniWaitingContext['checkoutType'];
  subscriptionPeriod?: IInternalPaymentWaitingSession['selectedSubscriptionPeriod'];
  beforeComplete?: () => Promise<void>;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const isSuccessHandledRef = useRef(false);
  const purchaseUserMismatchLoggedRef = useRef(false);

  const blockPurchaseUserMismatch = useCallback(
    async ({
      stage,
      paymentContext,
    }: {
      stage: 'paymentPolling' | 'purchaseCompletion';
      paymentContext?: IPrimeInfiniCompletionPaymentContext;
    }) => {
      if (!purchaseUserMismatchLoggedRef.current) {
        purchaseUserMismatchLoggedRef.current = true;
        logPrimeInfiniPaymentFlow({
          stage,
          status: 'blocked',
          subscriptionPeriod,
          plan,
          featureName,
          checkoutType,
          ...paymentContext,
          reason: 'purchaseUserChanged',
        });
      }
      await dialogInstance.close();
    },
    [checkoutType, dialogInstance, featureName, plan, subscriptionPeriod],
  );

  const ensurePurchaseUserIsCurrent = useCallback(
    async ({
      stage,
      paymentContext,
    }: {
      stage: 'paymentPolling' | 'purchaseCompletion';
      paymentContext?: IPrimeInfiniCompletionPaymentContext;
    }) => {
      const currentUser =
        await backgroundApiProxy.servicePrime.getLocalUserInfo();
      if (currentUser.isLoggedIn && currentUser.onekeyUserId === onekeyUserId) {
        return true;
      }
      await blockPurchaseUserMismatch({ stage, paymentContext });
      return false;
    },
    [blockPurchaseUserMismatch, onekeyUserId],
  );

  const completePurchase = useCallback(
    async ({
      analyticsAmount,
      paymentContext,
    }: {
      analyticsAmount: number;
      paymentContext?: IPrimeInfiniCompletionPaymentContext;
    }) => {
      if (isSuccessHandledRef.current) {
        return;
      }
      isSuccessHandledRef.current = true;
      logPrimeInfiniPaymentFlow({
        stage: 'purchaseCompletion',
        status: 'started',
        subscriptionPeriod,
        plan,
        featureName,
        checkoutType,
        ...paymentContext,
      });
      try {
        if (
          !(await ensurePurchaseUserIsCurrent({
            stage: 'purchaseCompletion',
            paymentContext,
          }))
        ) {
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
        if (
          !(await ensurePurchaseUserIsCurrent({
            stage: 'purchaseCompletion',
            paymentContext,
          }))
        ) {
          finishSuccess();
          return;
        }
        await beforeComplete?.();
        defaultLogger.prime.subscription.primeSubscribeSuccess({
          planType: plan,
          amount: analyticsAmount,
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
          subscriptionPeriod,
          plan,
          featureName,
          checkoutType,
          ...paymentContext,
        });
      } catch (error) {
        isSuccessHandledRef.current = false;
        logPrimeInfiniPaymentFlow({
          stage: 'purchaseCompletion',
          status: 'failed',
          subscriptionPeriod,
          plan,
          featureName,
          checkoutType,
          ...paymentContext,
          error,
        });
        throw error;
      }
    },
    [
      beforeComplete,
      checkoutType,
      dialogInstance,
      ensurePurchaseUserIsCurrent,
      featureName,
      intl,
      onekeyUserId,
      plan,
      subscriptionPeriod,
    ],
  );

  return {
    blockPurchaseUserMismatch,
    completePurchase,
    ensurePurchaseUserIsCurrent,
  };
}

function PrimeInfiniWaitingStatus({
  isTerminal,
  message,
}: {
  isTerminal: boolean;
  message: string;
}) {
  return (
    <YStack gap="$4" alignItems="center">
      {isTerminal ? null : <Spinner size="large" />}
      <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
        {message}
      </SizableText>
    </YStack>
  );
}

function PrimeInfiniExternalWaitingMonitor({
  context,
}: {
  context: Extract<
    IPrimeInfiniWaitingContext,
    { checkoutType: 'externalWallet' }
  >;
}) {
  const {
    plan,
    onekeyUserId,
    featureName,
    checkoutUrl,
    renewalBaselineExpiresAt,
    renewalBaselineInfiniPeriodEnd,
  } = context;
  const {
    blockPurchaseUserMismatch,
    completePurchase,
    ensurePurchaseUserIsCurrent,
  } = usePrimeInfiniPurchaseCompletion({
    plan,
    onekeyUserId,
    featureName,
    checkoutType: 'externalWallet',
  });

  const handleSuccess = useCallback(
    () =>
      completePurchase({
        analyticsAmount: INFINI_PLAN_USD_AMOUNT[plan],
      }),
    [completePurchase, plan],
  );

  const adapter = useCallback<
    IPrimePurchaseMonitorAdapter<
      IPrimeInfiniPurchaseStatusSnapshot,
      IExternalCheckoutTerminalReason
    >
  >(async () => {
    try {
      if (
        !(await ensurePurchaseUserIsCurrent({
          stage: 'paymentPolling',
        }))
      ) {
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
        await blockPurchaseUserMismatch({
          stage: 'paymentPolling',
        });
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
    blockPurchaseUserMismatch,
    ensurePurchaseUserIsCurrent,
    onekeyUserId,
    renewalBaselineExpiresAt,
    renewalBaselineInfiniPeriodEnd,
  ]);

  const handleMonitorEvent = useCallback(
    (event: IPrimePurchaseMonitorEvent<IPrimeInfiniPurchaseStatusSnapshot>) => {
      logPrimeInfiniPaymentMonitorEvent({
        event,
        context: {
          stage: 'paymentPolling',
          plan,
          featureName,
          checkoutType: 'externalWallet',
        },
        getFailureReason: getExternalPollingFailureReason,
      });
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
      if (
        await ensurePurchaseUserIsCurrent({
          stage: 'paymentPolling',
        })
      ) {
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
      <PrimeInfiniWaitingStatus
        isTerminal={monitor.isTimedOut}
        message={
          monitor.isTimedOut
            ? // TODO: i18n pending translation key
              'We haven’t detected your payment yet. Confirmation may still be processing, so please check back later.'
            : // TODO: i18n pending translation key
              'Complete the payment in your browser. On-chain confirmation may take a few minutes, and your subscription will be activated automatically once confirmed.'
        }
      />
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
            if (
              await ensurePurchaseUserIsCurrent({
                stage: 'paymentPolling',
              })
            ) {
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

function PrimeInfiniInternalWaitingMonitor({
  session,
}: {
  session: IInternalPaymentWaitingSession;
}) {
  const { baseline, asset, plan, featureName, selectedSubscriptionPeriod } =
    session;
  const clearPendingSession = useCallback(
    () =>
      backgroundApiProxy.simpleDb.prime.clearInfiniPendingPaymentSession({
        onekeyUserId: baseline.onekeyUserId,
        expectedPaymentCacheIdentity: session.paymentCacheKey,
      }),
    [baseline.onekeyUserId, session.paymentCacheKey],
  );
  const { completePurchase } = usePrimeInfiniPurchaseCompletion({
    plan,
    onekeyUserId: baseline.onekeyUserId,
    featureName,
    checkoutType: 'internalWallet',
    subscriptionPeriod: selectedSubscriptionPeriod,
    beforeComplete: clearPendingSession,
  });

  const handleSuccess = useCallback(
    async (latestPayment: IPrimeInfiniPendingPaymentSession['payment']) => {
      const analyticsAmount = Number(latestPayment.amountDue);
      await completePurchase({
        analyticsAmount: Number.isFinite(analyticsAmount) ? analyticsAmount : 0,
        paymentContext: {
          paymentId: latestPayment.paymentId,
          networkId: asset.networkId,
          tokenSymbol: asset.token,
          amountDue: latestPayment.amountDue,
          sendStarted: true,
        },
      });
    },
    [asset.networkId, asset.token, completePurchase],
  );

  const polling = usePrimeInfiniPaymentPolling({
    payment: session.payment,
    asset,
    baseline,
    enabled: true,
    onSuccess: handleSuccess,
    onTerminal: () => undefined,
  });
  const isTerminal =
    polling.outcome === 'expired' || polling.outcome === 'failed';
  let statusMessage =
    'On-chain confirmation may take a few minutes. Your subscription will be activated automatically once confirmed.';
  if (polling.outcome === 'expired') {
    // TODO: i18n pending translation key
    statusMessage = 'This payment has expired.';
  } else if (polling.outcome === 'failed') {
    // TODO: i18n pending translation key
    statusMessage = 'This payment could not be confirmed.';
  }

  return (
    <PrimeInfiniWaitingStatus isTerminal={isTerminal} message={statusMessage} />
  );
}

function PrimeInfiniWaitingDialogContent({
  context,
}: {
  context: IPrimeInfiniWaitingContext;
}) {
  if (context.checkoutType === 'internalWallet') {
    return <PrimeInfiniInternalWaitingMonitor session={context.session} />;
  }
  return <PrimeInfiniExternalWaitingMonitor context={context} />;
}

// Single-instance semantics: at most one waiting dialog (and thus one poller)
// may exist at a time, otherwise retried purchases would stack dialogs that
// each fire their own success toast and analytics event.
let activeWaitingDialog: IDialogInstance | undefined;

export function showPrimeInfiniWaitingDialog({
  context,
  onClose,
  ...dialogProps
}: IDialogShowProps & {
  context: IPrimeInfiniWaitingContext;
}) {
  void activeWaitingDialog?.close();
  const dialog: IDialogInstance = Dialog.show({
    icon: 'ClockTimeHistoryOutline',
    // TODO: i18n pending translation key
    title: 'Waiting for payment',
    testID: 'prime-infini-waiting-dialog',
    dismissOnOverlayPress: false,
    showFooter: context.checkoutType === 'externalWallet',
    showCancelButton: false,
    showConfirmButton: context.checkoutType === 'externalWallet',
    renderContent: <PrimeInfiniWaitingDialogContent context={context} />,
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

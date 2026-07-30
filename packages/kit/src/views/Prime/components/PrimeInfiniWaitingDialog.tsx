/* cspell:ignore Infini */
import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Illustration,
  LottieView,
  SizableText,
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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IPrimeInfiniPendingPaymentSession,
  IPrimeInfiniPurchaseStatusSnapshot,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { isPrimeInfiniPurchaseCompleted } from '../hooks/primeInfiniPaymentUtils';
import { usePrimeInfiniPaymentPolling } from '../hooks/usePrimeInfiniPaymentPolling';
import { usePrimePurchaseMonitor } from '../hooks/usePrimePurchaseMonitor';
import { showPrimeInfiniPaymentErrorToast } from '../primeInfiniPaymentError';
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
            logPrimeInfiniPaymentFlow({
              stage: 'purchaseCompletion',
              status: 'failed',
              subscriptionPeriod,
              plan,
              featureName,
              checkoutType,
              ...paymentContext,
              reason: 'purchaseSuccessTailFailed',
              error,
            });
            showPrimeInfiniPaymentErrorToast({
              error,
              fallbackMessage: intl.formatMessage({
                id: ETranslations.global_failed,
              }),
            });
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
  title,
  message,
}: {
  isTerminal: boolean;
  title: string;
  message?: string;
}) {
  return (
    <YStack gap="$5" alignItems="center" pt="$4">
      {isTerminal ? (
        <Illustration size={110} name="XMark" />
      ) : (
        // Same waiting animation the Swap pending flow uses.
        <LottieView
          source={require('@onekeyhq/kit/assets/animations/swap_order_pending.json')}
          width={110}
          height={110}
          autoPlay
        />
      )}
      <YStack gap="$2" alignItems="center">
        <SizableText size="$headingLg" textAlign="center">
          {title}
        </SizableText>
        {message ? (
          <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
            {message}
          </SizableText>
        ) : null}
      </YStack>
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
  const intl = useIntl();
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
      if (event.type === 'failed' && event.issue.error) {
        showPrimeInfiniPaymentErrorToast({
          error: event.issue.error,
          fallbackMessage: intl.formatMessage({
            id: ETranslations.global_failed,
          }),
        });
      }
    },
    [featureName, intl, plan],
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
        title={intl.formatMessage({
          id: monitor.isTimedOut
            ? ETranslations.prime_payment_not_confirmed__title
            : ETranslations.prime_waiting_for_payment__title,
        })}
        message={
          monitor.isTimedOut
            ? intl.formatMessage({
                id: ETranslations.prime_payment_not_detected__desc,
              })
            : intl.formatMessage({
                id: ETranslations.prime_complete_payment_in_browser__desc,
              })
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
          })().catch((error) => {
            logPrimeInfiniPaymentFlow({
              stage: 'externalCheckout',
              status: 'failed',
              plan,
              featureName,
              checkoutType: 'externalWallet',
              reason: 'checkoutReopenFailed',
              error,
            });
            showPrimeInfiniPaymentErrorToast({
              error,
              fallbackMessage: intl.formatMessage({
                id: ETranslations.global_failed,
              }),
            });
          });
        }}
      >
        {intl.formatMessage({
          id: ETranslations.prime_open_checkout__action,
        })}
      </Button>
      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        onConfirmText={intl.formatMessage({
          id: ETranslations.prime_payment_completed__action,
        })}
        onConfirm={async ({ preventClose }) => {
          preventClose();
          const refreshResult = await monitor.refresh();
          const issue = monitor.getLastIssue();
          if (refreshResult === 'failed' && issue?.error) {
            showPrimeInfiniPaymentErrorToast({
              error: issue.error,
              fallbackMessage: intl.formatMessage({
                id: ETranslations.global_failed,
              }),
            });
          } else if (
            refreshResult === 'pending' ||
            refreshResult === 'failed'
          ) {
            Toast.message({
              title: intl.formatMessage({
                id: ETranslations.prime_payment_not_confirmed__title,
              }),
              message: intl.formatMessage({
                id: ETranslations.prime_payment_confirming__desc,
              }),
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
  const intl = useIntl();
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
    onIssue: (error) => {
      showPrimeInfiniPaymentErrorToast({
        error,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
    },
  });
  const isTerminal =
    polling.outcome === 'expired' || polling.outcome === 'failed';
  let statusTitle = intl.formatMessage({
    id: ETranslations.prime_payment_confirming__title,
  });
  let statusMessage = intl.formatMessage({
    id: ETranslations.prime_payment_confirming__desc,
  });
  if (polling.outcome === 'expired') {
    statusTitle = intl.formatMessage({
      id: ETranslations.send_the_invoice_has_expired,
    });
    statusMessage = intl.formatMessage({
      id: ETranslations.prime_close_and_try_again__desc,
    });
  } else if (polling.outcome === 'failed') {
    statusTitle = intl.formatMessage({
      id: ETranslations.prime_payment_confirmation_failed__title,
    });
    statusMessage = intl.formatMessage({
      id: ETranslations.prime_close_and_try_again__desc,
    });
  }

  return (
    <PrimeInfiniWaitingStatus
      isTerminal={isTerminal}
      title={statusTitle}
      message={statusMessage}
    />
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
    // The title/illustration live inside the content so the whole dialog reads
    // as one centered status card; only the corner close button stays.
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

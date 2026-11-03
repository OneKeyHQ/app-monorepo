/* cspell:ignore Infini infini */
import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  hasPrimeInfiniPaymentProgressSnapshot,
  mergePrimeInfiniPaymentProgressSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import {
  createPrimeInfiniPaymentValidationError,
  getPrimeInfiniPaymentValidationFailure,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';
import type {
  IPrimeInfiniCheckoutAuthContext,
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPaymentCacheKey,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  logPrimeInfiniPaymentFlow,
  logPrimeInfiniPaymentMonitorEvent,
} from '../primeInfiniPaymentLogger';

import {
  getPrimeInfiniPaymentOutcome,
  hasPrimeInfiniPaymentConfirmingAmount,
  isPrimeInfiniPaymentExplicitlyExpired,
  isPrimeInfiniPaymentExplicitlyFailed,
  isPrimeInfiniPurchaseCompleted,
} from './primeInfiniPaymentUtils';
import { usePrimePurchaseMonitor } from './usePrimePurchaseMonitor';

import type {
  IPrimeInfiniPaymentOutcome,
  IPrimeInfiniPurchaseBaseline,
} from './primeInfiniPaymentUtils';
import type {
  IPrimePurchaseMonitorAdapter,
  IPrimePurchaseMonitorEvent,
} from './usePrimePurchaseMonitor';

const DEFAULT_POLL_INTERVAL_MS = 5000;

type IPollingTerminalOutcome = Extract<
  IPrimeInfiniPaymentOutcome,
  'expired' | 'failed'
>;

type IPrimeInfiniPaymentMonitorData = {
  payment: IPrimeInfiniPayment;
  outcome: IPrimeInfiniPaymentOutcome;
};

function getProcessingFailureReason(reason: string) {
  return reason === 'adapterFailed' ||
    reason === 'successHandlerFailed' ||
    reason === 'terminalHandlerFailed'
    ? 'pollProcessingFailed'
    : reason;
}

export function usePrimeInfiniPaymentPolling({
  flowId,
  payment,
  paymentCacheKey,
  authContext,
  onAuthChanged,
  asset,
  baseline,
  enabled,
  onSuccess,
  onTerminal,
  onIssue,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: {
  flowId?: string;
  payment: IPrimeInfiniPayment | undefined;
  paymentCacheKey?: IPrimeInfiniPaymentCacheKey;
  authContext?: IPrimeInfiniCheckoutAuthContext;
  onAuthChanged?: () => void | Promise<void>;
  asset: IPrimeInfiniPaymentAsset;
  baseline: IPrimeInfiniPurchaseBaseline;
  enabled: boolean;
  onSuccess: (latestPayment: IPrimeInfiniPayment) => void | Promise<void>;
  onTerminal: (outcome: IPollingTerminalOutcome) => void;
  onIssue?: (error: unknown) => void;
  pollIntervalMs?: number;
}) {
  const flowIdRef = useRef(flowId);
  const adapter = useCallback<
    IPrimePurchaseMonitorAdapter<
      IPrimeInfiniPaymentMonitorData,
      IPollingTerminalOutcome
    >
  >(
    async ({ data }) => {
      const frozenPayment = data?.payment ?? payment;
      if (!frozenPayment) {
        return {
          status: 'pending',
          issue: { reason: 'paymentUnavailableOrSnapshotMismatch' },
        };
      }

      if (!paymentCacheKey && !authContext) {
        throw new OneKeyLocalError(
          'Infini payment monitor context is unavailable',
        );
      }
      const isAuthCurrent = async () =>
        !authContext ||
        (authContext.onekeyUserId === baseline.onekeyUserId &&
          (await backgroundApiProxy.servicePrime.isInfiniCheckoutAuthContextCurrent(
            { context: authContext },
          )));
      const stopForAuthChange = async () => {
        await onAuthChanged?.();
        return {
          status: 'terminal' as const,
          reason: 'failed' as const,
          data: { payment: frozenPayment, outcome: 'failed' as const },
        };
      };
      if (!(await isAuthCurrent())) return stopForAuthChange();

      const [paymentResult, purchaseStatusResult] = await Promise.allSettled([
        backgroundApiProxy.servicePrime.apiGetInfiniPayment({
          flowContext: flowIdRef.current
            ? {
                flowId: flowIdRef.current,
                paymentSource: 'polling',
                expectedChain: asset.chain,
                expectedToken: asset.token,
                sessionMode: 'tracking',
                sendStarted: true,
              }
            : undefined,
          paymentId: frozenPayment.paymentId,
          expectedOneKeyUserId: baseline.onekeyUserId ?? '',
          ...(authContext ? { authContext } : {}),
        }),
        backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot({
          expectedOneKeyUserId: baseline.onekeyUserId ?? '',
        }),
      ]);
      if (!(await isAuthCurrent())) return stopForAuthChange();
      const validationFailure =
        paymentResult.status === 'fulfilled'
          ? getPrimeInfiniPaymentValidationFailure({
              payment: paymentResult.value,
              previousPayment: frozenPayment,
              asset,
              validateQuote: false,
            })
          : undefined;
      const paymentRequestSucceeded =
        paymentResult.status === 'fulfilled' && !validationFailure;
      const purchaseStatusRequestSucceeded =
        purchaseStatusResult.status === 'fulfilled';

      let paymentError: unknown;
      if (paymentResult.status === 'rejected') {
        paymentError = paymentResult.reason;
      } else if (validationFailure) {
        paymentError = createPrimeInfiniPaymentValidationError(
          validationFailure,
          {
            expectedChain: asset.chain,
            expectedToken: asset.token,
            actualChain: paymentResult.value.chain,
            actualToken: paymentResult.value.token,
          },
        );
      }
      const purchaseStatusIssue =
        purchaseStatusResult.status === 'rejected'
          ? {
              reason: 'purchaseStatusUnavailable',
              error: purchaseStatusResult.reason,
            }
          : undefined;
      const issue =
        !paymentRequestSucceeded || !purchaseStatusRequestSucceeded
          ? {
              reason: !paymentRequestSucceeded
                ? 'paymentUnavailableOrSnapshotMismatch'
                : 'purchaseStatusUnavailable',
              error: !paymentRequestSucceeded
                ? paymentError
                : purchaseStatusIssue?.error,
              relatedIssues:
                !paymentRequestSucceeded && purchaseStatusIssue
                  ? [purchaseStatusIssue]
                  : undefined,
            }
          : undefined;

      if (!paymentRequestSucceeded) {
        return {
          status: 'pending',
          issue,
        };
      }

      let currentPayment = mergePrimeInfiniPaymentProgressSnapshot({
        previous: frozenPayment,
        latest: paymentResult.value,
      });
      if (
        paymentCacheKey &&
        hasPrimeInfiniPaymentProgressSnapshot(currentPayment) &&
        (currentPayment.hasTransactions !== frozenPayment.hasTransactions ||
          currentPayment.amountConfirmed !== frozenPayment.amountConfirmed ||
          currentPayment.amountConfirming !== frozenPayment.amountConfirming)
      ) {
        const persistedSession =
          await backgroundApiProxy.simpleDb.prime.latchInfiniPendingPaymentSessionProgress(
            {
              onekeyUserId: baseline.onekeyUserId ?? '',
              paymentCacheKey,
              latestPayment: paymentResult.value,
            },
          );
        if (!persistedSession) {
          throw new OneKeyLocalError('Infini payment session changed');
        }
        currentPayment = mergePrimeInfiniPaymentProgressSnapshot({
          previous: persistedSession.payment,
          latest: currentPayment,
        });
      }
      const currentOutcome = getPrimeInfiniPaymentOutcome({
        payment: currentPayment,
      });
      const hasConfirmingAmount =
        hasPrimeInfiniPaymentConfirmingAmount(currentPayment);
      const hasExplicitTerminalStatus =
        isPrimeInfiniPaymentExplicitlyExpired(currentPayment) ||
        isPrimeInfiniPaymentExplicitlyFailed(currentPayment);
      const effectiveOutcome =
        currentOutcome === 'expired' &&
        (currentPayment.hasTransactions ||
          (!hasExplicitTerminalStatus && hasConfirmingAmount))
          ? 'pending'
          : currentOutcome;
      const nextData = {
        payment: currentPayment,
        outcome: effectiveOutcome,
      };
      const purchaseCompleted = isPrimeInfiniPurchaseCompleted({
        baseline,
        primeSubscription: purchaseStatusRequestSucceeded
          ? purchaseStatusResult.value.primeSubscription
          : undefined,
        infiniSubscription: purchaseStatusRequestSucceeded
          ? purchaseStatusResult.value.infiniSubscription
          : undefined,
      });

      if (currentOutcome === 'confirmed' && purchaseCompleted) {
        return {
          status: 'succeeded',
          data: nextData,
          issue,
        };
      }
      if (effectiveOutcome === 'expired' || effectiveOutcome === 'failed') {
        return {
          status: 'terminal',
          reason: effectiveOutcome,
          data: nextData,
          issue,
        };
      }
      return {
        status: 'pending',
        data: nextData,
        issue,
      };
    },
    [asset, authContext, baseline, onAuthChanged, payment, paymentCacheKey],
  );

  const handleSuccess = useCallback(
    async (data: IPrimeInfiniPaymentMonitorData | undefined) => {
      if (!data) {
        throw new OneKeyLocalError(
          'Infini payment monitor data is unavailable',
        );
      }
      logPrimeInfiniPaymentFlow({
        flowId: flowIdRef.current,
        paymentSource: 'polling',
        stage: 'paymentPolling',
        status: 'succeeded',
        checkoutType: 'internalWallet',
        paymentId: data.payment.paymentId,
        networkId: asset.networkId,
        tokenSymbol: asset.token,
        amountDue: data.payment.amountDue,
        sendStarted: true,
        reason: 'paymentConfirmedAndSubscriptionActive',
      });
      await onSuccess(data.payment);
    },
    [asset.networkId, asset.token, onSuccess],
  );

  const handleTerminal = useCallback(
    (
      terminalOutcome: IPollingTerminalOutcome,
      data: IPrimeInfiniPaymentMonitorData | undefined,
    ) => {
      if (!data) {
        throw new OneKeyLocalError(
          'Infini payment monitor data is unavailable',
        );
      }
      logPrimeInfiniPaymentFlow({
        flowId: flowIdRef.current,
        paymentSource: 'polling',
        stage: 'paymentPolling',
        status: terminalOutcome,
        checkoutType: 'internalWallet',
        paymentId: data.payment.paymentId,
        networkId: asset.networkId,
        tokenSymbol: asset.token,
        amountDue: data.payment.amountDue,
        sendStarted: true,
      });
      onTerminal(terminalOutcome);
    },
    [asset.networkId, asset.token, onTerminal],
  );

  const handleMonitorEvent = useCallback(
    (event: IPrimePurchaseMonitorEvent<IPrimeInfiniPaymentMonitorData>) => {
      const currentPayment = event.data?.payment ?? payment;
      if (!currentPayment) {
        return;
      }
      logPrimeInfiniPaymentMonitorEvent({
        event,
        context: {
          flowId: flowIdRef.current,
          paymentSource: 'polling',
          stage: 'polling',
          checkoutType: 'internalWallet',
          paymentId: currentPayment.paymentId,
          networkId: asset.networkId,
          tokenSymbol: asset.token,
          amountDue: currentPayment.amountDue,
          sendStarted: true,
        },
        getFailureReason: getProcessingFailureReason,
      });
      if (event.type === 'failed' && event.issue.error) {
        onIssue?.(event.issue.error);
      }
    },
    [asset.networkId, asset.token, onIssue, payment],
  );

  const sessionKey = [
    paymentCacheKey?.bindingId ?? 'remote',
    authContext?.authSessionSource ?? '',
    authContext?.authStateGeneration ?? '',
    payment?.paymentId ?? '',
    asset.key,
    asset.networkId,
    asset.token,
    baseline.onekeyUserId ?? '',
    baseline.wasPrimeActive ? 'active' : 'inactive',
    baseline.primeExpiresAt ?? '',
    baseline.infiniPeriodEnd ?? '',
    baseline.infiniSubscriptionId === undefined
      ? 'legacy'
      : (baseline.infiniSubscriptionId ?? 'none'),
  ].join(':');
  const monitor = usePrimePurchaseMonitor<
    IPrimeInfiniPaymentMonitorData,
    IPollingTerminalOutcome
  >({
    sessionKey,
    initialData: payment
      ? {
          payment,
          outcome: getPrimeInfiniPaymentOutcome({ payment }),
        }
      : undefined,
    enabled: enabled && Boolean(payment),
    adapter,
    onSuccess: handleSuccess,
    onTerminal: handleTerminal,
    onEvent: handleMonitorEvent,
    pollIntervalMs,
  });

  const monitorRefresh = monitor.refresh;
  const refresh = useCallback(() => {
    void monitorRefresh();
  }, [monitorRefresh]);

  return {
    latestPayment: monitor.data?.payment,
    outcome: monitor.data?.outcome ?? 'pending',
    isPolling: monitor.isPolling,
    hasError: monitor.hasError,
    refresh,
  };
}

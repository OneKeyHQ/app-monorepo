/* cspell:ignore Infini infini */
import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  isPrimeInfiniPaymentForAssetSnapshot,
  isSamePrimeInfiniPaymentTransferSnapshot,
  mergePrimeInfiniPaymentProgressSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { logPrimeInfiniPaymentFlow } from '../primeInfiniPaymentLogger';

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
  payment,
  asset,
  baseline,
  enabled,
  onSuccess,
  onTerminal,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: {
  payment: IPrimeInfiniPayment | undefined;
  asset: IPrimeInfiniPaymentAsset;
  baseline: IPrimeInfiniPurchaseBaseline;
  enabled: boolean;
  onSuccess: (latestPayment: IPrimeInfiniPayment) => void | Promise<void>;
  onTerminal: (outcome: IPollingTerminalOutcome) => void;
  pollIntervalMs?: number;
}) {
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

      const [paymentResult, purchaseStatusResult] = await Promise.allSettled([
        backgroundApiProxy.servicePrime.apiGetInfiniPayment({
          paymentId: frozenPayment.paymentId,
          expectedOneKeyUserId: baseline.onekeyUserId ?? '',
        }),
        backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot({
          expectedOneKeyUserId: baseline.onekeyUserId ?? '',
        }),
      ]);
      const paymentRequestSucceeded =
        paymentResult.status === 'fulfilled' &&
        isSamePrimeInfiniPaymentTransferSnapshot({
          first: frozenPayment,
          second: paymentResult.value,
          networkId: asset.networkId,
        }) &&
        isPrimeInfiniPaymentForAssetSnapshot({
          payment: paymentResult.value,
          asset,
        });
      const purchaseStatusRequestSucceeded =
        purchaseStatusResult.status === 'fulfilled';

      let rejectedReason: unknown;
      if (paymentResult.status === 'rejected') {
        rejectedReason = paymentResult.reason;
      } else if (purchaseStatusResult.status === 'rejected') {
        rejectedReason = purchaseStatusResult.reason;
      }
      const issue =
        !paymentRequestSucceeded || !purchaseStatusRequestSucceeded
          ? {
              reason: !paymentRequestSucceeded
                ? 'paymentUnavailableOrSnapshotMismatch'
                : 'purchaseStatusUnavailable',
              error: rejectedReason,
            }
          : undefined;

      if (!paymentRequestSucceeded) {
        return {
          status: 'pending',
          issue,
        };
      }

      const currentPayment = mergePrimeInfiniPaymentProgressSnapshot({
        previous: frozenPayment,
        latest: paymentResult.value,
      });
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
        !hasExplicitTerminalStatus &&
        hasConfirmingAmount
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
    [asset, baseline, payment],
  );

  const handleSuccess = useCallback(
    async (data: IPrimeInfiniPaymentMonitorData | undefined) => {
      if (!data) {
        throw new OneKeyLocalError(
          'Infini payment monitor data is unavailable',
        );
      }
      logPrimeInfiniPaymentFlow({
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
      const context = {
        stage: 'paymentPolling' as const,
        checkoutType: 'internalWallet' as const,
        paymentId: currentPayment.paymentId,
        networkId: asset.networkId,
        tokenSymbol: asset.token,
        amountDue: currentPayment.amountDue,
        sendStarted: true,
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
          reason: getProcessingFailureReason(event.issue.reason),
          error: event.issue.error,
        });
      } else if (event.type === 'recovered') {
        logPrimeInfiniPaymentFlow({
          ...context,
          status: 'recovered',
          retryCount: event.retryCount,
        });
      }
    },
    [asset.networkId, asset.token, payment],
  );

  const sessionKey = [
    payment?.paymentId ?? '',
    asset.key,
    asset.networkId,
    asset.token,
    baseline.onekeyUserId ?? '',
    baseline.wasPrimeActive ? 'active' : 'inactive',
    baseline.primeExpiresAt ?? '',
    baseline.infiniPeriodEnd ?? '',
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

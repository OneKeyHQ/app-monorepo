import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  LottieView,
  SizableText,
  Toast,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  PRIME_WEB_CHECKOUT_WAITING_TIMEOUT_MS,
  checkPrimeWebCheckout,
  finishPrimeWebCheckoutSuccess,
  isPrimeWebCheckoutUserCurrent,
  logPrimeWebCheckoutSessionFlow,
  markPrimeWebCheckoutMonitored,
  openPrimeWebCheckoutPage,
  settlePrimeWebCheckout,
  showPrimeWebCheckoutSuccessToast,
} from '../hooks/primeWebCheckout';
import { usePrimePurchaseMonitor } from '../hooks/usePrimePurchaseMonitor';

import type { IPrimeWebCheckoutResult } from '../hooks/primeWebCheckoutResult';
import type {
  IPrimePurchaseMonitorAdapter,
  IPrimePurchaseMonitorEvent,
} from '../hooks/usePrimePurchaseMonitor';

const POLL_INTERVAL_MS = 5000;

type IPrimeWebCheckoutTerminalReason =
  | 'activatedElsewhere'
  | 'purchaseUserChanged'
  // Settled by another surface, or replaced by a newer checkout.
  | 'sessionClosed';

function PrimeWebCheckoutWaitingMonitor({
  session,
}: {
  session: IPrimeWebCheckoutPendingSession;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();

  useEffect(
    () => markPrimeWebCheckoutMonitored(session.checkoutId),
    [session.checkoutId],
  );

  const adapter = useCallback<
    IPrimePurchaseMonitorAdapter<
      IPrimeWebCheckoutResult,
      IPrimeWebCheckoutTerminalReason
    >
  >(async () => {
    if (!(await isPrimeWebCheckoutUserCurrent(session.onekeyUserId))) {
      return { status: 'terminal', reason: 'purchaseUserChanged' };
    }
    const currentSession =
      await backgroundApiProxy.simpleDb.prime.getWebCheckoutPendingSession({
        onekeyUserId: session.onekeyUserId,
      });
    if (currentSession?.checkoutId !== session.checkoutId) {
      return { status: 'terminal', reason: 'sessionClosed' };
    }
    try {
      const result = await checkPrimeWebCheckout(session);
      if (result.status === 'pending') {
        return { status: 'pending', data: result };
      }
      if (result.status === 'succeeded') {
        return { status: 'succeeded', data: result };
      }
      return { status: 'terminal', reason: 'activatedElsewhere', data: result };
    } catch (error) {
      return {
        status: 'pending',
        issue: { reason: 'purchaseStatusUnavailable', error },
      };
    }
  }, [session]);

  const handleSuccess = useCallback(
    async (result: IPrimeWebCheckoutResult | undefined) => {
      if (result?.status !== 'succeeded') {
        return;
      }
      const settlement = await settlePrimeWebCheckout({
        session,
        result,
        intl,
      });
      if (settlement?.outcome === 'succeeded') {
        showPrimeWebCheckoutSuccessToast(intl);
      }
      await dialogInstance.close();
      if (settlement?.outcome !== 'succeeded') {
        return;
      }
      // Let the dialog close animation finish before the post-purchase
      // success surfaces (e.g. the KYT intro) mount.
      await timerUtils.wait(350);
      await finishPrimeWebCheckoutSuccess(settlement.successPayload);
    },
    [dialogInstance, intl, session],
  );

  const handleTerminal = useCallback(
    async (
      reason: IPrimeWebCheckoutTerminalReason,
      result: IPrimeWebCheckoutResult | undefined,
    ) => {
      if (
        reason === 'activatedElsewhere' &&
        result &&
        result.status !== 'pending'
      ) {
        await settlePrimeWebCheckout({ session, result, intl });
      } else {
        logPrimeWebCheckoutSessionFlow({
          session,
          stage: 'polling',
          status: 'cancelled',
          reason,
        });
      }
      await dialogInstance.close();
    },
    [dialogInstance, intl, session],
  );

  const handleMonitorEvent = useCallback(
    (event: IPrimePurchaseMonitorEvent<IPrimeWebCheckoutResult>) => {
      if (event.type === 'timedOut') {
        logPrimeWebCheckoutSessionFlow({
          session,
          stage: 'polling',
          status: 'timedOut',
        });
      } else if (event.type === 'failed') {
        logPrimeWebCheckoutSessionFlow({
          session,
          stage: 'polling',
          status: 'failed',
          reason: event.issue.reason,
        });
      }
    },
    [session],
  );

  const monitor = usePrimePurchaseMonitor<
    IPrimeWebCheckoutResult,
    IPrimeWebCheckoutTerminalReason
  >({
    sessionKey: session.checkoutId,
    enabled: true,
    adapter,
    onSuccess: handleSuccess,
    onTerminal: handleTerminal,
    onEvent: handleMonitorEvent,
    pollIntervalMs: POLL_INTERVAL_MS,
    timeoutMs: PRIME_WEB_CHECKOUT_WAITING_TIMEOUT_MS,
  });
  const refreshRef = useRef(monitor.refresh);
  refreshRef.current = monitor.refresh;

  useEffect(() => {
    // The extension background relays the hosted page's return. Side panels
    // keep no focus when the checkout tab closes, so poll right away.
    const onReturned = ({ checkoutId }: { checkoutId: string }) => {
      if (checkoutId !== session.checkoutId) {
        return;
      }
      logPrimeWebCheckoutSessionFlow({
        session,
        stage: 'return',
        status: 'succeeded',
      });
      void refreshRef.current();
    };
    const onIdentityCommitted = () => {
      void refreshRef.current();
    };
    appEventBus.on(EAppEventBusNames.PrimeWebCheckoutReturned, onReturned);
    appEventBus.on(
      EAppEventBusNames.IdentityLifecycleCommitted,
      onIdentityCommitted,
    );
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeWebCheckoutReturned, onReturned);
      appEventBus.off(
        EAppEventBusNames.IdentityLifecycleCommitted,
        onIdentityCommitted,
      );
    };
  }, [session]);

  const reopenCheckout = useCallback(async () => {
    logPrimeWebCheckoutSessionFlow({
      session,
      stage: 'reopen',
      status: 'started',
    });
    try {
      // The stored session carries the latest checkout tab id.
      const currentSession =
        await backgroundApiProxy.simpleDb.prime.getWebCheckoutPendingSession({
          onekeyUserId: session.onekeyUserId,
        });
      if (
        currentSession?.checkoutId !== session.checkoutId ||
        !(await isPrimeWebCheckoutUserCurrent(session.onekeyUserId))
      ) {
        await dialogInstance.close();
        return;
      }
      await openPrimeWebCheckoutPage(currentSession);
    } catch (error) {
      logPrimeWebCheckoutSessionFlow({
        session,
        stage: 'reopen',
        status: 'failed',
      });
      errorToastUtils.toastIfError(error);
    }
  }, [dialogInstance, session]);

  return (
    <YStack gap="$4" alignItems="center">
      <YStack gap="$5" alignItems="center" pt="$4">
        <LottieView
          source={require('@onekeyhq/kit/assets/animations/swap_order_pending.json')}
          width={110}
          height={110}
          autoPlay
        />
        <YStack gap="$2" alignItems="center">
          <SizableText size="$headingLg" textAlign="center">
            {intl.formatMessage({
              id: monitor.isTimedOut
                ? ETranslations.prime_payment_not_confirmed__title
                : ETranslations.prime_waiting_for_payment__title,
            })}
          </SizableText>
          <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
            {intl.formatMessage({
              id: monitor.isTimedOut
                ? ETranslations.prime_payment_not_detected__desc
                : ETranslations.prime_complete_payment_in_browser__desc,
            })}
          </SizableText>
        </YStack>
      </YStack>
      <Button
        size="small"
        variant="secondary"
        icon="ArrowTopRightOutline"
        testID="prime-web-checkout-open-checkout"
        onPress={() => {
          void reopenCheckout();
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
            errorToastUtils.toastIfError(issue.error);
          } else if (
            refreshResult === 'pending' ||
            refreshResult === 'failed'
          ) {
            Toast.message({
              title: intl.formatMessage({
                id: ETranslations.prime_payment_not_confirmed__title,
              }),
              message: intl.formatMessage({
                id: ETranslations.prime_payment_not_detected__desc,
              }),
            });
          }
        }}
      />
    </YStack>
  );
}

// Single instance: one waiting dialog (and one poller) per runtime, so a
// retried checkout cannot stack dialogs that each report success.
let activeWaitingDialog: IDialogInstance | undefined;

export function showPrimeWebCheckoutWaitingDialog({
  session,
}: {
  session: IPrimeWebCheckoutPendingSession;
}) {
  void activeWaitingDialog?.close();
  const dialog: IDialogInstance = Dialog.show({
    testID: 'prime-web-checkout-waiting-dialog',
    dismissOnOverlayPress: false,
    showFooter: true,
    showCancelButton: false,
    showConfirmButton: true,
    renderContent: <PrimeWebCheckoutWaitingMonitor session={session} />,
    onClose: async () => {
      if (activeWaitingDialog === dialog) {
        activeWaitingDialog = undefined;
      }
    },
  });
  activeWaitingDialog = dialog;
  return dialog;
}

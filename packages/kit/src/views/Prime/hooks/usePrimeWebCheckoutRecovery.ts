import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  checkPrimeWebCheckout,
  finishPrimeWebCheckoutSuccess,
  getPrimeWebCheckoutPlatform,
  isPrimeWebCheckoutMonitored,
  isPrimeWebCheckoutUserCurrent,
  logPrimeWebCheckoutSessionFlow,
  settlePrimeWebCheckout,
  showPrimeWebCheckoutSuccessToast,
} from './primeWebCheckout';

const RECOVERY_MIN_INTERVAL_MS = 15_000;

// On return, only the surface that opened the checkout reacts at once, so
// the result shows where the user is looking. A re-focused tab also gets a
// visibility event; a side panel does not, hence the return event.
function isCheckoutInitiatorSurface(session: IPrimeWebCheckoutPendingSession) {
  if (!platformEnv.isExtension) {
    return true;
  }
  return platformEnv.isExtensionUiSidePanel
    ? session.extension?.initiatorKind === 'sidePanel'
    : session.extension?.initiatorKind === 'tab';
}

// Settles a hosted card checkout whose waiting dialog is gone (closed by the
// user, or the page that opened it was closed), whenever the app becomes
// visible. Only reads SimpleDB unless a pending checkout exists.
export function usePrimeWebCheckoutRecovery({
  enabled,
  onekeyUserId,
}: {
  enabled: boolean;
  onekeyUserId: string | undefined;
}) {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;

  useEffect(() => {
    if (!enabled || !onekeyUserId) {
      return undefined;
    }
    let cancelled = false;
    let isChecking = false;
    let lastCheckedAt = 0;

    const recover = async ({
      fromReturnEvent = false,
    }: {
      fromReturnEvent?: boolean;
    } = {}) => {
      const now = Date.now();
      if (
        isChecking ||
        (!fromReturnEvent && now - lastCheckedAt < RECOVERY_MIN_INTERVAL_MS)
      ) {
        return;
      }
      isChecking = true;
      lastCheckedAt = now;
      try {
        const session =
          await backgroundApiProxy.simpleDb.prime.getWebCheckoutPendingSession({
            onekeyUserId,
          });
        if (
          cancelled ||
          !session ||
          session.platform !== getPrimeWebCheckoutPlatform() ||
          isPrimeWebCheckoutMonitored(session.checkoutId) ||
          (fromReturnEvent && !isCheckoutInitiatorSurface(session)) ||
          !(await isPrimeWebCheckoutUserCurrent(onekeyUserId))
        ) {
          return;
        }
        try {
          const result = await checkPrimeWebCheckout(session);
          if (cancelled || result.status === 'pending') {
            return;
          }
          const settlement = await settlePrimeWebCheckout({
            session,
            result,
            intl: intlRef.current,
          });
          if (settlement?.outcome === 'succeeded') {
            logPrimeWebCheckoutSessionFlow({
              session,
              stage: 'recovery',
              status: 'succeeded',
            });
            showPrimeWebCheckoutSuccessToast(intlRef.current);
            await finishPrimeWebCheckoutSuccess(settlement.successPayload);
          }
        } catch {
          logPrimeWebCheckoutSessionFlow({
            session,
            stage: 'recovery',
            status: 'failed',
          });
        }
      } catch {
        // Reading the pending checkout is best-effort; retry on next visibility.
      } finally {
        isChecking = false;
      }
    };

    if (getCurrentVisibilityState()) {
      void recover();
    }
    const offVisibility = onVisibilityStateChange((visible) => {
      if (visible) {
        void recover();
      }
    });
    const onReturned = () => {
      void recover({ fromReturnEvent: true });
    };
    appEventBus.on(EAppEventBusNames.PrimeWebCheckoutReturned, onReturned);
    return () => {
      cancelled = true;
      offVisibility();
      appEventBus.off(EAppEventBusNames.PrimeWebCheckoutReturned, onReturned);
    };
  }, [enabled, onekeyUserId]);
}

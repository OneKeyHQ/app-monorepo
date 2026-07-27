import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { formatUnifoldUsdAmount } from '@onekeyhq/shared/src/utils/unifoldDepositUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

const DELIVERY_RETRY_BUFFER_MS = 50;
const DELIVERY_ERROR_RETRY_MS = 1000;
const DELIVERY_ACK_FAST_RETRY_ATTEMPTS = 5;
const DELIVERY_ACK_MAX_RETRY_MS = 60_000;

function getDeliveryAckRetryMs(acknowledgementAttempts: number) {
  const exponentialRetryCount = Math.max(
    0,
    acknowledgementAttempts - DELIVERY_ACK_FAST_RETRY_ATTEMPTS + 1,
  );
  return Math.min(
    DELIVERY_ERROR_RETRY_MS *
      2 **
        Math.min(exponentialRetryCount, DELIVERY_ACK_FAST_RETRY_ATTEMPTS + 1),
    DELIVERY_ACK_MAX_RETRY_MS,
  );
}

type IPresentedClaim = {
  claimId: string;
  acknowledgementAttempts: number;
};

export function PerpsUnifoldDepositTerminalDeliveryContainer() {
  const intl = useIntl();

  useEffect(() => {
    let disposed = false;
    const inFlight = new Set<string>();
    const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const presentedClaims = new Map<string, IPresentedClaim>();

    const clearRetry = (deliveryId: string) => {
      const timer = retryTimers.get(deliveryId);
      if (timer) {
        clearTimeout(timer);
        retryTimers.delete(deliveryId);
      }
    };

    const acknowledge = async (
      deliveryId: string,
      presentedClaim: IPresentedClaim,
    ): Promise<number | undefined> => {
      const attemptedClaim = {
        ...presentedClaim,
        acknowledgementAttempts: presentedClaim.acknowledgementAttempts + 1,
      };
      presentedClaims.set(deliveryId, attemptedClaim);
      const result =
        await backgroundApiProxy.serviceUnifoldDeposit.acknowledgeTerminalDelivery(
          {
            deliveryId,
            claimId: attemptedClaim.claimId,
          },
        );
      if (result.updated) {
        presentedClaims.delete(deliveryId);
        return undefined;
      }
      if (result.reason === 'gone' || result.reason === 'claimLost') {
        presentedClaims.delete(deliveryId);
        return undefined;
      }
      return getDeliveryAckRetryMs(attemptedClaim.acknowledgementAttempts);
    };

    const present = async (deliveryId: string) => {
      if (disposed || inFlight.has(deliveryId)) {
        return;
      }
      inFlight.add(deliveryId);
      clearRetry(deliveryId);
      let retryAfterMs: number | undefined;
      try {
        const presentedClaim = presentedClaims.get(deliveryId);
        if (presentedClaim) {
          retryAfterMs = await acknowledge(deliveryId, presentedClaim);
          return;
        }

        const claimId = generateUUID();
        const claim =
          await backgroundApiProxy.serviceUnifoldDeposit.tryClaimTerminalDelivery(
            {
              deliveryId,
              claimId,
            },
          );
        if (disposed || claim.status === 'unavailable') {
          return;
        }
        if (claim.status === 'claimedByOther') {
          retryAfterMs = claim.retryAfterMs;
          return;
        }

        const { delivery } = claim;
        const succeeded = delivery.execution.status === 'succeeded';
        let message: string | undefined;
        if (succeeded) {
          message = formatUnifoldUsdAmount(
            delivery.execution.destinationAmountUsd ??
              delivery.execution.sourceAmountUsd,
          );
        } else if (delivery.sessionId) {
          message = intl.formatMessage(
            {
              id: ETranslations.perp_unifold_contact_support_ref__desc,
            },
            { ref: delivery.sessionId },
          );
        }
        Toast[succeeded ? 'success' : 'error']({
          toastId: delivery.deliveryId,
          title: intl.formatMessage({
            id: succeeded
              ? ETranslations.perp_deposit_success_title
              : ETranslations.perp_deposit_fail_title,
          }),
          message,
        });
        const newPresentedClaim = {
          claimId,
          acknowledgementAttempts: 0,
        };
        presentedClaims.set(deliveryId, newPresentedClaim);
        retryAfterMs = await acknowledge(deliveryId, newPresentedClaim);
      } catch (error) {
        errorUtils.autoPrintErrorIgnore(error);
        const presentedClaim = presentedClaims.get(deliveryId);
        retryAfterMs = presentedClaim
          ? getDeliveryAckRetryMs(presentedClaim.acknowledgementAttempts)
          : DELIVERY_ERROR_RETRY_MS;
      } finally {
        inFlight.delete(deliveryId);
        if (!disposed && retryAfterMs !== undefined) {
          const timer = setTimeout(
            () => {
              retryTimers.delete(deliveryId);
              void present(deliveryId);
            },
            Math.max(0, retryAfterMs) + DELIVERY_RETRY_BUFFER_MS,
          );
          retryTimers.set(deliveryId, timer);
        }
      }
    };

    const handleDelivery = ({ deliveryId }: { deliveryId: string }) => {
      void present(deliveryId);
    };
    appEventBus.on(
      EAppEventBusNames.PerpsUnifoldDepositTerminalDelivery,
      handleDelivery,
    );
    void backgroundApiProxy.serviceUnifoldDeposit
      .getPendingTerminalDeliveries()
      .then((deliveries) => {
        deliveries.forEach(({ deliveryId }) => {
          void present(deliveryId);
        });
      })
      .catch((error) => {
        errorUtils.autoPrintErrorIgnore(error);
      });

    return () => {
      disposed = true;
      appEventBus.off(
        EAppEventBusNames.PerpsUnifoldDepositTerminalDelivery,
        handleDelivery,
      );
      retryTimers.forEach((timer) => clearTimeout(timer));
      retryTimers.clear();
      presentedClaims.clear();
    };
  }, [intl]);

  return null;
}

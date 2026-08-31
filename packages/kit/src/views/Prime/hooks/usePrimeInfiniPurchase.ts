/* cspell:ignore Infini */
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type {
  EPrimeFeatures,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeInfiniSubscriptionPlan } from '@onekeyhq/shared/types/prime/primeTypes';

import { showPrimeInfiniWaitingDialog } from '../components/PrimeInfiniWaitingDialog';
import { logPrimeInfiniPaymentFlow } from '../primeInfiniPaymentLogger';

import { getPrimeInfiniExternalCheckoutGuard } from './primeInfiniExternalCheckoutGuard';

import type { ISubscriptionPeriod } from './usePrimePaymentTypes';

// Module-level so every hook/page instance in the App runtime shares the same
// guard. It spans prepared-payment retirement and hosted-checkout creation, so
// another internal or external attempt cannot claim the same user in between.
let isExternalCheckoutInFlight = false;
let isWalletPaymentPageOpening = false;
const PRIME_WAITING_DIALOG_OPEN_DELAY_MS = 300;

export function isPrimeInfiniExternalCheckoutInFlight() {
  return isExternalCheckoutInFlight;
}

async function ensurePrimeLoggedIn(
  intl: ReturnType<typeof useIntl>,
): Promise<boolean> {
  const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
  if (!isLoggedIn) {
    Toast.error({
      title: intl.formatMessage({
        id: ETranslations.prime_not_logged_in_description,
      }),
    });
  }
  return isLoggedIn;
}

export function usePrimeInfiniPurchase() {
  const intl = useIntl();
  const navigation = useAppNavigation<IPageNavigationProp<IPrimeParamList>>();

  const purchaseByExternalCheckout = useCallback(
    async ({
      flowId = generateUUID(),
      selectedSubscriptionPeriod,
      featureName,
      beforeCheckout,
      beforeOpenCheckout,
    }: {
      flowId?: string;
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
      beforeCheckout?: () => Promise<boolean>;
      beforeOpenCheckout?: () => Promise<void>;
    }) => {
      const plan: IPrimeInfiniSubscriptionPlan =
        selectedSubscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly';
      if (isExternalCheckoutInFlight || isWalletPaymentPageOpening) {
        logPrimeInfiniPaymentFlow({
          flowId,
          stage: 'externalCheckout',
          status: 'blocked',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'externalWallet',
          reason: 'anotherCheckoutInProgress',
        });
        return false;
      }
      isExternalCheckoutInFlight = true;
      logPrimeInfiniPaymentFlow({
        flowId,
        stage: 'externalCheckout',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'externalWallet',
      });
      try {
        // Defensive check only: the purchase dialog flows already run
        // ensureOneKeyIDLoggedIn (usePrimeRequirements) before reaching here.
        // Calling usePrimeRequirements directly would create a circular import
        // with PrimePurchaseDialog, so the login state is verified via bg service.
        if (!(await ensurePrimeLoggedIn(intl))) {
          logPrimeInfiniPaymentFlow({
            flowId,
            stage: 'externalCheckout',
            status: 'blocked',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'externalWallet',
            reason: 'notLoggedIn',
          });
          return false;
        }
        if (beforeCheckout && !(await beforeCheckout())) {
          logPrimeInfiniPaymentFlow({
            flowId,
            stage: 'externalCheckout',
            status: 'cancelled',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'externalWallet',
            reason: 'preparedPaymentNotRetired',
          });
          return false;
        }
        const checkoutGuard = await getPrimeInfiniExternalCheckoutGuard();
        if (!checkoutGuard.isLoggedIn) {
          return false;
        }
        if (checkoutGuard.hasPendingPayment) {
          Toast.message({
            title: intl.formatMessage({ id: ETranslations.global_processing }),
          });
          throw new OneKeyLocalError({
            message: 'An Infini wallet payment is already active',
            autoToast: false,
          });
        }
        const purchaserUserId = checkoutGuard.onekeyUserId;
        if (!purchaserUserId) {
          return false;
        }

        // Capture both subscription channels under one pinned auth snapshot.
        // Combining independent requests could pair results from different
        // sessions during an A -> B -> A auth transition.
        const baselineSnapshot =
          await backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot(
            {
              expectedOneKeyUserId: purchaserUserId,
            },
          );
        if (baselineSnapshot.onekeyUserId !== purchaserUserId) {
          throw new OneKeyLocalError({
            message: 'Infini checkout context changed before creation',
          });
        }
        const baselinePrimeSubscription = baselineSnapshot.primeSubscription;
        if (baselinePrimeSubscription?.isActive) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.prime_already_active__msg,
            }),
          });
          logPrimeInfiniPaymentFlow({
            flowId,
            stage: 'externalCheckout',
            status: 'blocked',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'externalWallet',
            reason: 'primeAlreadyActive',
          });
          return false;
        }
        defaultLogger.prime.subscription.primeSubscribeIntent({
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          currency: 'USD',
          paymentMethod: 'crypto',
        });
        const checkoutResult =
          await backgroundApiProxy.servicePrime.apiGetInfiniCheckoutUrl({
            flowContext: { flowId, paymentSource: 'externalCheckout' },
            plan,
            expectedOneKeyUserId: purchaserUserId,
          });
        const postCreateGuard = await getPrimeInfiniExternalCheckoutGuard();
        if (
          !postCreateGuard?.isLoggedIn ||
          postCreateGuard.onekeyUserId !== purchaserUserId ||
          postCreateGuard.hasPendingPayment
        ) {
          throw new OneKeyLocalError({
            message: 'Infini checkout context changed before opening',
          });
        }
        const checkoutUrl = checkoutResult?.checkoutUrl;
        if (!checkoutUrl) {
          // Guards the unconfirmed backend response schema: a 200 response
          // with an unexpected field name must not become a silent dead end
          // (plan §9 requires a toast on checkout creation failure). The
          // caller preserves this message in its payment error toast.
          throw new OneKeyLocalError({
            message: 'Infini checkout url is empty',
          });
        }

        await beforeOpenCheckout?.();

        // The checkout URL is part of the external monitor session identity,
        // so a new hosted checkout cannot reuse an older monitor generation.
        showPrimeInfiniWaitingDialog({
          context: {
            flowId,
            checkoutType: 'externalWallet',
            plan,
            onekeyUserId: purchaserUserId,
            featureName,
            checkoutUrl,
          },
        });
        // Keep the waiting state visible before handing control to the system
        // browser. The shared modal transition takes 250 ms.
        await timerUtils.setTimeoutPromised(
          undefined,
          PRIME_WAITING_DIALOG_OPEN_DELAY_MS,
        );

        // Open the hosted checkout in the external system browser on all
        // supported platforms (see integration plan §8): Binance Pay and
        // wallet-app deep links are unreliable inside the in-app browser
        openUrlUtils.openUrlExternal(checkoutUrl, { useSystemBrowser: true });
        logPrimeInfiniPaymentFlow({
          flowId,
          stage: 'externalCheckout',
          status: 'succeeded',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'externalWallet',
          reason: 'checkoutOpened',
        });
        return true;
      } catch (error) {
        logPrimeInfiniPaymentFlow({
          flowId,
          stage: 'externalCheckout',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'externalWallet',
          reason: 'checkoutCreationOrOpenFailed',
          error,
        });
        throw error;
      } finally {
        isExternalCheckoutInFlight = false;
      }
    },
    [intl],
  );

  const purchaseByCrypto = useCallback(
    async ({
      selectedSubscriptionPeriod,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
    }) => {
      const flowId = generateUUID();
      const plan: IPrimeInfiniSubscriptionPlan =
        selectedSubscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly';
      if (isWalletPaymentPageOpening || isExternalCheckoutInFlight) {
        logPrimeInfiniPaymentFlow({
          flowId,
          stage: 'walletPaymentPage',
          status: 'blocked',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          reason: 'anotherCheckoutInProgress',
        });
        return;
      }
      isWalletPaymentPageOpening = true;
      logPrimeInfiniPaymentFlow({
        flowId,
        stage: 'walletPaymentPage',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
      });
      try {
        if (!(await ensurePrimeLoggedIn(intl))) {
          logPrimeInfiniPaymentFlow({
            flowId,
            stage: 'walletPaymentPage',
            status: 'blocked',
            subscriptionPeriod: selectedSubscriptionPeriod,
            featureName,
            plan,
            checkoutType: 'internalWallet',
            reason: 'notLoggedIn',
          });
          return;
        }
        navigation.pushModal(EModalRoutes.PrimeModal, {
          screen: EPrimePages.PrimeInfiniPayment,
          params: {
            flowId,
            selectedSubscriptionPeriod,
            featureName,
            createNewPayment: true,
          },
        });
        logPrimeInfiniPaymentFlow({
          flowId,
          stage: 'walletPaymentPage',
          status: 'succeeded',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
        });
      } catch (error) {
        logPrimeInfiniPaymentFlow({
          flowId,
          stage: 'walletPaymentPage',
          status: 'failed',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
          error,
        });
        throw error;
      } finally {
        isWalletPaymentPageOpening = false;
      }
    },
    [intl, navigation],
  );

  return { purchaseByCrypto, purchaseByExternalCheckout };
}

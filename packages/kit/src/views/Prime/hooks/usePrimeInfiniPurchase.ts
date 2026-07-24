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
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
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

export function isPrimeInfiniExternalCheckoutInFlight() {
  return isExternalCheckoutInFlight;
}

async function ensurePrimeLoggedIn() {
  const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
  if (!isLoggedIn) {
    Toast.error({
      // TODO: i18n pending translation key
      title: 'Please log in to your OneKey ID first',
    });
  }
  return isLoggedIn;
}

export function usePrimeInfiniPurchase() {
  const intl = useIntl();
  const navigation = useAppNavigation<IPageNavigationProp<IPrimeParamList>>();

  const purchaseByExternalCheckout = useCallback(
    async ({
      selectedSubscriptionPeriod,
      featureName,
      beforeCheckout,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
      beforeCheckout?: () => Promise<boolean>;
    }) => {
      const plan: IPrimeInfiniSubscriptionPlan =
        selectedSubscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly';
      if (isExternalCheckoutInFlight || isWalletPaymentPageOpening) {
        logPrimeInfiniPaymentFlow({
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
        if (!(await ensurePrimeLoggedIn())) {
          logPrimeInfiniPaymentFlow({
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
        let checkoutGuard: Awaited<
          ReturnType<typeof getPrimeInfiniExternalCheckoutGuard>
        >;
        try {
          checkoutGuard = await getPrimeInfiniExternalCheckoutGuard();
        } catch {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_network_error,
            }),
          });
          throw new OneKeyLocalError({
            message: 'Unable to verify the Infini payment session',
            autoToast: false,
          });
        }
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
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_network_error,
            }),
          });
          throw new OneKeyLocalError({
            message: 'Infini checkout context changed before creation',
            autoToast: false,
          });
        }
        const baselinePrimeSubscription = baselineSnapshot.primeSubscription;
        if (baselinePrimeSubscription?.isActive) {
          Toast.message({
            // TODO: i18n pending translation key
            title: 'OneKey Prime is already active for this account.',
          });
          logPrimeInfiniPaymentFlow({
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
            plan,
            expectedOneKeyUserId: purchaserUserId,
          });
        const postCreateGuard =
          await getPrimeInfiniExternalCheckoutGuard().catch(() => undefined);
        if (
          !postCreateGuard?.isLoggedIn ||
          postCreateGuard.onekeyUserId !== purchaserUserId ||
          postCreateGuard.hasPendingPayment
        ) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_network_error,
            }),
          });
          throw new OneKeyLocalError({
            message: 'Infini checkout context changed before opening',
            autoToast: false,
          });
        }
        const checkoutUrl = checkoutResult?.checkoutUrl;
        if (!checkoutUrl) {
          // Guards the unconfirmed backend response schema: a 200 response
          // with an unexpected field name must not become a silent dead end
          // (plan §9 requires a toast on checkout creation failure). Network
          // and business errors are already toasted by @toastIfError on
          // apiGetInfiniCheckoutUrl; only this local throw needs it.
          Toast.error({
            // TODO: i18n pending translation key
            title: 'Failed to create the checkout, please try again',
          });
          throw new OneKeyLocalError({
            message: 'Infini checkout url is empty',
            autoToast: false,
          });
        }

        // Open the hosted checkout in the external system browser on all
        // supported platforms (see integration plan §8): Binance Pay and
        // wallet-app deep links are unreliable inside the in-app browser
        openUrlUtils.openUrlExternal(checkoutUrl, { useSystemBrowser: true });

        // checkoutUrl is passed down so the waiting dialog can offer an
        // "Open checkout page" affordance: on web the window.open above runs
        // after async gaps and may be blocked by the popup blocker
        showPrimeInfiniWaitingDialog({
          plan,
          onekeyUserId: purchaserUserId,
          featureName,
          checkoutUrl,
        });
        logPrimeInfiniPaymentFlow({
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
      const plan: IPrimeInfiniSubscriptionPlan =
        selectedSubscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly';
      if (isWalletPaymentPageOpening || isExternalCheckoutInFlight) {
        logPrimeInfiniPaymentFlow({
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
        stage: 'walletPaymentPage',
        status: 'started',
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        plan,
        checkoutType: 'internalWallet',
      });
      try {
        if (!(await ensurePrimeLoggedIn())) {
          logPrimeInfiniPaymentFlow({
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
            selectedSubscriptionPeriod,
            featureName,
            createNewPayment: true,
          },
        });
        logPrimeInfiniPaymentFlow({
          stage: 'walletPaymentPage',
          status: 'succeeded',
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          plan,
          checkoutType: 'internalWallet',
        });
      } catch (error) {
        logPrimeInfiniPaymentFlow({
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
    [navigation],
  );

  return { purchaseByCrypto, purchaseByExternalCheckout };
}

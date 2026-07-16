/* cspell:ignore Infini */
import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IPrimeInfiniSubscriptionPlan } from '@onekeyhq/shared/types/prime/primeTypes';

import { showPrimeInfiniWaitingDialog } from '../components/PrimeInfiniWaitingDialog';

import type { ISubscriptionPeriod } from './usePrimePaymentTypes';

// Module-level so every hook/dialog instance shares the same guard: prevents a
// second checkout session from being created server-side while the first
// checkout request is still in flight (e.g. the user re-clicks Subscribe and
// picks "Pay with crypto" again during a slow checkout POST).
let isCryptoPurchaseInFlight = false;

export function usePrimeInfiniPurchase() {
  const [primeUserInfo] = usePrimePersistAtom();
  const { primeSubscription } = primeUserInfo;

  const purchaseByCrypto = useCallback(
    async ({
      selectedSubscriptionPeriod,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
    }) => {
      if (isCryptoPurchaseInFlight) {
        return;
      }
      isCryptoPurchaseInFlight = true;
      try {
        // Defensive check only: the purchase dialog flows already run
        // ensureOneKeyIDLoggedIn (usePrimeRequirements) before reaching here.
        // Calling usePrimeRequirements directly would create a circular import
        // with PrimePurchaseDialog, so the login state is verified via bg service.
        const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
        if (!isLoggedIn) {
          // This function is fired-and-forgotten from onPress handlers and
          // OneKeyLocalError does not auto-toast, so surface the failure
          // explicitly before throwing.
          Toast.error({
            // TODO: i18n pending translation key
            title: 'Please log in to your OneKey ID first',
          });
          throw new OneKeyLocalError('Prime is not logged in');
        }

        const plan: IPrimeInfiniSubscriptionPlan =
          selectedSubscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly';

        defaultLogger.prime.subscription.primeSubscribeIntent({
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
          currency: 'USD',
          paymentMethod: 'crypto',
        });

        // The renewal baseline below must come from fresh server truth, not
        // from the render-time primePersistAtom snapshot captured by this
        // closure: the imperative payment-method pickers freeze that snapshot
        // at purchase() time, and a subscription that is already active
        // server-side but unknown to the local atom (purchase completed on
        // another device, webhook landed while the app was backgrounded)
        // would leave the baseline undefined and make the waiting dialog
        // report success before any payment. Fetched in parallel with the
        // checkout creation so the extra roundtrip adds no latency; if the
        // fetch fails, fall back to the local atom snapshot, which is never
        // worse than trusting it directly.
        const [checkoutResult, baselinePrimeSubscription, infiniBaseline] =
          await Promise.all([
            backgroundApiProxy.servicePrime.apiGetInfiniCheckoutUrl({
              plan,
            }),
            backgroundApiProxy.servicePrime
              .apiFetchPrimeUserInfo()
              .then((userInfo) => userInfo.primeSubscription)
              .catch(() => primeSubscription),
            // Infini-channel baseline for the waiting dialog's dual-channel
            // guard: for a buyer whose merged Prime expiry is dominated by a
            // longer-lived channel (e.g. IAP), a successful crypto payment
            // never moves the merged expiry, so the Infini record's own
            // currentPeriodEnd advancing past this baseline is the only
            // reliable success signal. 0 records a confirmed absence of an
            // Infini subscription (any period end appearing later means the
            // payment landed); undefined (record without a period end, or a
            // failed fetch) disables the guard, because guessing a baseline
            // could fire a false success on a pre-existing period end.
            backgroundApiProxy.servicePrime
              .apiGetInfiniSubscription()
              .then((infiniSubscription) =>
                infiniSubscription ? infiniSubscription.currentPeriodEnd : 0,
              )
              .catch(() => undefined),
          ]);
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
          throw new OneKeyLocalError('Infini checkout url is empty');
        }

        // Open the hosted checkout in the external system browser on all
        // supported platforms (see integration plan §8): Binance Pay and
        // wallet-app deep links are unreliable inside the in-app browser
        openUrlUtils.openUrlExternal(checkoutUrl, { useSystemBrowser: true });

        // A buyer who is still Prime (e.g. the management page's "Renew now"
        // re-purchase fallback, integration plan §7.2 branch 2, or the
        // dev-only change-subscription entry) cannot use isPrime as the
        // payment success signal — it is already true and the waiting dialog
        // would report success before any payment. Capture the current merged
        // expiry as the renewal baseline so success is detected by expiry
        // extension instead.
        // `|| undefined` treats a malformed zero expiry as "no baseline",
        // consistent with the renew flow in PrimeInfiniSubscription
        const renewalBaselineExpiresAt = baselinePrimeSubscription?.isActive
          ? baselinePrimeSubscription.expiresAt || undefined
          : undefined;

        // The dual-channel guard only runs inside the renewal branch gated by
        // renewalBaselineExpiresAt; a not-yet-Prime buyer uses isPrime itself
        // as the success signal and needs no Infini baseline
        const renewalBaselineInfiniPeriodEnd =
          renewalBaselineExpiresAt === undefined ? undefined : infiniBaseline;

        // checkoutUrl is passed down so the waiting dialog can offer an
        // "Open checkout page" affordance: on web the window.open above runs
        // after async gaps and may be blocked by the popup blocker
        showPrimeInfiniWaitingDialog({
          plan,
          featureName,
          checkoutUrl,
          renewalBaselineExpiresAt,
          renewalBaselineInfiniPeriodEnd,
        });
      } finally {
        isCryptoPurchaseInFlight = false;
      }
    },
    [primeSubscription],
  );

  return { purchaseByCrypto };
}

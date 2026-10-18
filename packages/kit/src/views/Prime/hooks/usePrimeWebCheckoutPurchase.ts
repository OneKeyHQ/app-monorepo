import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import {
  fallbackToPrimeHostedCardCheckout,
  startPrimeHostedCardCheckout,
} from './primeHostedCardCheckout';

import type { ISubscriptionPeriod } from './usePrimePaymentTypes';
import type { IPrimeEmbeddedCheckoutFallbackTrigger } from '../purchasesSdk/primeEmbeddedCheckoutFallback';

type IPrimeHostedCardCheckoutPlan = {
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  currency?: string;
  featureName?: EPrimeFeatures;
};

export function usePrimeWebCheckoutPurchase() {
  const intl = useIntl();
  const { user, supabaseUser } = useOneKeyAuth();
  const onekeyUserId = user?.onekeyUserId;
  const email = supabaseUser?.email;

  const purchaseByHostedLink = useCallback(
    (plan: IPrimeHostedCardCheckoutPlan) =>
      startPrimeHostedCardCheckout({ ...plan, intl, onekeyUserId, email }),
    [email, intl, onekeyUserId],
  );

  const fallbackToHostedLink = useCallback(
    (
      plan: IPrimeHostedCardCheckoutPlan & {
        trigger: IPrimeEmbeddedCheckoutFallbackTrigger;
      },
    ) =>
      fallbackToPrimeHostedCardCheckout({
        ...plan,
        intl,
        onekeyUserId,
        email,
      }),
    [email, intl, onekeyUserId],
  );

  return { purchaseByHostedLink, fallbackToHostedLink };
}

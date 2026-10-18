import {
  PRIME_CARD_CHECKOUT_EXT_HANDOFF_FEATURE_QUERY,
  PRIME_CARD_CHECKOUT_EXT_HANDOFF_QUERY,
  PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY,
  PRIME_SUBSCRIPTION_EXT_HANDOFF_VALUE,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import {
  getExtExpandTabHashParams,
  stripExtExpandTabHashParams,
} from '../../../utils/extExpandTabHashParams';

import type { ISubscriptionPeriod } from '../../../views/Prime/hooks/usePrimePaymentTypes';

export function consumePrimeSubscriptionHandoffFromUrl(): boolean {
  if (
    getExtExpandTabHashParams()?.get(PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY) !==
    PRIME_SUBSCRIPTION_EXT_HANDOFF_VALUE
  ) {
    return false;
  }
  stripExtExpandTabHashParams([PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY]);
  return true;
}

const PRIME_SUBSCRIPTION_PERIODS: readonly ISubscriptionPeriod[] = [
  'P1Y',
  'P1M',
];
const PRIME_FEATURES = new Set<string>(Object.values(EPrimeFeatures));

export type IPrimeCardCheckoutHandoff = {
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  featureName?: EPrimeFeatures;
};

// Card checkout started in the popup continues in the expand tab, which
// survives the hosted checkout tab taking focus.
export function consumePrimeCardCheckoutHandoffFromUrl():
  | IPrimeCardCheckoutHandoff
  | undefined {
  const params = getExtExpandTabHashParams();
  const period = params?.get(PRIME_CARD_CHECKOUT_EXT_HANDOFF_QUERY);
  if (!params || !period) {
    return undefined;
  }
  const feature = params.get(PRIME_CARD_CHECKOUT_EXT_HANDOFF_FEATURE_QUERY);
  stripExtExpandTabHashParams([
    PRIME_CARD_CHECKOUT_EXT_HANDOFF_QUERY,
    PRIME_CARD_CHECKOUT_EXT_HANDOFF_FEATURE_QUERY,
  ]);
  const selectedSubscriptionPeriod = PRIME_SUBSCRIPTION_PERIODS.find(
    (item) => item === period,
  );
  if (!selectedSubscriptionPeriod) {
    return undefined;
  }
  return {
    selectedSubscriptionPeriod,
    featureName:
      feature && PRIME_FEATURES.has(feature)
        ? (feature as EPrimeFeatures)
        : undefined,
  };
}

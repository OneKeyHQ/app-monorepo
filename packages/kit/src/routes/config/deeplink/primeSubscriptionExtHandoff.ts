import {
  PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY,
  PRIME_SUBSCRIPTION_EXT_HANDOFF_VALUE,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';

import {
  getExtExpandTabHashParams,
  stripExtExpandTabHashParams,
} from '../../../utils/extExpandTabHashParams';

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

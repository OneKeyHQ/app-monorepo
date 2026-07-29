import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import type {
  IPackageFreeTrial,
  ISubscriptionPeriod,
} from '../../hooks/usePrimePaymentTypes';
import type { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

export const PRIME_SUBSCRIBE_RESUME_DELAY_MS = 1000;

export type IPrimePendingSubscribe = {
  subscriptionPeriod: ISubscriptionPeriod;
  freeTrial?: IPackageFreeTrial;
};

export function usePrimeSubscribeResume({
  ensurePrimeSubscriptionActive,
  featureName,
  isLoggedIn,
  pendingSubscribeRef,
}: {
  ensurePrimeSubscriptionActive: ReturnType<
    typeof usePrimeRequirements
  >['ensurePrimeSubscriptionActive'];
  featureName?: EPrimeFeatures;
  isLoggedIn: boolean;
  pendingSubscribeRef: MutableRefObject<IPrimePendingSubscribe | null>;
}) {
  useEffect(() => {
    if (!isLoggedIn || !pendingSubscribeRef.current) {
      return undefined;
    }

    const timerId = setTimeout(async () => {
      const pendingSubscribe = pendingSubscribeRef.current;
      if (!pendingSubscribe) {
        return;
      }
      pendingSubscribeRef.current = null;
      try {
        await ensurePrimeSubscriptionActive({
          skipDialogConfirm: true,
          selectedSubscriptionPeriod: pendingSubscribe.subscriptionPeriod,
          featureName,
          freeTrial: pendingSubscribe.freeTrial,
        });
      } catch {
        // Login was completed but subscription check may throw
        // (e.g., user cancelled purchase dialog) — safe to ignore
      }
    }, PRIME_SUBSCRIBE_RESUME_DELAY_MS);

    return () => clearTimeout(timerId);
  }, [
    ensurePrimeSubscriptionActive,
    featureName,
    isLoggedIn,
    pendingSubscribeRef,
  ]);
}

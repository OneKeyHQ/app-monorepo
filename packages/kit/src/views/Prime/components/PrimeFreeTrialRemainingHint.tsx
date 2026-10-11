import { useEffect } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePrimeFreeTrialAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeFreeTrialUsageFeatureId } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { isPrimeFreeTrialTravelMode } from '../hooks/usePrimeFeatureAccess';
import { getPrimeFreeTrialQuotaOfUser } from '../utils/primeFreeTrialAccess';
import { PRIME_FREE_TRIAL_COPY } from '../utils/primeFreeTrialCopy';

// A snapshot younger than this is reused instead of refreshing on mount; the
// entry gate usually refreshed it a moment ago.
const SNAPSHOT_FRESH_MS = 30 * 1000;

// Remaining free uses of a count-metered feature. Rendered only for logged-in
// free users with a known quota; translate never shows a token hint.
// Reads the Prime atom directly (not useOneKeyAuth) so it also works inside
// dialogs rendered outside the auth providers.
export function PrimeFreeTrialRemainingHint({
  featureId,
  ...rest
}: {
  featureId: IPrimeFreeTrialUsageFeatureId | EPrimeFeatures.AddressRiskCheck;
} & IXStackProps) {
  const [user] = usePrimePersistAtom();
  const isLoggedIn = Boolean(user?.isLoggedIn && user?.isLoggedInOnServer);
  const isPrimeSubscriptionActive = Boolean(
    isLoggedIn && user?.primeSubscription?.isActive,
  );
  const [{ quota }] = usePrimeFreeTrialAtom();
  const onekeyUserId = user?.onekeyUserId;
  const isFreeUser = isLoggedIn && !isPrimeSubscriptionActive;

  const isSnapshotFresh =
    quota.onekeyUserId === onekeyUserId &&
    quota.status === 'success' &&
    Date.now() - (quota.updatedAt ?? 0) < SNAPSHOT_FRESH_MS;
  useEffect(() => {
    if (!isFreeUser || isSnapshotFresh || isPrimeFreeTrialTravelMode()) {
      return;
    }
    void backgroundApiProxy.servicePrimeFreeTrial.refreshQuota({
      dedupe: true,
    });
    // Only on mount / user change: the snapshot updates itself afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreeUser, onekeyUserId]);

  if (!isFreeUser || isPrimeFreeTrialTravelMode()) {
    return null;
  }
  // A failed or missing load hides the hint; it is never read as exhausted
  // (start decides), and the next entry refreshes again.
  const quotaOfUser = getPrimeFreeTrialQuotaOfUser({ quota, onekeyUserId });
  const featureQuota = quotaOfUser?.features.find(
    (item) => item.featureId === featureId,
  );
  if (!featureQuota || featureQuota.unit !== 'count') {
    return null;
  }
  return (
    <XStack gap="$1.5" alignItems="center" {...rest}>
      <Icon name="PrimeOutline" size="$4" color="$iconSubdued" />
      <SizableText size="$bodyMd" color="$textSubdued">
        {PRIME_FREE_TRIAL_COPY.remainingUses(featureQuota.remaining)}
      </SizableText>
    </XStack>
  );
}

import { useEffect } from 'react';

import {
  Icon,
  SizableText,
  XStack,
  useDialogInstance,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePrimeFreeTrialAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import type {
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialFeatureQuota,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { isPrimeFreeTrialTravelMode } from '../hooks/usePrimeFeatureAccess';
import { usePrimeFreeTrialUpgrade } from '../hooks/usePrimeFreeTrialUpgrade';
import { getPrimeFreeTrialQuotaOfUser } from '../utils/primeFreeTrialAccess';
import { PRIME_FREE_TRIAL_COPY } from '../utils/primeFreeTrialCopy';

import type { GestureResponderEvent } from 'react-native';

// A snapshot younger than this is reused instead of refreshing on mount; the
// entry gate usually refreshed it a moment ago.
const SNAPSHOT_FRESH_MS = 30 * 1000;

// Token quotas (translate) show the remaining share: a raw token count means
// little to users. A usable quota is never rounded down to 0%.
function getRemainingText({
  unit,
  remaining,
  monthlyQuota,
}: IPrimeFreeTrialFeatureQuota) {
  if (unit === 'count') {
    return PRIME_FREE_TRIAL_COPY.remainingUses(remaining);
  }
  const percent = Math.floor((remaining / monthlyQuota) * 100);
  return PRIME_FREE_TRIAL_COPY.remainingQuotaPercent(
    Math.min(100, Math.max(1, percent)),
  );
}

// Remaining free quota of a feature: uses, or a share of translate's tokens.
// Rendered only for logged-in free users with a known quota. At 0 it
// shows the exhausted sentence and the same "Get Prime" as the toast.
// Reads the Prime atom directly (not useOneKeyAuth) so it also works inside
// dialogs rendered outside the auth providers.
export function PrimeFreeTrialRemainingHint({
  featureId,
  networkId,
  beforeGetPrime,
  ...rest
}: {
  featureId: IPrimeFreeTrialFeatureId;
  networkId?: string;
  // Closes a popover holding the hint before the dashboard opens.
  beforeGetPrime?: () => Promise<void>;
} & IXStackProps) {
  const [user] = usePrimePersistAtom();
  const isLoggedIn = Boolean(user?.isLoggedIn && user?.isLoggedInOnServer);
  const isPrimeSubscriptionActive = Boolean(
    isLoggedIn && user?.primeSubscription?.isActive,
  );
  const [{ quota }] = usePrimeFreeTrialAtom();
  const onekeyUserId = user?.onekeyUserId;
  const isFreeUser = isLoggedIn && !isPrimeSubscriptionActive;
  const { getPrime } = usePrimeFreeTrialUpgrade();
  // Empty outside a dialog, where close does nothing.
  const dialog = useDialogInstance();

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
  if (!featureQuota) {
    return null;
  }
  const openDashboard = () => {
    getPrime({ featureId, networkId });
  };
  return (
    <XStack gap="$1.5" alignItems="center" flexWrap="wrap" {...rest}>
      <Icon name="PrimeOutline" size="$4" color="$iconSubdued" />
      {featureQuota.remaining > 0 ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {getRemainingText(featureQuota)}
        </SizableText>
      ) : (
        <>
          <SizableText size="$bodyMd" color="$textSubdued">
            {PRIME_FREE_TRIAL_COPY.quotaExhausted[featureQuota.unit]}
          </SizableText>
          <SizableText
            testID="prime-free-trial-hint-get-prime-btn"
            size="$bodyMdMedium"
            color="$textSuccess"
            cursor="pointer"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
            role="button"
            onPress={(event: GestureResponderEvent) => {
              // The hint can sit inside a pressable card (bulk revoke method).
              event.stopPropagation();
              // A dialog would stay above the dashboard.
              void dialog.close();
              if (beforeGetPrime) {
                void beforeGetPrime().then(openDashboard);
                return;
              }
              openDashboard();
            }}
          >
            {PRIME_FREE_TRIAL_COPY.getPrime}
          </SizableText>
        </>
      )}
    </XStack>
  );
}

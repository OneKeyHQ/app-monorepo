import type {
  IPrimeFreeTrialAtomData,
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialFeatureQuota,
  IPrimeFreeTrialPublicConfig,
  IPrimeFreeTrialQuota,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

export type IPrimeFreeTrialAccess =
  // Active subscription: run directly, no free-trial metering.
  | { status: 'prime' }
  // Logged out and the feature is open (or the config is unknown).
  | { status: 'loginRequired' }
  | { status: 'notOpen' }
  | {
      status: 'exhausted';
      featureQuota: IPrimeFreeTrialFeatureQuota;
      resetAt: number | undefined;
    }
  // Logged-in free user with quota left or an unknown quota; the start
  // request (or the metered API) is the final judge.
  | {
      status: 'available';
      featureQuota: IPrimeFreeTrialFeatureQuota | undefined;
    };

// Analytics dimension: which entitlement let the user run a feature.
export function getPrimeEntitlementSource(
  user: Pick<
    IPrimeUserInfo,
    'isLoggedIn' | 'isLoggedInOnServer' | 'primeSubscription'
  >,
): 'prime' | 'freeTrial' {
  return user.isLoggedIn &&
    user.isLoggedInOnServer &&
    user.primeSubscription?.isActive
    ? 'prime'
    : 'freeTrial';
}

export function isPrimeFreeTrialFeatureOpenInConfig({
  config,
  featureId,
}: {
  config: IPrimeFreeTrialPublicConfig;
  featureId: IPrimeFreeTrialFeatureId;
}) {
  return (
    config.enabled &&
    config.features.some((item) => item.featureId === featureId)
  );
}

// Quota of the current user, undefined when unknown. null means Prime on the
// server or nothing open. A snapshot of a month that has already reset is
// unknown as well: the next refresh (or start) brings the new month.
export function getPrimeFreeTrialQuotaOfUser({
  quota,
  onekeyUserId,
  now = Date.now(),
}: {
  quota: IPrimeFreeTrialAtomData['quota'];
  onekeyUserId: string | undefined;
  now?: number;
}): IPrimeFreeTrialQuota | null | undefined {
  if (!onekeyUserId || quota.onekeyUserId !== onekeyUserId) {
    return undefined;
  }
  if (quota.data?.resetAt && quota.data.resetAt <= now) {
    return undefined;
  }
  return quota.data;
}

export function resolvePrimeFreeTrialAccess({
  featureId,
  isPrimeSubscriptionActive,
  isLoggedIn,
  config,
  quota,
}: {
  featureId: IPrimeFreeTrialFeatureId;
  isPrimeSubscriptionActive: boolean;
  isLoggedIn: boolean;
  // undefined: unknown
  config: IPrimeFreeTrialPublicConfig | undefined;
  // undefined: unknown
  quota: IPrimeFreeTrialQuota | null | undefined;
}): IPrimeFreeTrialAccess {
  if (isPrimeSubscriptionActive) {
    return { status: 'prime' };
  }
  if (!isLoggedIn) {
    // An unknown config must never be read as "not open".
    if (config && !isPrimeFreeTrialFeatureOpenInConfig({ config, featureId })) {
      return { status: 'notOpen' };
    }
    return { status: 'loginRequired' };
  }
  if (quota) {
    const featureQuota = quota.features.find(
      (item) => item.featureId === featureId,
    );
    // `features` only lists open features.
    if (!featureQuota) {
      return { status: 'notOpen' };
    }
    if (featureQuota.remaining <= 0) {
      return { status: 'exhausted', featureQuota, resetAt: quota.resetAt };
    }
    return { status: 'available', featureQuota };
  }
  if (
    quota === null &&
    config &&
    !isPrimeFreeTrialFeatureOpenInConfig({ config, featureId })
  ) {
    return { status: 'notOpen' };
  }
  return { status: 'available', featureQuota: undefined };
}

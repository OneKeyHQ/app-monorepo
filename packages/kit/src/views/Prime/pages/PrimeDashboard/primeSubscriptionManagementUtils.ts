/* cspell:ignore Infini infini */
import type {
  IPrimeSubscriptionInfo,
  IPrimeUserInfo,
} from '@onekeyhq/shared/types/prime/primeTypes';

type IPrimeSubscriptionManagementUserInfo = {
  primeSubscription?: IPrimeUserInfo['primeSubscription'];
  subscriptionManageUrl?: string;
};

export type IPrimeSubscriptionManagementTarget =
  | {
      type: 'infini';
    }
  | {
      type: 'external';
      url: string;
    }
  | {
      type: 'unavailable';
      reason:
        | 'missing-channel-and-management-url'
        | 'channel-without-management-url';
    };

export function isMissingChannelManagementTarget(
  target: IPrimeSubscriptionManagementTarget,
) {
  return (
    target.type === 'unavailable' &&
    target.reason === 'missing-channel-and-management-url'
  );
}

export function hasRevenueCatSubscriptionChannel({
  subscriptions,
}: {
  subscriptions:
    | {
        channel?: string;
      }[]
    | undefined;
}) {
  return (subscriptions ?? []).some(
    (subscription) =>
      subscription.channel?.trim().toLowerCase() === 'revenuecat',
  );
}

export function getPrimeSubscriptionManagementSourceKey({
  primeSubscription,
  subscriptionManageUrl,
}: {
  primeSubscription?: {
    expiresAt?: number;
    subscriptions?: IPrimeSubscriptionInfo['subscriptions'];
  };
  subscriptionManageUrl?: string;
}) {
  return JSON.stringify([
    primeSubscription?.expiresAt ?? null,
    (primeSubscription?.subscriptions ?? []).map((subscription) => [
      subscription.channel?.trim().toLowerCase() ?? '',
      subscription.managementUrl?.trim() ?? '',
    ]),
    subscriptionManageUrl?.trim() ?? '',
  ]);
}

export function getPrimeSubscriptionManagementTarget({
  userInfo,
}: {
  userInfo: IPrimeSubscriptionManagementUserInfo;
}): IPrimeSubscriptionManagementTarget {
  let hasChannel = false;
  let hasRevenueCat = false;
  let managementUrl: string | undefined;
  for (const subscription of userInfo.primeSubscription?.subscriptions ?? []) {
    const channel = subscription.channel?.trim().toLowerCase();
    if (channel === 'infini') {
      return { type: 'infini' };
    }
    if (channel) {
      hasChannel = true;
      if (channel === 'revenuecat') {
        hasRevenueCat = true;
      }
      if (!managementUrl && channel !== 'redemption') {
        const url = subscription.managementUrl?.trim();
        if (url) {
          managementUrl = url;
        }
      }
    }
  }

  if (managementUrl) {
    return {
      type: 'external',
      url: managementUrl,
    };
  }

  const revenueCatManagementUrl = userInfo.subscriptionManageUrl?.trim();
  if (hasRevenueCat && revenueCatManagementUrl) {
    return {
      type: 'external',
      url: revenueCatManagementUrl,
    };
  }

  return {
    type: 'unavailable',
    reason: hasChannel
      ? 'channel-without-management-url'
      : 'missing-channel-and-management-url',
  };
}

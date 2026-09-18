/* cspell:ignore Infini infini rcbilling customerportal */
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

function getKnownChannelLessManagementUrl(
  managementUrl: string | undefined,
): string | undefined {
  const url = managementUrl?.trim();
  if (!url) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return undefined;
    }
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    if (
      hostname === 'api.revenuecat.com' &&
      pathname.startsWith('/rcbilling/v1/customerportal/')
    ) {
      return url;
    }
    if (
      hostname === 'apps.apple.com' &&
      (pathname === '/account/subscriptions' ||
        pathname.startsWith('/account/subscriptions/'))
    ) {
      return url;
    }
  } catch {
    return undefined;
  }
  return undefined;
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
    } else if (!managementUrl) {
      // Compatibility for channel-less server records that already include the
      // store portal URL. Do not treat this as a general URL allowlist.
      const knownManagementUrl = getKnownChannelLessManagementUrl(
        subscription.managementUrl,
      );
      if (knownManagementUrl) {
        managementUrl = knownManagementUrl;
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

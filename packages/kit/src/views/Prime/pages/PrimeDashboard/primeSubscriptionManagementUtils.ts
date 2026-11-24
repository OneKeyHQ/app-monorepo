/* cspell:ignore Infini infini */
import type { IPrimeSubscriptionInfo } from '@onekeyhq/shared/types/prime/primeTypes';

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
    };

export function getPrimeSubscriptionManagementSourceKey({
  primeSubscription,
}: {
  primeSubscription?: {
    expiresAt?: number;
    subscriptions?: IPrimeSubscriptionInfo['subscriptions'];
  };
}) {
  return JSON.stringify([
    primeSubscription?.expiresAt ?? null,
    (primeSubscription?.subscriptions ?? []).map((subscription) => [
      subscription.channel?.trim().toLowerCase() ?? '',
      subscription.managementUrl?.trim() ?? '',
    ]),
  ]);
}

export function getPrimeSubscriptionManagementTarget({
  userInfo,
  preferBillingIssue = false,
}: {
  userInfo: {
    primeSubscription?: IPrimeSubscriptionInfo;
  };
  // Try subscriptions with a failed renewal first: the server lists them
  // after the others, but updating the payment method must open their page.
  preferBillingIssue?: boolean;
}): IPrimeSubscriptionManagementTarget {
  const primeSubscription = userInfo.primeSubscription;
  if (primeSubscription?.isActive !== true) {
    return { type: 'unavailable' };
  }

  const subscriptions = primeSubscription.subscriptions ?? [];
  const orderedSubscriptions = preferBillingIssue
    ? [
        ...subscriptions.filter((item) => item.hasBillingIssue === true),
        ...subscriptions.filter((item) => item.hasBillingIssue !== true),
      ]
    : subscriptions;

  for (const subscription of orderedSubscriptions) {
    if (subscription.channel?.trim().toLowerCase() === 'infini') {
      return { type: 'infini' };
    }

    const url = subscription.managementUrl?.trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' && parsed.hostname) {
          return {
            type: 'external',
            url,
          };
        }
      } catch {
        // Invalid management URLs are skipped.
      }
    }
  }

  return { type: 'unavailable' };
}

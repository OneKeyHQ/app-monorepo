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
  billingIssueOnly = false,
}: {
  userInfo: {
    primeSubscription?: IPrimeSubscriptionInfo;
  };
  // Only consider subscriptions whose renewal failed: updating the payment
  // method must open their page, never the one of a healthy subscription.
  billingIssueOnly?: boolean;
}): IPrimeSubscriptionManagementTarget {
  const primeSubscription = userInfo.primeSubscription;
  if (primeSubscription?.isActive !== true) {
    return { type: 'unavailable' };
  }

  const subscriptions = primeSubscription.subscriptions ?? [];
  const candidates = billingIssueOnly
    ? subscriptions.filter((item) => item.hasBillingIssue === true)
    : subscriptions;

  for (const subscription of candidates) {
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

/* cspell:ignore Infini infini */
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

type IPrimeSubscriptionManagementUserInfo = Pick<
  IPrimeUserInfo,
  'primeSubscription'
> & {
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

function getDeclaredSubscriptionChannels({
  userInfo,
}: {
  userInfo: IPrimeSubscriptionManagementUserInfo;
}) {
  return (
    userInfo.primeSubscription?.subscriptions
      ?.map((subscription) => subscription.channel?.trim().toLowerCase())
      .filter((channel): channel is string => Boolean(channel)) ?? []
  );
}

export function getPrimeSubscriptionManagementTarget({
  userInfo,
  isInfiniManageSupported,
}: {
  userInfo: IPrimeSubscriptionManagementUserInfo;
  isInfiniManageSupported: boolean;
}): IPrimeSubscriptionManagementTarget {
  const channels = getDeclaredSubscriptionChannels({ userInfo });
  if (isInfiniManageSupported && channels.includes('infini')) {
    return { type: 'infini' };
  }

  const managementUrl = userInfo.primeSubscription?.subscriptions
    ?.map((subscription) => subscription.managementUrl?.trim())
    .find((url): url is string => Boolean(url));
  if (managementUrl) {
    return {
      type: 'external',
      url: managementUrl,
    };
  }

  const revenueCatManagementUrl = userInfo.subscriptionManageUrl?.trim();
  if (channels.includes('revenuecat') && revenueCatManagementUrl) {
    return {
      type: 'external',
      url: revenueCatManagementUrl,
    };
  }

  return {
    type: 'unavailable',
    reason:
      channels.length === 0
        ? 'missing-channel-and-management-url'
        : 'channel-without-management-url',
  };
}

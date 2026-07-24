/* cspell:ignore Infini infini */
import type {
  IPrimeInfiniSubscription,
  IPrimeUserInfo,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { isInfiniSubscriptionInPeriod } from '../PrimeInfiniSubscription/infiniSubscriptionUtils';

type IPrimeSubscriptionManagementUserInfo = Pick<
  IPrimeUserInfo,
  'primeSubscription' | 'subscriptionManageUrl'
>;

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
      ?.map((subscription) => subscription.channel?.trim())
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
  if (
    isInfiniManageSupported &&
    channels.some((channel) => channel.toLowerCase() === 'infini')
  ) {
    return { type: 'infini' };
  }

  const managementUrl = userInfo.subscriptionManageUrl?.trim();
  if (managementUrl) {
    return {
      type: 'external',
      url: managementUrl,
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

export async function resolvePrimeSubscriptionManagementTarget({
  currentUserInfo,
  isInfiniManageSupported,
  fetchFreshUserInfo,
  fetchInfiniSubscription,
}: {
  currentUserInfo: IPrimeSubscriptionManagementUserInfo;
  isInfiniManageSupported: boolean;
  fetchFreshUserInfo: () => Promise<IPrimeSubscriptionManagementUserInfo>;
  fetchInfiniSubscription: () => Promise<IPrimeInfiniSubscription | undefined>;
}): Promise<IPrimeSubscriptionManagementTarget> {
  const currentTarget = getPrimeSubscriptionManagementTarget({
    userInfo: currentUserInfo,
    isInfiniManageSupported,
  });
  if (currentTarget.type !== 'unavailable') {
    return currentTarget;
  }

  const freshUserInfo = await fetchFreshUserInfo();
  const freshTarget = getPrimeSubscriptionManagementTarget({
    userInfo: freshUserInfo,
    isInfiniManageSupported,
  });
  if (freshTarget.type !== 'unavailable') {
    return freshTarget;
  }

  if (
    isInfiniManageSupported &&
    freshTarget.reason === 'missing-channel-and-management-url'
  ) {
    const infiniSubscription = await fetchInfiniSubscription();
    if (isInfiniSubscriptionInPeriod(infiniSubscription)) {
      return { type: 'infini' };
    }
  }

  return freshTarget;
}

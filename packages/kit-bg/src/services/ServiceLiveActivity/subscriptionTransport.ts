import type { ILiveActivitySubscriptionTransport } from '@onekeyhq/shared/types/liveActivity';

// A missing server capability must never look like an acknowledged subscription.
export const pendingServerSubscriptionTransport: ILiveActivitySubscriptionTransport =
  {
    subscribe: async () => ({ status: 'awaitingServer', revision: 0 }),
    unsubscribe: async () => undefined,
  };

export function createMockLiveActivitySubscriptionTransport(): ILiveActivitySubscriptionTransport {
  const subscriptions = new Map<string, string>();
  return {
    subscribe: async ({ activityId, order }) => {
      subscriptions.set(activityId, order.orderKey);
      return {
        status: 'mocked',
        subscriptionId: `mock:${activityId}`,
        revision: 1,
      };
    },
    unsubscribe: async ({ activityId, orderKey }) => {
      if (subscriptions.get(activityId) === orderKey) {
        subscriptions.delete(activityId);
      }
    },
  };
}

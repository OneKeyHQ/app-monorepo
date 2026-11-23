import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { ILiveActivitySubscriptionTransport } from '@onekeyhq/shared/types/liveActivity';

import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';

import type { AxiosInstance } from 'axios';

const SUBSCRIPTIONS_PATH = '/notification/v1/live-activities/subscriptions';
const ACTIVITY_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;

export const liveActivityRemoteTracking = {
  isReady: async (): Promise<boolean> => {
    if (!platformEnv.isNativeIOS || !platformEnv.isDev) return false;
    try {
      const { enabled, settings } = await devSettingsPersistAtom.get();
      if (!enabled || !settings?.enableTestEndpoint) return false;

      // The current push contract is enabled only for the standard test environment.
      return !settings.customApiEndpoints?.some(
        ({ enabled: customEnabled, serviceModule, api }) =>
          customEnabled &&
          (serviceModule === EServiceEndpointEnum.Notification ||
            serviceModule === EServiceEndpointEnum.Swap) &&
          api !== endpointsMap.test[serviceModule],
      );
    } catch {
      return false;
    }
  },
};

function validateActivityId(activityId: string) {
  if (typeof activityId !== 'string' || !ACTIVITY_ID_PATTERN.test(activityId)) {
    throw new OneKeyLocalError('Invalid Live Activity ID');
  }
}

function readResponseData(body: unknown) {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('code' in body) ||
    typeof body.code !== 'number' ||
    !Number.isSafeInteger(body.code)
  ) {
    throw new OneKeyLocalError('Invalid Live Activity response');
  }
  // A custom development endpoint may bypass the OneKey response interceptor.
  if (body.code !== 0) {
    throw new OneKeyServerApiError({
      autoToast: false,
      code: body.code,
      message: 'Live Activity request failed',
    });
  }
  if (
    !('data' in body) ||
    typeof body.data !== 'object' ||
    body.data === null
  ) {
    throw new OneKeyLocalError('Invalid Live Activity response data');
  }
  return body.data;
}

export function createServerLiveActivitySubscriptionTransport(
  client: Pick<AxiosInstance, 'post' | 'delete'>,
): ILiveActivitySubscriptionTransport {
  return {
    subscribe: async ({ schemaVersion, activityId, order }) => {
      validateActivityId(activityId);
      const { serviceOrderId: bizId, expiresAtMs } = order;
      if (
        (order.isMock && !order.isPushTest) ||
        typeof bizId !== 'string' ||
        !bizId.length ||
        bizId.length > 128 ||
        !Number.isSafeInteger(expiresAtMs) ||
        expiresAtMs <= 0
      ) {
        throw new OneKeyLocalError('Invalid Live Activity subscription');
      }

      const { data: body } = await client.post<unknown>(SUBSCRIPTIONS_PATH, {
        schemaVersion,
        activityId,
        bizType: 'swapOrder',
        bizId,
        expiresAtMs,
      });
      const data = readResponseData(body);
      if (
        !('status' in data) ||
        data.status !== 'registered' ||
        !('subscriptionId' in data) ||
        typeof data.subscriptionId !== 'string' ||
        !data.subscriptionId.length ||
        !('revision' in data) ||
        typeof data.revision !== 'number' ||
        !Number.isSafeInteger(data.revision) ||
        data.revision < 0
      ) {
        throw new OneKeyLocalError(
          'Invalid Live Activity subscription response',
        );
      }
      return {
        status: data.status,
        subscriptionId: data.subscriptionId,
        revision: data.revision,
      };
    },
    unsubscribe: async ({ activityId }) => {
      validateActivityId(activityId);
      const { data: body } = await client.delete<unknown>(
        `${SUBSCRIPTIONS_PATH}/${activityId}`,
      );
      const data = readResponseData(body);
      if (!('removed' in data) || typeof data.removed !== 'boolean') {
        throw new OneKeyLocalError(
          'Invalid Live Activity unsubscribe response',
        );
      }
    },
  };
}

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

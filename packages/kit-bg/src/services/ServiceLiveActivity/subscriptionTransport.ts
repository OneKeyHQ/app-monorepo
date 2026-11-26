import { Mutex } from 'async-mutex';

import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import type { ILiveActivitySubscriptionTransport } from '@onekeyhq/shared/types/liveActivity';

import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import { settingsPersistAtom } from '../../states/jotai/atoms/settings';

import { isStandardLiveActivityTestEndpoint } from './testEndpoint';

import type { AxiosInstance } from 'axios';

const SUBSCRIPTIONS_PATH = '/notification/v1/live-activities/subscriptions';
const ACTIVITY_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;
const CLEANUP_STORAGE_KEY = 'swapLiveActivityRemoteCleanup';

type IRemoteActivityCleanup = {
  expiresAtMs: number;
  subscribed: boolean;
  // Only a rejection for the sole POST can disprove a remote subscription.
  // A retry clears this bit before sending. Legacy entries default to unknown.
  soleRequest?: boolean;
  retryAtMs: number;
};

export const liveActivityRemoteTracking = {
  isReady: async (): Promise<boolean> => {
    if (!platformEnv.isNativeIOS) return false;
    try {
      return isStandardLiveActivityTestEndpoint(
        await devSettingsPersistAtom.get(),
      );
    } catch {
      return false;
    }
  },
};

async function readLiveActivityCleanupQueue(instanceId: string) {
  const serialized = await appStorage.getItem(CLEANUP_STORAGE_KEY);
  const queue = new Map<string, IRemoteActivityCleanup>();
  if (!serialized) return { queue, prune: false };
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return { queue, prune: true };
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('instanceId' in value) ||
    value.instanceId !== instanceId ||
    !('activities' in value) ||
    !Array.isArray(value.activities)
  ) {
    return { queue, prune: true };
  }
  const now = Date.now();
  for (const row of value.activities.filter(Array.isArray)) {
    const [activityId, expiresAtMs, subscribed, retryAtMs, soleRequest] =
      row as unknown[];
    if (
      typeof activityId === 'string' &&
      ACTIVITY_ID_PATTERN.test(activityId) &&
      typeof expiresAtMs === 'number' &&
      Number.isSafeInteger(expiresAtMs) &&
      expiresAtMs > now &&
      typeof subscribed === 'boolean' &&
      typeof retryAtMs === 'number' &&
      Number.isSafeInteger(retryAtMs) &&
      retryAtMs >= 0
    ) {
      queue.set(activityId, {
        expiresAtMs,
        subscribed,
        retryAtMs,
        soleRequest: soleRequest === true,
      });
    }
  }
  return { queue, prune: queue.size !== value.activities.length };
}

async function writeLiveActivityCleanupQueue(
  instanceId: string,
  queue: Map<string, IRemoteActivityCleanup>,
) {
  if (!queue.size) {
    await appStorage.removeItem(CLEANUP_STORAGE_KEY);
    return;
  }
  await appStorage.setItem(
    CLEANUP_STORAGE_KEY,
    JSON.stringify({
      instanceId,
      activities: Array.from(
        queue,
        ([id, { expiresAtMs, subscribed, retryAtMs, soleRequest }]) => [
          id,
          expiresAtMs,
          subscribed,
          retryAtMs,
          soleRequest === true,
        ],
      ),
    }),
  );
}

// The background runtime owns this queue. All service instances share its lock.
const cleanupMutex = new Mutex();

async function accessCleanupQueue(
  mutate?: (queue: Map<string, IRemoteActivityCleanup>) => boolean,
) {
  return cleanupMutex.runExclusive(async () => {
    const { instanceId } = await settingsPersistAtom.get();
    const { queue, prune } = await readLiveActivityCleanupQueue(instanceId);
    if (mutate?.(queue) || prune)
      await writeLiveActivityCleanupQueue(instanceId, queue);
    return queue;
  });
}

function updateEntry(
  activityId: string,
  update: (
    entry?: IRemoteActivityCleanup,
  ) => IRemoteActivityCleanup | undefined,
) {
  return accessCleanupQueue((queue) => {
    const previous = queue.get(activityId);
    const next = update(previous);
    if (next === previous) return false;
    if (next) queue.set(activityId, next);
    else queue.delete(activityId);
    return true;
  });
}

export const liveActivityCleanup = {
  read: () => accessCleanupQueue(),
  beforeSubscribe: (id: string, expiresAtMs: number) =>
    updateEntry(id, (entry) => {
      if (!entry)
        return {
          expiresAtMs,
          subscribed: false,
          soleRequest: true,
          retryAtMs: 0,
        };
      return entry.soleRequest ? { ...entry, soleRequest: false } : entry;
    }),
  validationRejected: (id: string) =>
    updateEntry(id, (entry) =>
      entry?.soleRequest && !entry.subscribed ? undefined : entry,
    ),
  subscribed: (id: string) =>
    updateEntry(
      id,
      (entry) => entry && { ...entry, subscribed: true, soleRequest: false },
    ),
  afterUnsubscribe: (id: string, removed: boolean) =>
    updateEntry(id, (entry) => {
      // A new runtime may DELETE before a previous POST has finished.
      if (!removed && entry && !entry.subscribed)
        return { ...entry, retryAtMs: Date.now() + 60_000 };
      return undefined;
    }),
  trackForCleanup: (id: string, expiresAtMs: number) =>
    updateEntry(
      id,
      (entry) => entry ?? { expiresAtMs, subscribed: false, retryAtMs: 0 },
    ),
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
    unsubscribe: async ({ activityId, signal }) => {
      validateActivityId(activityId);
      const path = `${SUBSCRIPTIONS_PATH}/${activityId}`;
      const { data: body } = signal
        ? await client.delete<unknown>(path, { signal })
        : await client.delete<unknown>(path);
      const data = readResponseData(body);
      if (!('removed' in data) || typeof data.removed !== 'boolean') {
        throw new OneKeyLocalError(
          'Invalid Live Activity unsubscribe response',
        );
      }
      return data.removed;
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
      return (
        subscriptions.get(activityId) === orderKey &&
        subscriptions.delete(activityId)
      );
    },
  };
}

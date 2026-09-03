import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';
import { callNativeStorage } from '../nativeStorageBridge';
import { parseNativeSyncStorageMutation } from '../nativeStorageTypes';
import {
  applyNativeSWRCacheCanonicalEntries,
  applyNativeSWRCachePatchToSerializedStore,
} from '../nativeSWRCachePersistence';

import type {
  INativeSWRCachePatchIntent,
  INativeStorageBootstrapSnapshot,
  INativeStorageGlobal,
  INativeStorageScalar,
  INativeSyncStorageLocalMutation,
  INativeSyncStorageMutation,
  INativeSyncStorageName,
  INativeSyncStorageRequest,
} from '../nativeStorageTypes';

type IMirrorState = {
  values: Map<string, INativeStorageScalar>;
  mutationsBeforeBootstrap: INativeSyncStorageLocalMutation[];
};

type IPendingRemoteMutation = {
  baselineValue?: string;
  enqueuedAt: number;
  isSWRCompactionSnapshot?: boolean;
  mutation: INativeSyncStorageLocalMutation;
  request: INativeSyncStorageRequest;
};

type IQueueDiagnostics = {
  degradedAt: number | undefined;
  errorType: string;
  failedAttemptCount: number;
  isReportingEpisode: boolean;
  lastReportedEpisodeEndedAt: number | undefined;
  maxOldestRequestAgeMs: number;
  maxQueueSize: number;
  nextStallThresholdIndex: number;
  stallTimer: ReturnType<typeof setTimeout> | undefined;
};

type IRemoteMutationQueue = {
  acknowledgementWaiters: Map<
    number,
    { promise: Promise<void>; resolve: () => void }
  >;
  diagnostics: IQueueDiagnostics;
  drainActive: boolean;
  drainPromise: Promise<void>;
  inFlightMutationId: number | undefined;
  pending: Map<number, IPendingRemoteMutation>;
  retryAttempt: number;
  retryTimer: ReturnType<typeof setTimeout> | undefined;
  supersededMutationIds: Map<number, number[]>;
};

const NATIVE_SYNC_STORAGE_NAMES: INativeSyncStorageName[] = [
  'settings',
  'coldStart',
  'devSettings',
];

const MUTATION_RETRY_BASE_DELAY_MS = 500;
const MUTATION_RETRY_MAX_DELAY_MS = 30_000;
const MUTATION_RETRY_JITTER_RATIO = 0.2;
const QUEUE_DIAGNOSTIC_EPISODE_COOLDOWN_MS = 10 * 60_000;
const QUEUE_STALL_THRESHOLDS_MS = [30_000, 5 * 60_000, 30 * 60_000];
const SWR_PATCH_COMPACTION_MAX_PENDING = 100;
const SWR_PATCH_COMPACTION_MAX_CHARS = 10 * 1024 * 1024;
const SWR_CACHE_KEY = 'onekey_swr_cache';

function createRemoteMutationQueue(): IRemoteMutationQueue {
  return {
    acknowledgementWaiters: new Map(),
    diagnostics: {
      degradedAt: undefined,
      errorType: 'unknown',
      failedAttemptCount: 0,
      isReportingEpisode: false,
      lastReportedEpisodeEndedAt: undefined,
      maxOldestRequestAgeMs: 0,
      maxQueueSize: 0,
      nextStallThresholdIndex: 0,
      stallTimer: undefined,
    },
    drainActive: false,
    drainPromise: Promise.resolve(),
    inFlightMutationId: undefined,
    pending: new Map(),
    retryAttempt: 0,
    retryTimer: undefined,
    supersededMutationIds: new Map(),
  };
}

const mirrors: Record<INativeSyncStorageName, IMirrorState> = {
  settings: { values: new Map(), mutationsBeforeBootstrap: [] },
  coldStart: { values: new Map(), mutationsBeforeBootstrap: [] },
  devSettings: { values: new Map(), mutationsBeforeBootstrap: [] },
};

const remoteMutationQueues: Record<
  INativeSyncStorageName,
  IRemoteMutationQueue
> = {
  settings: createRemoteMutationQueue(),
  coldStart: createRemoteMutationQueue(),
  devSettings: createRemoteMutationQueue(),
};

let bootstrapComplete = false;
let bootstrapPromise: Promise<void> | undefined;
let bootstrapGeneration = 0;
let mutationSequence = 0;
const mutationRuntimeId = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2)}`;

function applyLocalMutation(
  state: IMirrorState,
  mutation: INativeSyncStorageLocalMutation,
) {
  switch (mutation.operation) {
    case 'set':
      state.values.set(mutation.key, mutation.value);
      break;
    case 'patchSWR': {
      const current = state.values.get(SWR_CACHE_KEY);
      state.values.set(
        SWR_CACHE_KEY,
        applyNativeSWRCacheCanonicalEntries(
          typeof current === 'string' ? current : undefined,
          mutation.entries,
        ),
      );
      break;
    }
    case 'remove':
      state.values.delete(mutation.key);
      break;
    case 'clear':
      state.values.clear();
      break;
    default: {
      const exhaustive: never = mutation;
      throw new OneKeyLocalError(
        `Unknown native storage mirror mutation: ${String(exhaustive)}`,
      );
    }
  }
}

function appendCompactedLocalMutation(
  mutations: INativeSyncStorageLocalMutation[],
  mutation: INativeSyncStorageLocalMutation,
) {
  if (mutation.operation === 'clear') {
    mutations.length = 0;
    mutations.push(mutation);
    return;
  }
  if (mutation.operation === 'patchSWR') {
    mutations.push(mutation);
    return;
  }
  for (let index = mutations.length - 1; index >= 0; index -= 1) {
    const pending = mutations[index];
    if (pending.operation === 'clear') {
      break;
    }
    if ('key' in pending && pending.key === mutation.key) {
      mutations.splice(index, 1);
    }
  }
  mutations.push(mutation);
}

function compactPendingRemoteMutations({
  baselineValue,
  mutation,
  queue,
  request,
}: {
  baselineValue?: string;
  mutation: INativeSyncStorageLocalMutation;
  queue: IRemoteMutationQueue;
  request: INativeSyncStorageRequest;
}) {
  if (mutation.operation === 'clear') {
    const supersededMutationIds: number[] = [];
    queue.pending.forEach((_pending, mutationId) => {
      if (mutationId !== queue.inFlightMutationId) {
        supersededMutationIds.push(mutationId);
        queue.pending.delete(mutationId);
      }
    });
    return { mutation, request, supersededMutationIds };
  }
  if (mutation.operation === 'patchSWR') {
    const eligiblePending = [...queue.pending.entries()].filter(
      ([mutationId, pending]) =>
        mutationId !== queue.inFlightMutationId &&
        (pending.request.operation === 'patchSWR' ||
          (pending.request.store === 'coldStart' &&
            (pending.request.operation === 'set' ||
              pending.request.operation === 'remove') &&
            pending.request.key === SWR_CACHE_KEY)),
    );
    const patchRequests = eligiblePending
      .map(([, pending]) => pending.request)
      .filter(
        (
          pendingRequest,
        ): pendingRequest is Extract<
          INativeSyncStorageRequest,
          { operation: 'patchSWR' }
        > => pendingRequest.operation === 'patchSWR',
      );
    const patchChars = [...patchRequests, request].reduce(
      (total, patchRequest) =>
        total +
        (patchRequest.operation === 'patchSWR'
          ? (patchRequest.patch.clearBefore === undefined ? 0 : 16) +
            patchRequest.patch.removePrefixes.reduce(
              (subtotal, item) => subtotal + item.prefix.length + 16,
              0,
            ) +
            patchRequest.patch.removals.reduce(
              (subtotal, item) => subtotal + item[0].length + 16,
              0,
            ) +
            patchRequest.patch.updates.reduce(
              (subtotal, item) =>
                subtotal + item[0].length + item[1].length + 8,
              0,
            )
          : 0),
      0,
    );
    const shouldCompact =
      eligiblePending.some(([, pending]) => pending.isSWRCompactionSnapshot) ||
      patchRequests.length + 1 > SWR_PATCH_COMPACTION_MAX_PENDING ||
      patchChars > SWR_PATCH_COMPACTION_MAX_CHARS;
    if (!shouldCompact) {
      return { baselineValue, mutation, request };
    }

    const oldestBaseline =
      eligiblePending.find(
        ([, pending]) => pending.baselineValue !== undefined,
      )?.[1].baselineValue ?? baselineValue;
    const supersededMutationIds = eligiblePending.map(
      ([mutationId]) => mutationId,
    );
    eligiblePending.forEach(([mutationId]) => queue.pending.delete(mutationId));
    const currentValue = mirrors.coldStart.values.get(SWR_CACHE_KEY);
    const serializedValue =
      typeof currentValue === 'string' ? currentValue : '{}';
    return {
      baselineValue: oldestBaseline,
      isSWRCompactionSnapshot: true,
      mutation: {
        operation: 'set' as const,
        key: SWR_CACHE_KEY,
        value: serializedValue,
      },
      request: {
        scope: 'syncStorage' as const,
        operation: 'set' as const,
        store: 'coldStart' as const,
        key: SWR_CACHE_KEY,
        value: serializedValue,
        ...(oldestBaseline === undefined
          ? {}
          : { previousValue: oldestBaseline }),
      },
      supersededMutationIds,
    };
  }

  let superseded: Array<[number, IPendingRemoteMutation]> = [];
  queue.pending.forEach((pending, mutationId) => {
    if (pending.mutation.operation === 'clear') {
      superseded = [];
      return;
    }
    if (
      mutationId !== queue.inFlightMutationId &&
      'key' in pending.mutation &&
      pending.mutation.key === mutation.key
    ) {
      superseded.push([mutationId, pending]);
    }
  });
  if (superseded.length === 0) {
    return { baselineValue, mutation, request };
  }

  let compactedRequest = request;
  if (request.operation === 'set') {
    const firstRequest = superseded[0][1].request;
    const setRequest = { ...request };
    if (
      firstRequest.operation === 'set' &&
      Object.prototype.hasOwnProperty.call(firstRequest, 'previousValue')
    ) {
      setRequest.previousValue = firstRequest.previousValue;
    } else {
      delete setRequest.previousValue;
    }
    compactedRequest = setRequest;
  }
  superseded.forEach(([mutationId]) => queue.pending.delete(mutationId));
  return {
    baselineValue: superseded[0][1].baselineValue ?? baselineValue,
    mutation,
    request: compactedRequest,
    supersededMutationIds: superseded.map(([mutationId]) => mutationId),
  };
}

function createMutationAcknowledgement(
  queue: IRemoteMutationQueue,
  mutationId: number,
) {
  let resolveAcknowledgement: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolveAcknowledgement = resolve;
  });
  queue.acknowledgementWaiters.set(mutationId, {
    promise,
    resolve: () => resolveAcknowledgement?.(),
  });
  return promise;
}

function resolveMutationAcknowledgements(
  queue: IRemoteMutationQueue,
  mutationId: number,
) {
  const pendingIds = [mutationId];
  while (pendingIds.length > 0) {
    const currentId = pendingIds.pop();
    if (currentId !== undefined) {
      const superseded = queue.supersededMutationIds.get(currentId);
      queue.supersededMutationIds.delete(currentId);
      if (superseded) {
        pendingIds.push(...superseded);
      }
      queue.acknowledgementWaiters.get(currentId)?.resolve();
      queue.acknowledgementWaiters.delete(currentId);
    }
  }
}

function getNativeStorageGlobal() {
  return globalThis as INativeStorageGlobal;
}

function isNativeStorageTransportReady() {
  return (
    getNativeStorageGlobal().__onekeyNativeStorageIsTransportReady?.() ?? true
  );
}

function getOldestRequestAgeMs(queue: IRemoteMutationQueue) {
  const first = queue.pending.values().next().value as
    | IPendingRemoteMutation
    | undefined;
  return first ? Math.max(0, Date.now() - first.enqueuedAt) : 0;
}

function refreshQueueDiagnosticMeasurements(queue: IRemoteMutationQueue) {
  const diagnostics = queue.diagnostics;
  diagnostics.maxQueueSize = Math.max(
    diagnostics.maxQueueSize,
    queue.pending.size,
  );
  diagnostics.maxOldestRequestAgeMs = Math.max(
    diagnostics.maxOldestRequestAgeMs,
    getOldestRequestAgeMs(queue),
  );
}

function emitQueueDiagnostic(
  store: INativeSyncStorageName,
  eventType: 'degraded' | 'recovered' | 'stalled',
  stallThresholdMs?: number,
) {
  const queue = remoteMutationQueues[store];
  const diagnostics = queue.diagnostics;
  refreshQueueDiagnosticMeasurements(queue);
  try {
    defaultLogger.app.background.nativeStorageQueueState({
      errorType: diagnostics.errorType,
      eventType,
      failedAttemptCount: diagnostics.failedAttemptCount,
      maxOldestRequestAgeMs: diagnostics.maxOldestRequestAgeMs,
      maxQueueSize: diagnostics.maxQueueSize,
      pendingQueueSize: queue.pending.size,
      stallDurationMs:
        diagnostics.degradedAt === undefined
          ? 0
          : Math.max(0, Date.now() - diagnostics.degradedAt),
      ...(stallThresholdMs === undefined ? {} : { stallThresholdMs }),
      store,
    });
  } catch {
    // Diagnostics must never change storage persistence behavior.
  }
}

function scheduleQueueStallDiagnostic(store: INativeSyncStorageName) {
  const queue = remoteMutationQueues[store];
  const diagnostics = queue.diagnostics;
  if (
    diagnostics.stallTimer !== undefined ||
    diagnostics.degradedAt === undefined ||
    diagnostics.nextStallThresholdIndex >= QUEUE_STALL_THRESHOLDS_MS.length
  ) {
    return;
  }

  const thresholdMs =
    QUEUE_STALL_THRESHOLDS_MS[diagnostics.nextStallThresholdIndex];
  const elapsedMs = Date.now() - diagnostics.degradedAt;
  diagnostics.stallTimer = setTimeout(
    () => {
      diagnostics.stallTimer = undefined;
      if (diagnostics.degradedAt === undefined || queue.pending.size === 0) {
        return;
      }
      diagnostics.nextStallThresholdIndex += 1;
      if (
        !diagnostics.isReportingEpisode &&
        (diagnostics.lastReportedEpisodeEndedAt === undefined ||
          Date.now() - diagnostics.lastReportedEpisodeEndedAt >=
            QUEUE_DIAGNOSTIC_EPISODE_COOLDOWN_MS)
      ) {
        diagnostics.isReportingEpisode = true;
      }
      if (diagnostics.isReportingEpisode) {
        emitQueueDiagnostic(store, 'stalled', thresholdMs);
      }
      scheduleQueueStallDiagnostic(store);
    },
    Math.max(0, thresholdMs - elapsedMs),
  );
}

function beginQueueDegradation({
  didFailRequest,
  errorType,
  store,
}: {
  didFailRequest: boolean;
  errorType: string;
  store: INativeSyncStorageName;
}) {
  const queue = remoteMutationQueues[store];
  const diagnostics = queue.diagnostics;
  diagnostics.errorType = errorType;
  if (didFailRequest) {
    diagnostics.failedAttemptCount += 1;
  }
  refreshQueueDiagnosticMeasurements(queue);
  if (diagnostics.degradedAt !== undefined) {
    if (didFailRequest && !diagnostics.isReportingEpisode) {
      const now = Date.now();
      diagnostics.isReportingEpisode =
        diagnostics.lastReportedEpisodeEndedAt === undefined ||
        now - diagnostics.lastReportedEpisodeEndedAt >=
          QUEUE_DIAGNOSTIC_EPISODE_COOLDOWN_MS;
      if (diagnostics.isReportingEpisode) {
        const elapsedMs = now - diagnostics.degradedAt;
        const nextThresholdIndex = QUEUE_STALL_THRESHOLDS_MS.findIndex(
          (thresholdMs) => thresholdMs > elapsedMs,
        );
        diagnostics.nextStallThresholdIndex =
          nextThresholdIndex === -1
            ? QUEUE_STALL_THRESHOLDS_MS.length
            : nextThresholdIndex;
        emitQueueDiagnostic(store, 'degraded');
        scheduleQueueStallDiagnostic(store);
      }
    }
    return;
  }

  const now = Date.now();
  diagnostics.degradedAt = now;
  diagnostics.isReportingEpisode =
    didFailRequest &&
    (diagnostics.lastReportedEpisodeEndedAt === undefined ||
      now - diagnostics.lastReportedEpisodeEndedAt >=
        QUEUE_DIAGNOSTIC_EPISODE_COOLDOWN_MS);
  diagnostics.maxOldestRequestAgeMs = getOldestRequestAgeMs(queue);
  diagnostics.maxQueueSize = queue.pending.size;
  diagnostics.nextStallThresholdIndex = 0;
  if (diagnostics.isReportingEpisode) {
    emitQueueDiagnostic(store, 'degraded');
    scheduleQueueStallDiagnostic(store);
  }
}

function completeQueueDegradation(store: INativeSyncStorageName) {
  const queue = remoteMutationQueues[store];
  const diagnostics = queue.diagnostics;
  if (diagnostics.degradedAt === undefined) {
    return;
  }
  if (diagnostics.stallTimer !== undefined) {
    clearTimeout(diagnostics.stallTimer);
    diagnostics.stallTimer = undefined;
  }
  if (diagnostics.isReportingEpisode) {
    emitQueueDiagnostic(store, 'recovered');
    diagnostics.lastReportedEpisodeEndedAt = Date.now();
  }
  diagnostics.degradedAt = undefined;
  diagnostics.errorType = 'unknown';
  diagnostics.failedAttemptCount = 0;
  diagnostics.isReportingEpisode = false;
  diagnostics.maxOldestRequestAgeMs = 0;
  diagnostics.maxQueueSize = 0;
  diagnostics.nextStallThresholdIndex = 0;
}

function getRemoteMutationRetryDelayMs(attempt: number) {
  const exponentialDelay = Math.min(
    MUTATION_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    MUTATION_RETRY_MAX_DELAY_MS,
  );
  const jitterMultiplier =
    1 + (Math.random() * 2 - 1) * MUTATION_RETRY_JITTER_RATIO;
  return Math.min(
    MUTATION_RETRY_MAX_DELAY_MS,
    Math.round(exponentialDelay * jitterMultiplier),
  );
}

function clearRemoteMutationRetryTimer(queue: IRemoteMutationQueue) {
  if (queue.retryTimer !== undefined) {
    clearTimeout(queue.retryTimer);
    queue.retryTimer = undefined;
  }
}

function scheduleRemoteMutationRetry(store: INativeSyncStorageName) {
  const queue = remoteMutationQueues[store];
  if (queue.retryTimer !== undefined || !isNativeStorageTransportReady()) {
    return;
  }
  const delayMs = getRemoteMutationRetryDelayMs(queue.retryAttempt);
  queue.retryTimer = setTimeout(() => {
    queue.retryTimer = undefined;
    void drainRemoteMutations(store);
  }, delayMs);
}

function drainRemoteMutations(store: INativeSyncStorageName) {
  const queue = remoteMutationQueues[store];
  if (queue.drainActive) {
    return queue.drainPromise;
  }
  if (queue.pending.size === 0) {
    completeQueueDegradation(store);
    return queue.drainPromise;
  }
  if (!isNativeStorageTransportReady()) {
    beginQueueDegradation({
      didFailRequest: false,
      errorType: 'transport-not-ready',
      store,
    });
    return queue.drainPromise;
  }
  clearRemoteMutationRetryTimer(queue);
  queue.drainActive = true;
  queue.drainPromise = (async () => {
    while (queue.pending.size > 0) {
      if (!isNativeStorageTransportReady()) {
        beginQueueDegradation({
          didFailRequest: false,
          errorType: 'transport-not-ready',
          store,
        });
        return;
      }
      const first = queue.pending.entries().next().value as
        | [number, IPendingRemoteMutation]
        | undefined;
      if (!first) {
        return;
      }
      const [mutationId, { request }] = first;
      queue.inFlightMutationId = mutationId;
      try {
        const response = await callNativeStorage<unknown>(request);
        acknowledgeRemoteMutation(store, mutationId, response);
        queue.retryAttempt = 0;
      } catch (error) {
        queue.retryAttempt += 1;
        beginQueueDegradation({
          didFailRequest: true,
          errorType: error instanceof Error ? error.name : typeof error,
          store,
        });
        scheduleRemoteMutationRetry(store);
        return;
      } finally {
        if (queue.inFlightMutationId === mutationId) {
          queue.inFlightMutationId = undefined;
        }
      }
    }
    completeQueueDegradation(store);
  })().finally(() => {
    queue.drainActive = false;
  });
  return queue.drainPromise;
}

function enqueueRemoteMutation(
  store: INativeSyncStorageName,
  mutation: INativeSyncStorageLocalMutation,
  request: INativeSyncStorageRequest,
  baselineValue?: string,
) {
  const queue = remoteMutationQueues[store];
  const compacted = compactPendingRemoteMutations({
    baselineValue,
    mutation,
    queue,
    request,
  });
  const mutationId = (mutationSequence += 1);
  const acknowledgement = createMutationAcknowledgement(queue, mutationId);
  const requestWithMutationId: INativeSyncStorageRequest = {
    ...compacted.request,
    sourceMutationId: mutationId,
    sourceRuntimeId: mutationRuntimeId,
  };
  queue.pending.set(mutationId, {
    baselineValue: compacted.baselineValue,
    enqueuedAt: Date.now(),
    isSWRCompactionSnapshot: compacted.isSWRCompactionSnapshot,
    mutation: compacted.mutation,
    request: requestWithMutationId,
  });
  if (compacted.supersededMutationIds?.length) {
    queue.supersededMutationIds.set(
      mutationId,
      compacted.supersededMutationIds,
    );
  }
  if (queue.diagnostics.degradedAt !== undefined) {
    refreshQueueDiagnosticMeasurements(queue);
  }
  void drainRemoteMutations(store);
  return acknowledgement;
}

function replayPendingRemoteMutations() {
  NATIVE_SYNC_STORAGE_NAMES.forEach((store) => {
    void drainRemoteMutations(store);
  });
}

function replayPendingLocalMutations(store: INativeSyncStorageName) {
  const state = mirrors[store];
  remoteMutationQueues[store].pending.forEach((pending) => {
    if (!bootstrapComplete) {
      appendCompactedLocalMutation(
        state.mutationsBeforeBootstrap,
        pending.mutation,
      );
    }
    applyLocalMutation(state, pending.mutation);
  });
}

function applyCanonicalMutation(mutation: INativeSyncStorageMutation) {
  const state = mirrors[mutation.store];
  let localMutation: INativeSyncStorageLocalMutation;
  if (mutation.operation === 'set') {
    localMutation = {
      operation: 'set',
      key: mutation.key,
      value: mutation.value,
    };
  } else if (mutation.operation === 'patchSWR') {
    localMutation = {
      operation: 'patchSWR',
      entries: mutation.entries,
    };
  } else if (mutation.operation === 'remove') {
    localMutation = { operation: 'remove', key: mutation.key };
  } else {
    localMutation = { operation: 'clear' };
  }
  if (!bootstrapComplete) {
    appendCompactedLocalMutation(state.mutationsBeforeBootstrap, localMutation);
  }
  applyLocalMutation(state, localMutation);
  replayPendingLocalMutations(mutation.store);
}

function acknowledgeRemoteMutation(
  store: INativeSyncStorageName,
  mutationId: number,
  response: unknown,
) {
  const queue = remoteMutationQueues[store];
  const pending = queue.pending.get(mutationId);
  const canonical = parseNativeSyncStorageMutation(response);
  if (
    !pending ||
    !canonical ||
    canonical.sourceMutationId !== mutationId ||
    canonical.store !== store
  ) {
    throw new OneKeyLocalError(
      'Native sync storage returned an invalid mutation acknowledgement',
    );
  }
  queue.pending.delete(mutationId);
  resolveMutationAcknowledgements(queue, mutationId);
  applyCanonicalMutation(canonical);
}

function mutate(
  store: INativeSyncStorageName,
  mutation: INativeSyncStorageLocalMutation,
  request: INativeSyncStorageRequest,
  baselineValue?: string,
) {
  const state = mirrors[store];
  if (!bootstrapComplete) {
    appendCompactedLocalMutation(state.mutationsBeforeBootstrap, mutation);
  }
  applyLocalMutation(state, mutation);
  return enqueueRemoteMutation(store, mutation, request, baselineValue);
}

function applyBroadcastMutation(mutation: INativeSyncStorageMutation) {
  applyCanonicalMutation(mutation);
}

(globalThis as INativeStorageGlobal).__onekeyNativeSyncStorageApplyMutation =
  applyBroadcastMutation;

getNativeStorageGlobal().__onekeyNativeSyncStorageTransportReady = () => {
  NATIVE_SYNC_STORAGE_NAMES.forEach((store) => {
    const queue = remoteMutationQueues[store];
    queue.retryAttempt = 0;
    clearRemoteMutationRetryTimer(queue);
    void drainRemoteMutations(store);
  });
};

export function createNativeSyncStorageMirror(store: INativeSyncStorageName) {
  const state = mirrors[store];
  const mirror = {
    getString(key: string) {
      const value = state.values.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getNumber(key: string) {
      const value = state.values.get(key);
      return typeof value === 'number' ? value : undefined;
    },
    getBoolean(key: string) {
      const value = state.values.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    set(key: string, value: INativeStorageScalar) {
      const previousValue = state.values.get(key);
      return mutate(
        store,
        { operation: 'set', key, value },
        {
          scope: 'syncStorage',
          operation: 'set',
          store,
          key,
          value,
          ...(previousValue === undefined ? {} : { previousValue }),
        },
        store === 'coldStart' &&
          key === SWR_CACHE_KEY &&
          typeof previousValue === 'string'
          ? previousValue
          : undefined,
      );
    },
    remove(key: string) {
      const previousValue = state.values.get(key);
      return mutate(
        store,
        { operation: 'remove', key },
        { scope: 'syncStorage', operation: 'remove', store, key },
        store === 'coldStart' &&
          key === SWR_CACHE_KEY &&
          typeof previousValue === 'string'
          ? previousValue
          : undefined,
      );
    },
    clearAll() {
      return mutate(
        store,
        { operation: 'clear' },
        { scope: 'syncStorage', operation: 'clear', store },
      );
    },
    getAllKeys() {
      return [...state.values.keys()];
    },
  };
  return {
    ...mirror,
    ...(store === 'coldStart'
      ? {
          applySWRCachePatch(patch: INativeSWRCachePatchIntent) {
            const current = state.values.get(SWR_CACHE_KEY);
            const optimistic = applyNativeSWRCachePatchToSerializedStore(
              typeof current === 'string' ? current : undefined,
              patch,
            );
            return mutate(
              'coldStart',
              { operation: 'patchSWR', entries: optimistic.entries },
              {
                scope: 'syncStorage',
                operation: 'patchSWR',
                store: 'coldStart',
                patch,
              },
              typeof current === 'string' ? current : '{}',
            );
          },
        }
      : {}),
  };
}

function primeMirror(
  store: INativeSyncStorageName,
  entries: INativeStorageBootstrapSnapshot[INativeSyncStorageName],
) {
  const state = mirrors[store];
  state.values.clear();
  for (const [key, value] of entries) {
    state.values.set(key, value);
  }
  for (const mutation of state.mutationsBeforeBootstrap) {
    applyLocalMutation(state, mutation);
  }
  state.mutationsBeforeBootstrap = [];
}

function startBootstrap(force: boolean) {
  if (!force && bootstrapPromise) {
    return bootstrapPromise;
  }
  if (force) {
    bootstrapComplete = false;
    NATIVE_SYNC_STORAGE_NAMES.forEach((store) => {
      remoteMutationQueues[store].pending.forEach(({ mutation }) => {
        appendCompactedLocalMutation(
          mirrors[store].mutationsBeforeBootstrap,
          mutation,
        );
      });
    });
  }
  const generation = (bootstrapGeneration += 1);
  const nextPromise = callNativeStorage<INativeStorageBootstrapSnapshot>({
    scope: 'bootstrap',
  })
    .then((snapshot) => {
      if (generation !== bootstrapGeneration) {
        return bootstrapPromise;
      }
      primeMirror('settings', snapshot.settings);
      primeMirror('coldStart', snapshot.coldStart);
      primeMirror('devSettings', snapshot.devSettings);
      bootstrapComplete = true;
      replayPendingRemoteMutations();
    })
    .catch((error: unknown) => {
      if (generation !== bootstrapGeneration && bootstrapPromise) {
        return bootstrapPromise;
      }
      if (generation === bootstrapGeneration) {
        bootstrapPromise = undefined;
      }
      throw error;
    });
  bootstrapPromise = nextPromise;
  return bootstrapPromise;
}

export function bootstrapNativeSyncStorageMirrors() {
  return startBootstrap(false);
}

export function refreshNativeSyncStorageMirrors() {
  return startBootstrap(true);
}

export function waitForNativeSyncStorageMutations() {
  return Promise.all(
    NATIVE_SYNC_STORAGE_NAMES.map(
      (store) => remoteMutationQueues[store].drainPromise,
    ),
  ).then(() => undefined);
}

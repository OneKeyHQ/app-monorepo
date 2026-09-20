import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';
import { SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS } from '../../utils/swrCacheLimits';
import { callNativeStorage } from '../nativeStorageBridge';
import { parseNativeSyncStorageMutation } from '../nativeStorageTypes';
import {
  applyNativeSWRCacheCanonicalEntries,
  applyNativeSWRCachePatchToSerializedStore,
} from '../nativeSWRCachePersistence';

import { appendCompactedLocalMutation } from './nativeSyncStorageReplayBuffer';

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

type IMutationAcknowledgement = {
  promise: Promise<void>;
  resolve: () => void;
};

type IBootstrapAttempt = {
  reject: (error: Error) => void;
  replayError?: Error;
};

type IPendingRemoteMutation = {
  acknowledgements: IMutationAcknowledgement[];
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
  diagnostics: IQueueDiagnostics;
  drainActive: boolean;
  drainPromise: Promise<void>;
  inFlightMutationId: number | undefined;
  pending: Map<number, IPendingRemoteMutation>;
  retryAttempt: number;
  retryTimer: ReturnType<typeof setTimeout> | undefined;
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

let hasBootstrapSnapshot = false;
let collectBootstrapMutations = true;
let bootstrapRetryTimer: ReturnType<typeof setTimeout> | undefined;
let bootstrapRetryAttempt = 0;
let bootstrapRetryNeeded = false;
let bootstrapAttempt: IBootstrapAttempt | undefined;
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

function recordBootstrapMutation(
  state: IMirrorState,
  mutation: INativeSyncStorageLocalMutation,
) {
  if (!collectBootstrapMutations) return;
  if (!appendCompactedLocalMutation(state.mutationsBeforeBootstrap, mutation)) {
    // Never apply a snapshot whose intervening updates exceeded the budget.
    // The live mirror and durable-write queue remain intact for the retry.
    collectBootstrapMutations = false;
    NATIVE_SYNC_STORAGE_NAMES.forEach((store) => {
      mirrors[store].mutationsBeforeBootstrap = [];
    });
    const error = new OneKeyLocalError(
      'Native storage snapshot replay budget exceeded',
    );
    if (bootstrapAttempt) {
      bootstrapAttempt.replayError = error;
      bootstrapAttempt.reject(error);
    }
  }
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
    const acknowledgements: IMutationAcknowledgement[] = [];
    queue.pending.forEach((pending, mutationId) => {
      if (mutationId !== queue.inFlightMutationId) {
        acknowledgements.push(...pending.acknowledgements);
        queue.pending.delete(mutationId);
      }
    });
    return { mutation, request, acknowledgements };
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
    const acknowledgements = eligiblePending.flatMap(
      ([, pending]) => pending.acknowledgements,
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
      acknowledgements,
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
    acknowledgements: superseded.flatMap(
      ([, pending]) => pending.acknowledgements,
    ),
  };
}

function createMutationAcknowledgement(): IMutationAcknowledgement {
  let resolveAcknowledgement: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolveAcknowledgement = resolve;
  });
  return { promise, resolve: () => resolveAcknowledgement?.() };
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
  // Superseded callers already wait for the same final durable write. Reuse
  // those groups instead of retaining one promise and ID link per overwrite.
  const acknowledgements = compacted.acknowledgements?.length
    ? compacted.acknowledgements
    : [createMutationAcknowledgement()];
  const requestWithMutationId: INativeSyncStorageRequest = {
    ...compacted.request,
    sourceMutationId: mutationId,
    sourceRuntimeId: mutationRuntimeId,
  };
  queue.pending.set(mutationId, {
    acknowledgements,
    baselineValue: compacted.baselineValue,
    enqueuedAt: Date.now(),
    isSWRCompactionSnapshot: compacted.isSWRCompactionSnapshot,
    mutation: compacted.mutation,
    request: requestWithMutationId,
  });
  if (queue.diagnostics.degradedAt !== undefined) {
    refreshQueueDiagnosticMeasurements(queue);
  }
  void drainRemoteMutations(store);
  return acknowledgements[0].promise;
}

function replayPendingRemoteMutations() {
  NATIVE_SYNC_STORAGE_NAMES.forEach((store) => {
    void drainRemoteMutations(store);
  });
}

function replayPendingLocalMutations(store: INativeSyncStorageName) {
  const state = mirrors[store];
  remoteMutationQueues[store].pending.forEach((pending) => {
    recordBootstrapMutation(state, pending.mutation);
    applyLocalMutation(state, pending.mutation);
  });
}

function perfNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function applyCanonicalMutation(
  mutation: INativeSyncStorageMutation,
  source: 'ack' | 'broadcast',
) {
  const startedAt = perfNow();
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
  recordBootstrapMutation(state, localMutation);
  applyLocalMutation(state, localMutation);
  replayPendingLocalMutations(mutation.store);
  // Every SWR patch here, replays included, re-serializes the whole store.
  const durationMs = Math.round(perfNow() - startedAt);
  if (durationMs >= SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS) {
    const swrStore = state.values.get(SWR_CACHE_KEY);
    defaultLogger.app.perf.swrCacheSlowOp({
      op: 'mirrorApply',
      durationMs,
      storeChars: typeof swrStore === 'string' ? swrStore.length : 0,
      source,
      mutationOp: mutation.operation,
      replayedCount: remoteMutationQueues[mutation.store].pending.size,
    });
  }
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
  pending.acknowledgements.forEach((acknowledgement) =>
    acknowledgement.resolve(),
  );
  applyCanonicalMutation(canonical, 'ack');
}

function mutate(
  store: INativeSyncStorageName,
  mutation: INativeSyncStorageLocalMutation,
  request: INativeSyncStorageRequest,
  baselineValue?: string,
) {
  const state = mirrors[store];
  recordBootstrapMutation(state, mutation);
  applyLocalMutation(state, mutation);
  return enqueueRemoteMutation(store, mutation, request, baselineValue);
}

function applyBroadcastMutation(mutation: INativeSyncStorageMutation) {
  applyCanonicalMutation(mutation, 'broadcast');
}

(globalThis as INativeStorageGlobal).__onekeyNativeSyncStorageApplyMutation =
  applyBroadcastMutation;

getNativeStorageGlobal().__onekeyNativeSyncStorageTransportReady = () => {
  scheduleBootstrapRetry();
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
  replayPendingLocalMutations(store);
}

function clearBootstrapRetryTimer() {
  if (bootstrapRetryTimer !== undefined) {
    clearTimeout(bootstrapRetryTimer);
    bootstrapRetryTimer = undefined;
  }
}

function scheduleBootstrapRetry() {
  if (
    !bootstrapRetryNeeded ||
    bootstrapRetryTimer !== undefined ||
    !isNativeStorageTransportReady()
  )
    return;
  bootstrapRetryTimer = setTimeout(() => {
    bootstrapRetryTimer = undefined;
    if (!isNativeStorageTransportReady()) return;
    void startBootstrap(true).catch(() => undefined);
  }, getRemoteMutationRetryDelayMs(bootstrapRetryAttempt));
}

function startBootstrap(force: boolean) {
  if (!force && bootstrapPromise) return bootstrapPromise;
  clearBootstrapRetryTimer();
  bootstrapRetryNeeded = false;
  const generation = (bootstrapGeneration += 1);
  bootstrapAttempt?.reject(
    new OneKeyLocalError('Native storage snapshot superseded'),
  );
  let rejectReplay: (error: Error) => void = () => undefined;
  const replayFailure = new Promise<never>((_resolve, reject) => {
    rejectReplay = reject;
  });
  const attempt: IBootstrapAttempt = { reject: rejectReplay };
  bootstrapAttempt = attempt;
  collectBootstrapMutations = true;
  if (force) {
    NATIVE_SYNC_STORAGE_NAMES.forEach((store) => {
      mirrors[store].mutationsBeforeBootstrap = [];
    });
  }
  const nextPromise = Promise.race([
    callNativeStorage<INativeStorageBootstrapSnapshot>({ scope: 'bootstrap' }),
    replayFailure,
  ])
    .then((snapshot) => {
      if (generation !== bootstrapGeneration) return bootstrapPromise;
      if (attempt.replayError) throw attempt.replayError;
      // Pending local writes are still present in their remote queues. They
      // are replayed by primeMirror after the snapshot and are not counted
      // against the snapshot replay budget before it can be applied.
      collectBootstrapMutations = false;
      primeMirror('settings', snapshot.settings);
      primeMirror('coldStart', snapshot.coldStart);
      primeMirror('devSettings', snapshot.devSettings);
      hasBootstrapSnapshot = true;
      bootstrapAttempt = undefined;
      bootstrapRetryAttempt = 0;
      replayPendingRemoteMutations();
    })
    .catch((error: unknown) => {
      if (generation !== bootstrapGeneration) {
        if (bootstrapPromise) return bootstrapPromise;
        throw error;
      }
      bootstrapPromise = undefined;
      bootstrapAttempt = undefined;
      collectBootstrapMutations = false;
      NATIVE_SYNC_STORAGE_NAMES.forEach((store) => {
        mirrors[store].mutationsBeforeBootstrap = [];
      });
      // Initial startup keeps its existing error/retry UI. A running app keeps
      // its last usable mirror and retries refresh without retaining history.
      if (hasBootstrapSnapshot) {
        bootstrapRetryNeeded = true;
        bootstrapRetryAttempt += 1;
        scheduleBootstrapRetry();
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

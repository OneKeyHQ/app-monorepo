import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';
import { SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS } from '../../utils/swrCacheLimits';
import { callNativeStorage } from '../nativeStorageBridge';
import { parseNativeSyncStorageMutation } from '../nativeStorageTypes';

import type {
  INativeStorageBootstrapSnapshot,
  INativeStorageGlobal,
  INativeStorageScalar,
  INativeSyncStorageEntry,
  INativeSyncStorageLocalMutation,
  INativeSyncStorageMutation,
  INativeSyncStorageName,
  INativeSyncStorageRequest,
} from '../nativeStorageTypes';

type IMirrorState = {
  values: Map<string, INativeStorageScalar>;
  mutationsBeforeBootstrap: INativeSyncStorageLocalMutation[];
};

type ICompactedRemoteMutation = {
  mutation: INativeSyncStorageLocalMutation;
  request: INativeSyncStorageRequest;
  supersededMutationIds?: number[];
};

type IPendingRemoteMutation = {
  enqueuedAt: number;
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
  'devSettings',
];

const MUTATION_RETRY_BASE_DELAY_MS = 500;
const MUTATION_RETRY_MAX_DELAY_MS = 30_000;
const MUTATION_RETRY_JITTER_RATIO = 0.2;
const QUEUE_DIAGNOSTIC_EPISODE_COOLDOWN_MS = 10 * 60_000;
const QUEUE_STALL_THRESHOLDS_MS = [30_000, 5 * 60_000, 30 * 60_000];

function createMirrorState(): IMirrorState {
  return {
    values: new Map(),
    mutationsBeforeBootstrap: [],
  };
}

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
  settings: createMirrorState(),
  devSettings: createMirrorState(),
};

const remoteMutationQueues: Record<
  INativeSyncStorageName,
  IRemoteMutationQueue
> = {
  settings: createRemoteMutationQueue(),
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
  mutation,
  queue,
  request,
}: {
  mutation: INativeSyncStorageLocalMutation;
  queue: IRemoteMutationQueue;
  request: INativeSyncStorageRequest;
}): ICompactedRemoteMutation {
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
    return { mutation, request };
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
) {
  const queue = remoteMutationQueues[store];
  const compacted = compactPendingRemoteMutations({
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
    enqueuedAt: Date.now(),
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
  const durationMs = Math.round(perfNow() - startedAt);
  if (durationMs >= SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS) {
    defaultLogger.app.perf.swrCacheSlowOp({
      op: 'mirrorApply',
      durationMs,
      storeChars: 0,
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
  resolveMutationAcknowledgements(queue, mutationId);
  applyCanonicalMutation(canonical, 'ack');
}

function mutate(
  store: INativeSyncStorageName,
  mutation: INativeSyncStorageLocalMutation,
  request: INativeSyncStorageRequest,
) {
  const state = mirrors[store];
  if (!bootstrapComplete) {
    appendCompactedLocalMutation(state.mutationsBeforeBootstrap, mutation);
  }
  applyLocalMutation(state, mutation);
  return enqueueRemoteMutation(store, mutation, request);
}

function applyBroadcastMutation(mutation: INativeSyncStorageMutation) {
  applyCanonicalMutation(mutation, 'broadcast');
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
      );
    },
    remove(key: string) {
      return mutate(
        store,
        { operation: 'remove', key },
        { scope: 'syncStorage', operation: 'remove', store, key },
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
  return mirror;
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

/** What the blocking half of cold start actually spent, split into the wait
 *  on bg and this runtime's own work, with the payload that crossed. */
function logBootstrapTiming({
  requestedAt,
  receivedAt,
  snapshot,
}: {
  requestedAt: number;
  receivedAt: number;
  snapshot: INativeStorageBootstrapSnapshot;
}) {
  try {
    const entryChars = (entries: INativeSyncStorageEntry[] = []) =>
      entries.reduce(
        (total, [key, value]) => total + key.length + String(value).length,
        0,
      );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeLogger, LogLevel } =
      require('../../modules3rdParty/react-native-file-logger') as typeof import('../../modules3rdParty/react-native-file-logger');
    NativeLogger.write(
      LogLevel.Info,
      [
        '[StartupTiming] storage bootstrap snapshot:',
        `bg round trip ${receivedAt - requestedAt}ms,`,
        `apply ${Date.now() - receivedAt}ms,`,
        `settings ${snapshot.settings?.length ?? 0} entries/${entryChars(snapshot.settings)} chars,`,
        `devSettings ${snapshot.devSettings?.length ?? 0} entries/${entryChars(snapshot.devSettings)} chars`,
      ].join(' '),
    );
  } catch {
    // Logging is best-effort during bootstrap.
  }
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
  const requestedAt = Date.now();
  const nextPromise = callNativeStorage<INativeStorageBootstrapSnapshot>({
    scope: 'bootstrap',
    stores: NATIVE_SYNC_STORAGE_NAMES,
  })
    .then((snapshot) => {
      if (generation !== bootstrapGeneration) {
        return bootstrapPromise;
      }
      const receivedAt = Date.now();
      primeMirror('settings', snapshot.settings);
      primeMirror('devSettings', snapshot.devSettings);
      bootstrapComplete = true;
      replayPendingRemoteMutations();
      logBootstrapTiming({
        requestedAt,
        receivedAt,
        snapshot,
      });
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

/**
 * Whether the mirrors hold bg's snapshot yet.
 *
 * Until they do they answer nothing, which is what a reader consults before
 * falling back to the file. Once they do they are authoritative and must be
 * preferred: they carry this runtime's own pending writes and deletions,
 * which the file has not seen.
 */
export function isNativeSyncStorageMirrorBootstrapped() {
  return bootstrapComplete;
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

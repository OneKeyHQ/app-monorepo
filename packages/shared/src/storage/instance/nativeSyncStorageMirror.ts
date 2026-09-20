/* cspell:ignore ISWR */
import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';
import {
  SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS,
  isValidSWRCacheKey,
} from '../../utils/swrCacheLimits';
import { callNativeStorage } from '../nativeStorageBridge';
import { parseNativeSyncStorageMutation } from '../nativeStorageTypes';

import { appendCompactedLocalMutation } from './nativeSyncStorageReplayBuffer';

import type {
  INativeSWRCacheCanonicalEntry,
  INativeSWRCacheEntriesListener,
  INativeSWRCachePatchIntent,
  INativeSWRCacheSerializedEntry,
  INativeStorageBootstrapSnapshot,
  INativeStorageGlobal,
  INativeStorageScalar,
  INativeSyncStorageLocalMutation,
  INativeSyncStorageMutation,
  INativeSyncStorageName,
  INativeSyncStorageRequest,
} from '../nativeStorageTypes';

type ISWRMirrorEntry = { serialized: string; t: number };

type IMirrorState = {
  values: Map<string, INativeStorageScalar>;
  // The cold-start SWR store stays one entry per key. Patches, replays and
  // compaction touch only the keys they name; nothing re-serializes the store.
  swrEntries: Map<string, ISWRMirrorEntry>;
  swrPairChars: number;
  mutationsBeforeBootstrap: INativeSyncStorageLocalMutation[];
};

type ISWRPatchMutationPair = {
  mutation: Extract<INativeSyncStorageLocalMutation, { operation: 'patchSWR' }>;
  request: Extract<INativeSyncStorageRequest, { operation: 'patchSWR' }>;
};

type IMutationAcknowledgement = {
  promise: Promise<void>;
  resolve: () => void;
};

type ICompactedRemoteMutation = {
  acknowledgements?: IMutationAcknowledgement[];
  isSWRMergedPatch?: boolean;
  mutation: INativeSyncStorageLocalMutation;
  request: INativeSyncStorageRequest;
};

type IBootstrapAttempt = {
  reject: (error: Error) => void;
  replayError?: Error;
};

type IPendingRemoteMutation = {
  acknowledgements: IMutationAcknowledgement[];
  enqueuedAt: number;
  isSWRMergedPatch?: boolean;
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

// `JSON.stringify({ d, t })` ends every entry this way; other shapes fall
// back to a parse.
const SWR_ENTRY_TIMESTAMP_TAIL = /,"t":(\d{1,16})\}$/;

const swrEntryListeners = new Set<INativeSWRCacheEntriesListener>();

function createMirrorState(): IMirrorState {
  return {
    values: new Map(),
    swrEntries: new Map(),
    swrPairChars: 0,
    mutationsBeforeBootstrap: [],
  };
}

function readSWREntryTimestamp(serialized: string): number | undefined {
  const tail = SWR_ENTRY_TIMESTAMP_TAIL.exec(serialized.slice(-24));
  if (tail) {
    const t = Number(tail[1]);
    return Number.isSafeInteger(t) ? t : undefined;
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const t =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as { t?: unknown }).t
        : undefined;
    return typeof t === 'number' && Number.isSafeInteger(t) && t >= 0
      ? t
      : undefined;
  } catch {
    return undefined;
  }
}

function getSWRPairChars(key: string, serialized: string) {
  return JSON.stringify(key).length + 1 + serialized.length;
}

function setSWREntry(
  state: IMirrorState,
  key: string,
  serialized: string,
  t: number,
) {
  const previous = state.swrEntries.get(key);
  state.swrPairChars += previous
    ? serialized.length - previous.serialized.length
    : getSWRPairChars(key, serialized);
  state.swrEntries.set(key, { serialized, t });
}

function deleteSWREntry(state: IMirrorState, key: string) {
  const previous = state.swrEntries.get(key);
  if (!previous) return;
  state.swrPairChars -= getSWRPairChars(key, previous.serialized);
  state.swrEntries.delete(key);
}

function clearSWREntries(state: IMirrorState) {
  state.swrEntries.clear();
  state.swrPairChars = 0;
}

// Length of the store as `serializeSWREntries` would write it, so the
// slow-op size stays comparable with the bg runtime's serialized store.
function getSWRStoreChars(state: IMirrorState) {
  return 2 + state.swrPairChars + Math.max(0, state.swrEntries.size - 1);
}

function serializeSWREntries(state: IMirrorState) {
  const pairs: string[] = [];
  state.swrEntries.forEach(({ serialized }, key) => {
    pairs.push(`${JSON.stringify(key)}:${serialized}`);
  });
  return `{${pairs.join(',')}}`;
}

// Whole-store values only arrive through the legacy `set` path.
function replaceSWREntries(state: IMirrorState, serializedStore: string) {
  clearSWREntries(state);
  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedStore);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
  Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
    if (
      !isValidSWRCacheKey(key) ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return;
    }
    const t = (value as { t?: unknown }).t;
    if (typeof t !== 'number' || !Number.isSafeInteger(t) || t < 0) return;
    setSWREntry(state, key, JSON.stringify(value), t);
  });
}

function applySWRCanonicalEntries(
  state: IMirrorState,
  entries: INativeSWRCacheCanonicalEntry[],
) {
  entries.forEach(([key, serialized]) => {
    if (!isValidSWRCacheKey(key)) return;
    if (serialized === null) {
      deleteSWREntry(state, key);
      return;
    }
    const t = readSWREntryTimestamp(serialized);
    if (t === undefined) {
      throw new OneKeyLocalError('Native SWR cache canonical entry is invalid');
    }
    setSWREntry(state, key, serialized, t);
  });
}

// Same rules as the bg persistence: tombstones drop entries no newer than
// they are, updates win ties. Budget pruning is left to bg; its
// acknowledgement carries any eviction back as a deletion.
function applySWRPatchToMirror(
  state: IMirrorState,
  patch: INativeSWRCachePatchIntent,
): INativeSWRCacheCanonicalEntry[] {
  const touched = new Set<string>();
  const removalTimestamps = new Map<string, number>();
  patch.removals.forEach(([key, removedAt]) => {
    removalTimestamps.set(
      key,
      Math.max(removalTimestamps.get(key) ?? 0, removedAt),
    );
  });
  const getTombstoneAt = (key: string) => {
    let tombstoneAt = patch.clearBefore;
    patch.removePrefixes.forEach(({ at, prefix }) => {
      if (key.startsWith(prefix)) {
        tombstoneAt = Math.max(tombstoneAt ?? 0, at);
      }
    });
    const removedAt = removalTimestamps.get(key);
    if (removedAt !== undefined) {
      tombstoneAt = Math.max(tombstoneAt ?? 0, removedAt);
    }
    return tombstoneAt;
  };
  const removeIfNotNewer = (key: string, removedAt: number) => {
    const current = state.swrEntries.get(key);
    if (current && current.t <= removedAt) {
      deleteSWREntry(state, key);
    }
    touched.add(key);
  };
  if (patch.clearBefore !== undefined) {
    const clearBefore = patch.clearBefore;
    [...state.swrEntries.keys()].forEach((key) =>
      removeIfNotNewer(key, clearBefore),
    );
  }
  patch.removePrefixes.forEach(({ at, prefix }) => {
    [...state.swrEntries.keys()].forEach((key) => {
      if (key.startsWith(prefix)) {
        removeIfNotNewer(key, at);
      }
    });
  });
  patch.removals.forEach(([key, removedAt]) => {
    removeIfNotNewer(key, removedAt);
  });
  patch.updates.forEach(([key, serialized]) => {
    const t = readSWREntryTimestamp(serialized);
    if (t === undefined) {
      throw new OneKeyLocalError('Native SWR cache patch entry is invalid');
    }
    const tombstoneAt = getTombstoneAt(key);
    if (tombstoneAt !== undefined && t < tombstoneAt) {
      touched.add(key);
      return;
    }
    const current = state.swrEntries.get(key);
    if (!current || t >= current.t) {
      setSWREntry(state, key, serialized, t);
    }
    touched.add(key);
  });
  return [...touched].map(
    (key) => [key, state.swrEntries.get(key)?.serialized ?? null] as const,
  );
}

function getSWRPatchChars(patch: INativeSWRCachePatchIntent) {
  return (
    (patch.clearBefore === undefined ? 0 : 16) +
    patch.removePrefixes.reduce(
      (subtotal, item) => subtotal + item.prefix.length + 16,
      0,
    ) +
    patch.removals.reduce(
      (subtotal, item) => subtotal + item[0].length + 16,
      0,
    ) +
    patch.updates.reduce(
      (subtotal, item) => subtotal + item[0].length + item[1].length + 8,
      0,
    )
  );
}

// Later patches win per key. A tombstone drops the earlier updates it would
// have deleted, because bg applies a patch's removals before its updates.
function mergeSWRPatches(
  state: IMirrorState,
  pairs: ISWRPatchMutationPair[],
): ISWRPatchMutationPair {
  let clearBefore: number | undefined;
  const removePrefixes = new Map<string, number>();
  const removals = new Map<string, number>();
  const updates = new Map<string, { serialized: string; t: number }>();
  const touched = new Set<string>();
  const dropUpdatesRemovedBy = (
    matches: (key: string) => boolean,
    removedAt: number,
  ) => {
    updates.forEach((update, key) => {
      if (matches(key) && update.t <= removedAt) {
        updates.delete(key);
      }
    });
  };
  const getTombstoneAt = (key: string) => {
    let tombstoneAt = clearBefore;
    removePrefixes.forEach((removedAt, prefix) => {
      if (key.startsWith(prefix)) {
        tombstoneAt = Math.max(tombstoneAt ?? 0, removedAt);
      }
    });
    const removedAt = removals.get(key);
    if (removedAt !== undefined) {
      tombstoneAt = Math.max(tombstoneAt ?? 0, removedAt);
    }
    return tombstoneAt;
  };
  pairs.forEach(({ mutation, request }) => {
    const { patch } = request;
    if (patch.clearBefore !== undefined) {
      clearBefore = Math.max(clearBefore ?? 0, patch.clearBefore);
      dropUpdatesRemovedBy(() => true, patch.clearBefore);
    }
    patch.removePrefixes.forEach(({ at, prefix }) => {
      removePrefixes.set(prefix, Math.max(removePrefixes.get(prefix) ?? 0, at));
      dropUpdatesRemovedBy((key) => key.startsWith(prefix), at);
    });
    patch.removals.forEach(([key, removedAt]) => {
      removals.set(key, Math.max(removals.get(key) ?? 0, removedAt));
      dropUpdatesRemovedBy((candidate) => candidate === key, removedAt);
    });
    patch.updates.forEach(([key, serialized]) => {
      const t = readSWREntryTimestamp(serialized) ?? 0;
      const tombstoneAt = getTombstoneAt(key);
      if (tombstoneAt !== undefined && t < tombstoneAt) {
        return;
      }
      const existing = updates.get(key);
      // bg keeps the newer entry when it applies these patches one by one, so
      // a later patch carrying an older timestamp must not win the merge.
      if (existing && existing.t > t) {
        return;
      }
      updates.delete(key);
      updates.set(key, { serialized, t });
    });
    mutation.entries.forEach(([key]) => touched.add(key));
  });
  return {
    // The mirror already holds the result of every merged patch, so the
    // replayed entries are read back from it rather than re-derived.
    mutation: {
      operation: 'patchSWR',
      entries: [...touched].map(
        (key) => [key, state.swrEntries.get(key)?.serialized ?? null] as const,
      ),
    },
    request: {
      scope: 'syncStorage',
      operation: 'patchSWR',
      store: 'coldStart',
      patch: {
        ...(clearBefore === undefined ? {} : { clearBefore }),
        removePrefixes: [...removePrefixes].map(([prefix, at]) => ({
          at,
          prefix,
        })),
        removals: [...removals],
        updates: [...updates].map(
          ([key, { serialized }]) => [key, serialized] as const,
        ),
      },
    },
  };
}

function notifySWREntryListeners(
  changes: INativeSWRCacheCanonicalEntry[] | null,
) {
  swrEntryListeners.forEach((listener) => {
    try {
      listener(changes);
    } catch {
      // A listener failure must not break mirror consistency.
    }
  });
}

// Keys a canonical mutation can change; whole-store operations touch all.
function snapshotSWREntries(
  state: IMirrorState,
  mutation: INativeSyncStorageLocalMutation,
) {
  const before = new Map<string, string | undefined>();
  if (mutation.operation === 'patchSWR') {
    mutation.entries.forEach(([key]) => {
      before.set(key, state.swrEntries.get(key)?.serialized);
    });
    return { before, wholeStore: false };
  }
  if (mutation.operation !== 'clear' && mutation.key !== SWR_CACHE_KEY) {
    return undefined;
  }
  state.swrEntries.forEach(({ serialized }, key) => {
    before.set(key, serialized);
  });
  return { before, wholeStore: true };
}

function notifySWREntryChanges(
  state: IMirrorState,
  snapshot: { before: Map<string, string | undefined>; wholeStore: boolean },
) {
  if (swrEntryListeners.size === 0) return;
  const changes: INativeSWRCacheCanonicalEntry[] = [];
  snapshot.before.forEach((previous, key) => {
    const current = state.swrEntries.get(key)?.serialized;
    if (current !== previous) {
      changes.push([key, current ?? null]);
    }
  });
  if (snapshot.wholeStore) {
    state.swrEntries.forEach(({ serialized }, key) => {
      if (!snapshot.before.has(key)) {
        changes.push([key, serialized]);
      }
    });
  }
  if (changes.length > 0) {
    notifySWREntryListeners(changes);
  }
}

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
  settings: createMirrorState(),
  coldStart: createMirrorState(),
  devSettings: createMirrorState(),
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
      if (mutation.key === SWR_CACHE_KEY) {
        if (typeof mutation.value === 'string') {
          replaceSWREntries(state, mutation.value);
        }
        break;
      }
      state.values.set(mutation.key, mutation.value);
      break;
    case 'patchSWR':
      applySWRCanonicalEntries(state, mutation.entries);
      break;
    case 'remove':
      if (mutation.key === SWR_CACHE_KEY) {
        clearSWREntries(state);
        break;
      }
      state.values.delete(mutation.key);
      break;
    case 'clear':
      state.values.clear();
      clearSWREntries(state);
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
    abortBootstrapReplay(
      new OneKeyLocalError('Native storage snapshot replay budget exceeded'),
    );
  }
}

function abortBootstrapReplay(error: Error) {
  collectBootstrapMutations = false;
  NATIVE_SYNC_STORAGE_NAMES.forEach((store) => {
    mirrors[store].mutationsBeforeBootstrap = [];
  });
  if (bootstrapAttempt) {
    bootstrapAttempt.replayError = error;
    bootstrapAttempt.reject(error);
  }
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
    if (request.operation !== 'patchSWR') {
      return { mutation, request };
    }
    const eligiblePending = [...queue.pending.entries()].filter(
      (
        entry,
      ): entry is [number, IPendingRemoteMutation & ISWRPatchMutationPair] => {
        const [mutationId, pending] = entry;
        return (
          mutationId !== queue.inFlightMutationId &&
          pending.mutation.operation === 'patchSWR' &&
          pending.request.operation === 'patchSWR'
        );
      },
    );
    const patchChars = eligiblePending.reduce(
      (total, [, pending]) => total + getSWRPatchChars(pending.request.patch),
      getSWRPatchChars(request.patch),
    );
    // Once merged, later patches keep folding into the same request so an
    // outage never rebuilds a long queue.
    const shouldCompact =
      eligiblePending.some(([, pending]) => pending.isSWRMergedPatch) ||
      eligiblePending.length + 1 > SWR_PATCH_COMPACTION_MAX_PENDING ||
      patchChars > SWR_PATCH_COMPACTION_MAX_CHARS;
    if (!shouldCompact) {
      return { mutation, request };
    }
    const merged = mergeSWRPatches(mirrors.coldStart, [
      ...eligiblePending.map(([, pending]) => pending),
      { mutation, request },
    ]);
    const acknowledgements = eligiblePending.flatMap(
      ([, pending]) => pending.acknowledgements,
    );
    eligiblePending.forEach(([mutationId]) => queue.pending.delete(mutationId));
    return { ...merged, isSWRMergedPatch: true, acknowledgements };
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
    acknowledgements: superseded.flatMap(
      ([, pending]) => pending.acknowledgements,
    ),
    mutation,
    request: compactedRequest,
  };
}

function createMutationAcknowledgement() {
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
) {
  const queue = remoteMutationQueues[store];
  const compacted = compactPendingRemoteMutations({
    mutation,
    queue,
    request,
  });
  const mutationId = (mutationSequence += 1);
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
    enqueuedAt: Date.now(),
    isSWRMergedPatch: compacted.isSWRMergedPatch,
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
  const swrSnapshot =
    mutation.store === 'coldStart'
      ? snapshotSWREntries(state, localMutation)
      : undefined;
  recordBootstrapMutation(state, localMutation);
  applyLocalMutation(state, localMutation);
  replayPendingLocalMutations(mutation.store);
  if (swrSnapshot) {
    // Replayed local writes cover their own keys, so an acknowledgement of
    // this runtime's write reports nothing; only bg-originated changes do.
    notifySWREntryChanges(state, swrSnapshot);
  }
  const durationMs = Math.round(perfNow() - startedAt);
  if (durationMs >= SWR_CACHE_SLOW_OP_LOG_THRESHOLD_MS) {
    defaultLogger.app.perf.swrCacheSlowOp({
      op: 'mirrorApply',
      durationMs,
      storeChars: getSWRStoreChars(state),
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
  pending.acknowledgements.forEach((acknowledgement) =>
    acknowledgement.resolve(),
  );
  queue.pending.delete(mutationId);
  applyCanonicalMutation(canonical, 'ack');
}

function mutate(
  store: INativeSyncStorageName,
  mutation: INativeSyncStorageLocalMutation,
  request: INativeSyncStorageRequest,
) {
  const state = mirrors[store];
  applyLocalMutation(state, mutation);
  return enqueueRemoteMutation(store, mutation, request);
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
  const isColdStart = store === 'coldStart';
  const mirror = {
    getString(key: string) {
      if (isColdStart && key === SWR_CACHE_KEY) {
        return serializeSWREntries(state);
      }
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
      // The legacy whole-store write still carries its baseline so bg can
      // three-way merge instead of replacing entries it wrote meanwhile.
      const previousValue =
        isColdStart && key === SWR_CACHE_KEY
          ? serializeSWREntries(state)
          : state.values.get(key);
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
      const keys = [...state.values.keys()];
      if (isColdStart) {
        keys.push(SWR_CACHE_KEY);
      }
      return keys;
    },
  };
  return {
    ...mirror,
    ...(isColdStart
      ? {
          applySWRCachePatch(patch: INativeSWRCachePatchIntent) {
            const entries = applySWRPatchToMirror(state, patch);
            return mutate(
              'coldStart',
              { operation: 'patchSWR', entries },
              {
                scope: 'syncStorage',
                operation: 'patchSWR',
                store: 'coldStart',
                patch,
              },
            );
          },
          readSWRCacheEntries(): INativeSWRCacheSerializedEntry[] {
            return [...state.swrEntries].map(
              ([key, { serialized }]) => [key, serialized] as const,
            );
          },
          subscribeSWRCacheEntries(listener: INativeSWRCacheEntriesListener) {
            swrEntryListeners.add(listener);
            return () => {
              swrEntryListeners.delete(listener);
            };
          },
        }
      : {}),
  };
}

function primeMirror(
  store: INativeSyncStorageName,
  entries: INativeStorageBootstrapSnapshot[INativeSyncStorageName],
  swrEntries: INativeSWRCacheSerializedEntry[] = [],
) {
  const state = mirrors[store];
  state.values.clear();
  clearSWREntries(state);
  for (const [key, value] of entries) {
    if (store === 'coldStart' && key === SWR_CACHE_KEY) {
      if (typeof value === 'string') {
        replaceSWREntries(state, value);
      }
    } else {
      state.values.set(key, value);
    }
  }
  swrEntries.forEach(([key, serialized]) => {
    const t = readSWREntryTimestamp(serialized);
    if (isValidSWRCacheKey(key) && t !== undefined) {
      setSWREntry(state, key, serialized, t);
    }
  });
  for (const mutation of state.mutationsBeforeBootstrap) {
    applyLocalMutation(state, mutation);
  }
  state.mutationsBeforeBootstrap = [];
  replayPendingLocalMutations(store);
  if (store === 'coldStart') {
    notifySWREntryListeners(null);
  }
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
      primeMirror(
        'coldStart',
        snapshot.coldStart,
        snapshot.swrCacheEntries ?? [],
      );
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
        replayPendingLocalMutations(store);
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

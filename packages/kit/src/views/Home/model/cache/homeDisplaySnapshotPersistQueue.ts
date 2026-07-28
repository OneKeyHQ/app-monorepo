import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';
import type { IDisplaySnapshotWriteEntry } from '@onekeyhq/shared/src/storage/DisplaySnapshotStorage';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { createHomeCachedSourceRecord } from '../store/homeCachedSourceRecord';
import { HOME_STORE_SOURCE_IDS } from '../store/homeStoreTypes';

import {
  createHomeDisplaySnapshotDescriptor,
  decodeHomeDisplaySnapshotManifest,
  decodeHomeDisplaySnapshotRoute,
  decodeHomeDisplaySnapshotRouteIndex,
  encodeHomeDisplaySnapshotCritical,
  encodeHomeDisplaySnapshotManifest,
  encodeHomeDisplaySnapshotPortfolioDetails,
  encodeHomeDisplaySnapshotRoute,
  encodeHomeDisplaySnapshotRouteIndex,
  encodeHomeDisplaySnapshotSourceChunk,
  projectHomeDisplaySnapshotNavigation,
  projectHomeDisplaySnapshotShell,
} from './homeDisplaySnapshotCodec';
import {
  HOME_DISPLAY_SNAPSHOT_ROUTE_INDEX_KEY,
  getHomeDisplaySnapshotChunkKey,
  getHomeDisplaySnapshotContentSignature,
  getHomeDisplaySnapshotManifestKey,
  getHomeDisplaySnapshotPartitionId,
  getHomeDisplaySnapshotPartitionTag,
  getHomeDisplaySnapshotRouteKey,
} from './homeDisplaySnapshotKeys';
import { homeDisplaySnapshotStorage } from './homeDisplaySnapshotRepository';
import {
  HOME_DISPLAY_SNAPSHOT_MAX_ROUTES,
  HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
} from './homeDisplaySnapshotTypes';
import {
  PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE,
  clearPreparedHomeDisplaySnapshotCache,
  deletePreparedHomeDisplaySnapshot,
} from './preparedHomeDisplaySnapshotCache';

import type {
  IHomeDisplaySnapshotChunkDescriptor,
  IHomeDisplaySnapshotChunkId,
  IHomeDisplaySnapshotManifest,
  IHomeDisplaySnapshotRoute,
} from './homeDisplaySnapshotTypes';
import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';
import type {
  IHomeStoreCommitIdentity,
  IHomeStoreSourceId,
  IHomeStoreState,
} from '../store/homeStoreTypes';

const PERSIST_DEBOUNCE_MS = 1000;
const PERSIST_MAX_WAIT_MS = 5000;

type IHomeDisplaySnapshotPersistJob = {
  ownerScopeKey: string;
  state: IHomeStoreState;
  dirtySourceIds: Set<IHomeStoreSourceId>;
  criticalDirty: boolean;
  firstQueuedAt: number;
};

type IMutableChunkMap = Partial<
  Record<IHomeDisplaySnapshotChunkId, IHomeDisplaySnapshotChunkDescriptor>
>;

const HOME_DISPLAY_CHUNK_IDS = [
  'critical',
  'portfolioDetails',
  ...HOME_STORE_SOURCE_IDS,
] as const satisfies readonly IHomeDisplaySnapshotChunkId[];

function isHardBlockedShell(shell: IHomeShellSemanticModel): boolean {
  return (
    shell.kind === 'backupRequired' || shell.kind === 'missingNetworkAccount'
  );
}

function isConfirmedCacheShell(shell: IHomeShellSemanticModel): boolean {
  if (shell.kind !== 'portfolio') {
    return false;
  }
  const presentation = shell.presentation;
  return (
    (presentation.kind === 'funded' &&
      (presentation.freshness === 'confirmedCache' ||
        presentation.header.authority === 'confirmedCache')) ||
    (presentation.kind === 'zero' &&
      presentation.freshness === 'confirmedCache')
  );
}

function isLiveSnapshotShell(shell: IHomeShellSemanticModel): boolean {
  if (shell.kind !== 'portfolio') {
    return false;
  }
  const presentation = shell.presentation;
  return (
    (presentation.kind === 'funded' || presentation.kind === 'zero') &&
    presentation.freshness === 'live'
  );
}

function shouldReplaceDescriptor({
  contentSignature,
  descriptor,
}: {
  contentSignature: string;
  descriptor: IHomeDisplaySnapshotChunkDescriptor | undefined;
}): boolean {
  return !descriptor || descriptor.contentSignature !== contentSignature;
}

function areChunkDescriptorsEqual(
  left: IHomeDisplaySnapshotChunkDescriptor | undefined,
  right: IHomeDisplaySnapshotChunkDescriptor | undefined,
): boolean {
  return (
    left === right ||
    Boolean(
      left &&
      right &&
      left.chunkId === right.chunkId &&
      left.key === right.key &&
      left.byteLength === right.byteLength &&
      left.contentSignature === right.contentSignature &&
      left.updatedAt === right.updatedAt,
    )
  );
}

function areChunkMapsEqual(
  left: IMutableChunkMap,
  right: IMutableChunkMap,
): boolean {
  return HOME_DISPLAY_CHUNK_IDS.every((chunkId) =>
    areChunkDescriptorsEqual(left[chunkId], right[chunkId]),
  );
}

async function readManifestForRoute({
  route,
}: {
  route: IHomeDisplaySnapshotRoute | undefined;
}): Promise<IHomeDisplaySnapshotManifest | undefined> {
  if (!route) {
    return undefined;
  }
  const raw = await homeDisplaySnapshotStorage.read(
    getHomeDisplaySnapshotManifestKey(
      route.partitionId,
      route.currentGeneration,
    ),
  );
  return decodeHomeDisplaySnapshotManifest({
    raw,
    expectedOwnerScopeKey: route.ownerScopeKey,
    expectedPartitionId: route.partitionId,
    expectedGeneration: route.currentGeneration,
  });
}

async function collectPartitionKeys(partitionId: string): Promise<string[]> {
  const routeKey = getHomeDisplaySnapshotRouteKey(partitionId);
  const routeRaw = await homeDisplaySnapshotStorage.read(routeKey);
  if (!routeRaw) {
    return [routeKey];
  }
  let ownerScopeKey: string | undefined;
  try {
    const value = JSON.parse(routeRaw) as {
      ownerScopeKey?: unknown;
    };
    ownerScopeKey =
      typeof value.ownerScopeKey === 'string' ? value.ownerScopeKey : undefined;
  } catch {
    return [routeKey];
  }
  if (!ownerScopeKey) {
    return [routeKey];
  }
  const route = decodeHomeDisplaySnapshotRoute({
    raw: routeRaw,
    expectedOwnerScopeKey: ownerScopeKey,
    expectedPartitionId: partitionId,
  });
  if (!route) {
    return [routeKey];
  }
  const generations = [
    route.currentGeneration,
    ...(route.previousGeneration ? [route.previousGeneration] : []),
  ];
  const keys = new Set<string>([routeKey]);
  for (const generation of generations) {
    const manifestKey = getHomeDisplaySnapshotManifestKey(
      partitionId,
      generation,
    );
    keys.add(manifestKey);
    const raw = await homeDisplaySnapshotStorage.read(manifestKey);
    const manifest = decodeHomeDisplaySnapshotManifest({
      raw,
      expectedOwnerScopeKey: ownerScopeKey,
      expectedPartitionId: partitionId,
      expectedGeneration: generation,
    });
    Object.values(manifest?.chunks ?? {}).forEach((descriptor) => {
      if (descriptor) {
        keys.add(descriptor.key);
      }
    });
  }
  return Array.from(keys);
}

async function collectRetiredGenerationKeys({
  currentManifest,
  nextManifest,
  route,
}: {
  currentManifest: IHomeDisplaySnapshotManifest | undefined;
  nextManifest: IHomeDisplaySnapshotManifest;
  route: IHomeDisplaySnapshotRoute | undefined;
}): Promise<string[]> {
  if (!route?.previousGeneration) {
    return [];
  }
  const retiredManifestKey = getHomeDisplaySnapshotManifestKey(
    route.partitionId,
    route.previousGeneration,
  );
  const raw = await homeDisplaySnapshotStorage.read(retiredManifestKey);
  const retiredManifest = decodeHomeDisplaySnapshotManifest({
    raw,
    expectedOwnerScopeKey: route.ownerScopeKey,
    expectedPartitionId: route.partitionId,
    expectedGeneration: route.previousGeneration,
  });
  const referencedKeys = new Set<string>();
  [currentManifest, nextManifest].forEach((manifest) => {
    Object.values(manifest?.chunks ?? {}).forEach((descriptor) => {
      if (descriptor) {
        referencedKeys.add(descriptor.key);
      }
    });
  });
  return [
    retiredManifestKey,
    ...Object.values(retiredManifest?.chunks ?? {}).flatMap((descriptor) =>
      descriptor && !referencedKeys.has(descriptor.key) ? [descriptor.key] : [],
    ),
  ];
}

async function persistHomeDisplaySnapshotOnce(
  job: IHomeDisplaySnapshotPersistJob,
): Promise<void> {
  const startedAt = Date.now();
  const now = Date.now();
  const partitionId = getHomeDisplaySnapshotPartitionId(job.ownerScopeKey);
  const routeKey = getHomeDisplaySnapshotRouteKey(partitionId);
  const currentRouteRaw = await homeDisplaySnapshotStorage.read(routeKey);
  const currentRoute = decodeHomeDisplaySnapshotRoute({
    raw: currentRouteRaw,
    expectedOwnerScopeKey: job.ownerScopeKey,
    expectedPartitionId: partitionId,
  });
  const currentManifest = await readManifestForRoute({
    route: currentRoute,
  });
  const nextGeneration = (currentRoute?.currentGeneration ?? 0) + 1;
  const chunks: IMutableChunkMap = { ...currentManifest?.chunks };
  const cleanupKeys = new Set<string>();
  const entries: IDisplaySnapshotWriteEntry[] = [];

  const currentShell = job.state.shell.value;
  const projectedShell = projectHomeDisplaySnapshotShell(currentShell);
  const hasConfirmedCacheShell = isConfirmedCacheShell(currentShell);
  const hasLiveSnapshotShell = isLiveSnapshotShell(currentShell);
  // A pending projection means that live aggregation has not produced a new
  // total. Keep the immutable last-known-good critical chunk instead of
  // replacing it with a navigation-only snapshot. Confirmed-cache state also
  // keeps the original descriptor during unrelated writes.
  const shouldPreserveCritical =
    Boolean(chunks.critical) &&
    !isHardBlockedShell(currentShell) &&
    (!projectedShell || hasConfirmedCacheShell);
  const shouldEvaluateCritical =
    !shouldPreserveCritical &&
    (job.criticalDirty ||
      !currentManifest ||
      !chunks.critical ||
      hasLiveSnapshotShell);

  if (shouldEvaluateCritical) {
    const shell = hasConfirmedCacheShell ? undefined : projectedShell;
    const navigation = projectHomeDisplaySnapshotNavigation(
      job.state.navigation.value,
    );
    if (shell || navigation) {
      const contentSignature = getHomeDisplaySnapshotContentSignature(
        stringUtils.stableStringify({
          shell,
          navigation,
        }),
      );
      if (
        shouldReplaceDescriptor({
          descriptor: chunks.critical,
          contentSignature,
        })
      ) {
        const key = getHomeDisplaySnapshotChunkKey(
          partitionId,
          nextGeneration,
          'critical',
        );
        const raw = encodeHomeDisplaySnapshotCritical({
          schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
          ownerScopeKey: job.ownerScopeKey,
          createdAt: now,
          shell,
          navigation,
        });
        if (chunks.critical) {
          cleanupKeys.add(chunks.critical.key);
        }
        entries.push({ key, value: raw });
        chunks.critical = createHomeDisplaySnapshotDescriptor({
          chunkId: 'critical',
          contentSignature,
          generation: nextGeneration,
          partitionId,
          raw,
          updatedAt: now,
        });
      }
    } else if (isHardBlockedShell(currentShell) && chunks.critical) {
      cleanupKeys.add(chunks.critical.key);
      delete chunks.critical;
    }
  }

  const dirtySourceIds = currentManifest
    ? job.dirtySourceIds
    : new Set(HOME_STORE_SOURCE_IDS);
  dirtySourceIds.forEach((sourceId) => {
    const record = createHomeCachedSourceRecord({
      now,
      sourceId,
      slot: job.state.resources[sourceId],
    });
    if (!record) {
      return;
    }
    const key = getHomeDisplaySnapshotChunkKey(
      partitionId,
      nextGeneration,
      sourceId,
    );
    const raw = encodeHomeDisplaySnapshotSourceChunk({
      ownerScopeKey: job.ownerScopeKey,
      record,
    });
    if (!raw) {
      if (chunks[sourceId]) {
        cleanupKeys.add(chunks[sourceId].key);
        delete chunks[sourceId];
      }
      if (sourceId === 'portfolio' && chunks.portfolioDetails) {
        cleanupKeys.add(chunks.portfolioDetails.key);
        delete chunks.portfolioDetails;
      }
      return;
    }
    if (sourceId === 'portfolio') {
      const detailsRaw = encodeHomeDisplaySnapshotPortfolioDetails({
        ownerScopeKey: job.ownerScopeKey,
        record,
      });
      if (detailsRaw) {
        const detailsContentSignature =
          getHomeDisplaySnapshotContentSignature(detailsRaw);
        if (
          shouldReplaceDescriptor({
            descriptor: chunks.portfolioDetails,
            contentSignature: detailsContentSignature,
          })
        ) {
          const detailsKey = getHomeDisplaySnapshotChunkKey(
            partitionId,
            nextGeneration,
            'portfolioDetails',
          );
          if (chunks.portfolioDetails) {
            cleanupKeys.add(chunks.portfolioDetails.key);
          }
          entries.push({ key: detailsKey, value: detailsRaw });
          chunks.portfolioDetails = createHomeDisplaySnapshotDescriptor({
            chunkId: 'portfolioDetails',
            contentSignature: detailsContentSignature,
            generation: nextGeneration,
            partitionId,
            raw: detailsRaw,
            updatedAt: now,
          });
        }
      } else if (chunks.portfolioDetails) {
        cleanupKeys.add(chunks.portfolioDetails.key);
        delete chunks.portfolioDetails;
      }
    }
    const contentSignature = getHomeDisplaySnapshotContentSignature(raw);
    if (
      !shouldReplaceDescriptor({
        descriptor: chunks[sourceId],
        contentSignature,
      })
    ) {
      return;
    }
    if (chunks[sourceId]) {
      cleanupKeys.add(chunks[sourceId].key);
    }
    entries.push({ key, value: raw });
    chunks[sourceId] = createHomeDisplaySnapshotDescriptor({
      chunkId: sourceId,
      contentSignature,
      generation: nextGeneration,
      partitionId,
      raw,
      updatedAt: now,
    });
  });

  const chunksChanged = !areChunkMapsEqual(
    chunks,
    currentManifest?.chunks ?? {},
  );
  if (!chunksChanged) {
    return;
  }

  const manifest: IHomeDisplaySnapshotManifest = {
    schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
    ownerScopeKey: job.ownerScopeKey,
    partitionId,
    generation: nextGeneration,
    createdAt: now,
    chunks,
  };
  const manifestKey = getHomeDisplaySnapshotManifestKey(
    partitionId,
    nextGeneration,
  );
  entries.push({
    key: manifestKey,
    value: encodeHomeDisplaySnapshotManifest(manifest),
  });

  const routeIndexRaw = await homeDisplaySnapshotStorage.read(
    HOME_DISPLAY_SNAPSHOT_ROUTE_INDEX_KEY,
  );
  const routeIndex =
    decodeHomeDisplaySnapshotRouteIndex(routeIndexRaw)?.routes ?? [];
  const sortedRoutes = [
    { partitionId, lastAccessedAt: now },
    ...routeIndex.filter((route) => route.partitionId !== partitionId),
  ].toSorted((left, right) => right.lastAccessedAt - left.lastAccessedAt);
  const retainedRoutes = sortedRoutes.slice(
    0,
    HOME_DISPLAY_SNAPSHOT_MAX_ROUTES,
  );
  const evictedRoutes = sortedRoutes.slice(HOME_DISPLAY_SNAPSHOT_MAX_ROUTES);
  const nextRoute: IHomeDisplaySnapshotRoute = {
    schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
    ownerScopeKey: job.ownerScopeKey,
    partitionId,
    currentGeneration: nextGeneration,
    previousGeneration: currentManifest?.generation,
    updatedAt: now,
  };
  const retiredGenerationKeys = await collectRetiredGenerationKeys({
    currentManifest,
    nextManifest: manifest,
    route: currentRoute,
  });
  retiredGenerationKeys.forEach((key) => cleanupKeys.add(key));
  const evictedKeyGroups = await Promise.all(
    evictedRoutes.map((route) => collectPartitionKeys(route.partitionId)),
  );
  evictedKeyGroups.flat().forEach((key) => cleanupKeys.add(key));

  entries.push({
    key: routeKey,
    value: encodeHomeDisplaySnapshotRoute(nextRoute),
  });
  await homeDisplaySnapshotStorage.commit({
    entries,
    commitMarker: {
      key: HOME_DISPLAY_SNAPSHOT_ROUTE_INDEX_KEY,
      value: encodeHomeDisplaySnapshotRouteIndex({
        schemaVersion: HOME_DISPLAY_SNAPSHOT_SCHEMA_VERSION,
        routes: retainedRoutes,
      }),
    },
    expectedCommitMarker: {
      key: HOME_DISPLAY_SNAPSHOT_ROUTE_INDEX_KEY,
      value: routeIndexRaw,
    },
    removeKeys: Array.from(cleanupKeys),
  });
  const memoryCacheInvalidated = deletePreparedHomeDisplaySnapshot(
    job.ownerScopeKey,
  );
  perfMark('Home:v3Cache:physicalWrite', {
    chunkCount: entries.length - 2,
  });
  const writtenSourceIds = entries
    .map((entry) => entry.key.split('/').at(-1))
    .filter(
      (chunkId): chunkId is IHomeStoreSourceId =>
        chunkId !== undefined &&
        chunkId !== 'critical' &&
        HOME_STORE_SOURCE_IDS.includes(chunkId as IHomeStoreSourceId),
    );
  defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
    stage: 'persist',
    outcome: 'accepted',
    partitionTag: getHomeDisplaySnapshotPartitionTag(job.ownerScopeKey),
    elapsedMs: Date.now() - startedAt,
    recordCount: writtenSourceIds.length,
    requestedSourceIds: Array.from(dirtySourceIds).toSorted().join(','),
    loadedSourceIds: writtenSourceIds.toSorted().join(','),
    generation: nextGeneration,
    criticalIncluded: entries.some((entry) => entry.key.endsWith('/critical')),
    memoryCacheInvalidated,
  });
}

async function persistHomeDisplaySnapshot(
  job: IHomeDisplaySnapshotPersistJob,
): Promise<void> {
  try {
    await persistHomeDisplaySnapshotOnce(job);
  } catch (error) {
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
      stage: 'persist',
      outcome: 'retrying',
      partitionTag: getHomeDisplaySnapshotPartitionTag(job.ownerScopeKey),
      elapsedMs: Date.now() - job.firstQueuedAt,
      recordCount: job.dirtySourceIds.size,
      requestedSourceIds: Array.from(job.dirtySourceIds).toSorted().join(','),
      criticalIncluded: job.criticalDirty,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    // A web tab can advance the route marker between read and commit. Rebuild
    // the immutable generation once against the latest marker before giving up.
    await persistHomeDisplaySnapshotOnce(job);
  }
}

export class HomeDisplaySnapshotPersistQueue {
  private pendingJobs = new Map<string, IHomeDisplaySnapshotPersistJob>();

  private timer: ReturnType<typeof setTimeout> | undefined;

  private inFlight: Promise<void> | undefined;

  private suspended = false;

  enqueue(
    state: IHomeStoreState,
    commitIdentity: IHomeStoreCommitIdentity,
  ): void {
    const ownerScopeKey = state.session.ownerToken?.scopeKey;
    if (this.suspended) {
      return;
    }
    if (commitIdentity.ownerChanged) {
      return;
    }
    if (!ownerScopeKey || commitIdentity.origin === 'cacheHydrate') {
      return;
    }
    const existing = this.pendingJobs.get(ownerScopeKey);
    const now = Date.now();
    const job: IHomeDisplaySnapshotPersistJob = existing ?? {
      ownerScopeKey,
      state,
      dirtySourceIds: new Set<IHomeStoreSourceId>(),
      criticalDirty: false,
      firstQueuedAt: now,
    };
    job.state = state;
    commitIdentity.changedSourceIds?.forEach((sourceId) =>
      job.dirtySourceIds.add(sourceId),
    );
    job.criticalDirty =
      job.criticalDirty || Boolean(commitIdentity.presentationChanged);
    if (job.dirtySourceIds.size === 0 && !job.criticalDirty) {
      return;
    }
    this.pendingJobs.set(ownerScopeKey, job);
    this.schedule(true);
  }

  flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!this.inFlight) {
      this.inFlight = this.drain().finally(() => {
        this.inFlight = undefined;
        if (this.pendingJobs.size > 0) {
          this.schedule();
        }
      });
    }
    return this.inFlight;
  }

  async flushAndCompact(): Promise<void> {
    if (this.suspended) {
      return;
    }
    await this.flushNow();
    // Capture one trailing batch that may have arrived while the first large
    // serialization was in flight. Lifecycle transitions normally stop live
    // producers, so two bounded passes preserve the latest display state.
    if (this.pendingJobs.size > 0) {
      await this.flushNow();
    }
    await homeDisplaySnapshotStorage.compact();
  }

  async suspendAndClear(): Promise<void> {
    const startedAt = Date.now();
    this.suspended = true;
    this.cancelPending();
    await this.inFlight?.catch(() => undefined);
    await homeDisplaySnapshotStorage.clearNamespace();
    const clearedEntryCount = clearPreparedHomeDisplaySnapshotCache();
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
      stage: 'preparedMemory',
      outcome: 'cleared',
      partitionTag: 'all',
      elapsedMs: Date.now() - startedAt,
      recordCount: clearedEntryCount,
      cacheEntryCount: 0,
      cacheCapacity: PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE,
      reason: 'namespaceCleared',
    });
  }

  private cancelPending(): void {
    this.pendingJobs.clear();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private schedule(resetDebounce = false): void {
    if (this.suspended || this.inFlight || this.pendingJobs.size === 0) {
      return;
    }
    if (this.timer) {
      if (!resetDebounce) {
        return;
      }
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    const oldestQueuedAt = Math.min(
      ...Array.from(this.pendingJobs.values()).map((job) => job.firstQueuedAt),
    );
    const remainingMaxWait = Math.max(
      0,
      PERSIST_MAX_WAIT_MS - (Date.now() - oldestQueuedAt),
    );
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        void this.flushNow();
      },
      Math.min(PERSIST_DEBOUNCE_MS, remainingMaxWait),
    );
  }

  private async drain(): Promise<void> {
    if (this.suspended) {
      this.pendingJobs.clear();
      return;
    }
    // Drain one captured batch only. Store commits that arrive while a large
    // snapshot is being serialized must go through the next debounce window;
    // otherwise a live price stream can turn this loop into continuous writes.
    const jobs = Array.from(this.pendingJobs.values());
    this.pendingJobs.clear();
    for (const job of jobs) {
      try {
        await persistHomeDisplaySnapshot(job);
      } catch (error) {
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
          stage: 'persist',
          outcome: 'failed',
          partitionTag: getHomeDisplaySnapshotPartitionTag(job.ownerScopeKey),
          elapsedMs: Date.now() - job.firstQueuedAt,
          recordCount: job.dirtySourceIds.size,
          requestedSourceIds: Array.from(job.dirtySourceIds)
            .toSorted()
            .join(','),
          criticalIncluded: job.criticalDirty,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
  }
}

export const homeDisplaySnapshotPersistQueue =
  new HomeDisplaySnapshotPersistQueue();

export async function resetHomeDisplaySnapshotCache(): Promise<void> {
  await homeDisplaySnapshotPersistQueue.suspendAndClear();
}

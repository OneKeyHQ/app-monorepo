import { useEffect, useLayoutEffect, useRef } from 'react';

import {
  useHomeContextStore,
  useHomeSessionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { readHomeStoreState } from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';
import {
  homeCommitIdentityState,
  homeDisplaySnapshotLoadState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';
import { registerColdStartFlushTrigger } from '@onekeyhq/shared/src/storage/coldStartFlushTrigger';
import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';

import { getHomeDisplaySnapshotPartitionTag } from '../cache/homeDisplaySnapshotKeys';
import {
  enqueueHomeDisplaySnapshotPersistJob,
  flushAndCompactHomeDisplaySnapshotPersistQueue,
  flushHomeDisplaySnapshotPersistQueue,
} from '../cache/homeDisplaySnapshotPersistQueueLoader';
import { prepareHomeDisplaySnapshot } from '../cache/homeStartupPreparedDisplaySnapshot';

import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

import type { ILoadedHomeDisplaySnapshotManifest } from '../cache/homeDisplaySnapshotTypes';
import type { IHomeStoreSourceId } from '../store/homeStoreTypes';

const HOME_BACKGROUND_SNAPSHOT_SOURCE_IDS = [
  'perps',
  'defi',
  'nft',
  'history',
] as const satisfies readonly IHomeStoreSourceId[];

function getNow(): number {
  return Date.now();
}

function getElapsed(startedAt: number): number {
  return Date.now() - startedAt;
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function getSourceIdsText(sourceIds: readonly IHomeStoreSourceId[]): string {
  return [...sourceIds].toSorted().join(',');
}

/**
 * Home display snapshot cache.
 *
 * The cache stores only explicitly selected business fields. It waits for
 * ActiveAccount to confirm the owner, then exact-reads the critical, Banner,
 * Portfolio, and Market chunks. The remaining list chunks warm asynchronously after
 * the first display is ready, so lazy views can mount from cache without
 * extending the startup critical path.
 *
 * Cached values are re-creatable display snapshots, never runtime authority.
 * They cannot restore request tokens, producer sessions, commands, signing,
 * transactions, or authentication state.
 */
export function HomeDisplaySnapshotControllerShared() {
  const session = useHomeSessionState();
  const store = useHomeContextStore();
  const { hydrateHomeDisplaySnapshot } = useHomeStoreControllerActions();
  const loadSequenceRef = useRef(0);
  const loadedChunksRef = useRef(new Set<string>());
  const inFlightChunksRef = useRef(new Map<string, Promise<number>>());
  const ensureSourceRef = useRef<
    (
      ownerToken: IHomeRuntimeOwnerToken,
      sourceId: IHomeStoreSourceId,
    ) => Promise<void>
  >(async () => undefined);
  const ownerToken = session.ownerToken;

  useLayoutEffect(() => {
    loadSequenceRef.current += 1;
    const loadSequence = loadSequenceRef.current;
    loadedChunksRef.current.clear();
    inFlightChunksRef.current.clear();
    ensureSourceRef.current = async () => undefined;
    if (!ownerToken) {
      store.set(homeDisplaySnapshotLoadState.atom(), { status: 'idle' });
      return;
    }
    const existingLoadState = store.get(homeDisplaySnapshotLoadState.atom());
    const preparedSnapshotAlreadyLoaded =
      existingLoadState.status === 'hit' &&
      existingLoadState.ownerScopeKey === ownerToken.scopeKey &&
      existingLoadState.sessionId === ownerToken.sessionId;
    if (!preparedSnapshotAlreadyLoaded) {
      store.set(homeDisplaySnapshotLoadState.atom(), {
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
        status: 'loading',
      });
    }
    const partitionTag = getHomeDisplaySnapshotPartitionTag(
      ownerToken.scopeKey,
    );
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
      stage: 'ownerReady',
      outcome: 'started',
      partitionTag,
      elapsedMs: 0,
      recordCount: 0,
    });

    const isCurrent = () =>
      loadSequenceRef.current === loadSequence &&
      readHomeStoreState(store.get).session.ownerToken?.scopeKey ===
        ownerToken.scopeKey &&
      readHomeStoreState(store.get).session.ownerToken?.sessionId ===
        ownerToken.sessionId;
    const publishLoadStatus = (status: 'hit' | 'miss') => {
      if (!isCurrent()) {
        return;
      }
      const currentLoadState = store.get(homeDisplaySnapshotLoadState.atom());
      if (
        currentLoadState.status === 'loading' &&
        (currentLoadState.ownerScopeKey !== ownerToken.scopeKey ||
          currentLoadState.sessionId !== ownerToken.sessionId)
      ) {
        return;
      }
      store.set(homeDisplaySnapshotLoadState.atom(), {
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
        status,
      });
    };

    const loadSourceChunk = async ({
      candidateOwnerToken,
      context,
      sourceId,
      stage,
    }: {
      candidateOwnerToken: IHomeRuntimeOwnerToken;
      context?: ILoadedHomeDisplaySnapshotManifest;
      sourceId: IHomeStoreSourceId;
      stage: 'lazyChunk' | 'visibleChunks';
    }): Promise<number> => {
      if (
        candidateOwnerToken.scopeKey !== ownerToken.scopeKey ||
        candidateOwnerToken.sessionId !== ownerToken.sessionId ||
        !isCurrent()
      ) {
        return 0;
      }
      const requestKey = `${candidateOwnerToken.scopeKey}:${sourceId}`;
      if (loadedChunksRef.current.has(requestKey)) {
        return 0;
      }
      const existing = inFlightChunksRef.current.get(requestKey);
      if (existing) {
        return existing;
      }
      const task = (async () => {
        const startedAt = getNow();
        try {
          const {
            loadHomeDisplaySnapshotManifest,
            loadHomeDisplaySnapshotSourceRecords,
          } = await import('../cache/homeDisplaySnapshotRepository');
          const resolvedContext =
            context ??
            (await loadHomeDisplaySnapshotManifest({
              ownerScopeKey: candidateOwnerToken.scopeKey,
            }));
          if (!isCurrent()) {
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
              stage,
              outcome: 'stale',
              partitionTag,
              elapsedMs: getElapsed(startedAt),
              recordCount: 0,
              requestedSourceIds: sourceId,
            });
            return 0;
          }
          if (!resolvedContext) {
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
              stage,
              outcome: 'miss',
              partitionTag,
              elapsedMs: getElapsed(startedAt),
              recordCount: 0,
              requestedSourceIds: sourceId,
            });
            return 0;
          }
          const records = await loadHomeDisplaySnapshotSourceRecords({
            context: resolvedContext,
            sourceIds: [sourceId],
          });
          if (!isCurrent()) {
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
              stage,
              outcome: 'stale',
              partitionTag,
              elapsedMs: getElapsed(startedAt),
              recordCount: 0,
              requestedSourceIds: sourceId,
              generation: resolvedContext.manifest.generation,
            });
            return 0;
          }
          loadedChunksRef.current.add(requestKey);
          if (records.length > 0) {
            hydrateHomeDisplaySnapshot({
              ownerScopeKey: candidateOwnerToken.scopeKey,
              sessionId: candidateOwnerToken.sessionId,
              records,
            });
            perfMark('Home:displayCache:sectionHydrated', {
              sourceId,
              recordCount: records.length,
            });
          }
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
            stage,
            outcome: records.length > 0 ? 'hit' : 'miss',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: records.length,
            requestedSourceIds: sourceId,
            loadedSourceIds: getSourceIdsText(
              records.map((record) => record.sourceId),
            ),
            generation: resolvedContext.manifest.generation,
          });
          return records.length;
        } catch (error) {
          if (!isCurrent()) {
            return 0;
          }
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
            stage,
            outcome: 'failed',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: 0,
            requestedSourceIds: sourceId,
            errorName: getErrorName(error),
          });
          return 0;
        }
      })().finally(() => {
        inFlightChunksRef.current.delete(requestKey);
      });
      inFlightChunksRef.current.set(requestKey, task);
      return task;
    };

    const ensureSource = async (
      candidateOwnerToken: IHomeRuntimeOwnerToken,
      sourceId: IHomeStoreSourceId,
    ) => {
      await loadSourceChunk({
        candidateOwnerToken,
        sourceId,
        stage: 'lazyChunk',
      });
    };

    const warmCachedSources = async (
      context?: ILoadedHomeDisplaySnapshotManifest,
    ) => {
      const { loadHomeDisplaySnapshotManifest } =
        await import('../cache/homeDisplaySnapshotRepository');
      const resolvedContext =
        context ??
        (await loadHomeDisplaySnapshotManifest({
          ownerScopeKey: ownerToken.scopeKey,
        }));
      if (!resolvedContext || !isCurrent()) {
        return;
      }
      await Promise.all(
        HOME_BACKGROUND_SNAPSHOT_SOURCE_IDS.filter(
          (sourceId) => resolvedContext.manifest.chunks[sourceId],
        ).map((sourceId) =>
          loadSourceChunk({
            candidateOwnerToken: ownerToken,
            context: resolvedContext,
            sourceId,
            stage: 'lazyChunk',
          }),
        ),
      );
    };

    const markInitialSourcesLoaded = () => {
      loadedChunksRef.current.add(`${ownerToken.scopeKey}:banner`);
      loadedChunksRef.current.add(`${ownerToken.scopeKey}:portfolio`);
      loadedChunksRef.current.add(`${ownerToken.scopeKey}:market`);
    };

    if (preparedSnapshotAlreadyLoaded) {
      markInitialSourcesLoaded();
      ensureSourceRef.current = ensureSource;
      void warmCachedSources();
      return () => {
        loadSequenceRef.current += 1;
        ensureSourceRef.current = async () => undefined;
      };
    }

    const loadInitialSnapshot = async () => {
      const startedAt = getNow();
      perfMark('Home:displayCache:loadStart');
      try {
        const handle = prepareHomeDisplaySnapshot({
          ownerScopeKey: ownerToken.scopeKey,
        });
        const result =
          handle.kind === 'ready' ? handle.result : await handle.task;
        if (!isCurrent()) {
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
            stage: 'initialHydrate',
            outcome: 'stale',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: 0,
          });
          return;
        }
        const displaySnapshot = result.displaySnapshot;
        if (!displaySnapshot) {
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
            stage: 'initialHydrate',
            outcome: 'miss',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: 0,
          });
          perfMark('Home:displayCache:miss', {
            elapsedMs: getElapsed(startedAt),
          });
          publishLoadStatus('miss');
          return;
        }
        hydrateHomeDisplaySnapshot({
          ownerScopeKey: ownerToken.scopeKey,
          sessionId: ownerToken.sessionId,
          ...displaySnapshot,
        });
        markInitialSourcesLoaded();
        ensureSourceRef.current = ensureSource;
        const loadedSourceIds = displaySnapshot.records.map(
          (record) => record.sourceId,
        );
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
          stage: 'initialHydrate',
          outcome: 'accepted',
          partitionTag,
          elapsedMs: getElapsed(startedAt),
          recordCount: loadedSourceIds.length,
          loadedSourceIds: getSourceIdsText(loadedSourceIds),
          criticalIncluded: Boolean(displaySnapshot.shell),
        });
        perfMark('Home:displayCache:initialHydrated', {
          elapsedMs: getElapsed(startedAt),
          recordCount: loadedSourceIds.length,
        });
        publishLoadStatus('hit');
        void warmCachedSources();
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
          stage: 'initialHydrate',
          outcome: 'failed',
          partitionTag,
          elapsedMs: getElapsed(startedAt),
          recordCount: 0,
          errorName: getErrorName(error),
        });
        perfMark('Home:displayCache:failed', {
          elapsedMs: getElapsed(startedAt),
        });
        publishLoadStatus('miss');
      } finally {
        if (isCurrent()) {
          ensureSourceRef.current = ensureSource;
        }
      }
    };
    void loadInitialSnapshot();

    return () => {
      loadSequenceRef.current += 1;
      ensureSourceRef.current = async () => undefined;
    };
  }, [hydrateHomeDisplaySnapshot, ownerToken, store]);

  useEffect(() => {
    const onCommit = () => {
      const state = readHomeStoreState(store.get);
      const commitIdentity = store.get(homeCommitIdentityState.atom());
      enqueueHomeDisplaySnapshotPersistJob(state, commitIdentity);
      const preferredTabId = state.interaction.preferredTabId;
      const activeOwnerToken = state.session.ownerToken;
      if (preferredTabId && activeOwnerToken) {
        void ensureSourceRef.current(activeOwnerToken, preferredTabId);
      }
    };
    const unsubscribe = store.sub(homeCommitIdentityState.atom(), onCommit);
    return () => {
      unsubscribe();
      void flushHomeDisplaySnapshotPersistQueue();
    };
  }, [store]);

  useEffect(() => {
    return registerColdStartFlushTrigger(
      flushAndCompactHomeDisplaySnapshotPersistQueue,
    );
  }, []);

  return null;
}

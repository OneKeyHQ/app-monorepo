import { useEffect, useRef } from 'react';

import {
  useHomeContextStore,
  useHomeSessionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { readHomeStoreState } from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';
import {
  homeCommitIdentityState,
  homeInteractionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';
import { registerColdStartFlushTrigger } from '@onekeyhq/shared/src/storage/coldStartFlushTrigger';
import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';

import { getHomeDisplaySnapshotPartitionTag } from '../cacheV2/homeDisplaySnapshotKeys';
import { HomeDisplaySnapshotPersistQueue } from '../cacheV2/homeDisplaySnapshotPersistQueue';
import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from '../cacheV2/homeDisplaySnapshotRepository';

import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

import type { IHomeStoreSourceId } from '../store/homeStoreTypes';

const homeDisplaySnapshotPersistQueue = new HomeDisplaySnapshotPersistQueue();

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

function getChunkLoadOutcome({
  loadedCount,
  requestedCount,
}: {
  loadedCount: number;
  requestedCount: number;
}): 'hit' | 'partial' | 'miss' {
  if (loadedCount === 0) {
    return 'miss';
  }
  if (loadedCount === requestedCount) {
    return 'hit';
  }
  return 'partial';
}

/**
 * Home display snapshot cache V2.
 *
 * V2 is a page-level, owner-partitioned replacement for the gradually retired
 * V1 cache. It waits for ActiveAccount to confirm the owner, then exact-reads
 * only the critical and visible chunks. Other chain, account, and section
 * snapshots stay on disk until they are requested.
 *
 * Cached values are re-creatable display snapshots, never runtime authority.
 * They cannot restore request tokens, producer sessions, commands, signing,
 * transactions, or authentication state.
 */
export function HomeDisplaySnapshotController() {
  const session = useHomeSessionState();
  const store = useHomeContextStore();
  const { hydrateHomeDisplaySnapshot } = useHomeStoreControllerActions();
  const loadSequenceRef = useRef(0);
  const loadedChunksRef = useRef(new Set<string>());
  const inFlightChunksRef = useRef(new Map<string, Promise<void>>());
  const ensureSourceRef = useRef<
    (
      ownerToken: IHomeRuntimeOwnerToken,
      sourceId: IHomeStoreSourceId,
    ) => Promise<void>
  >(async () => undefined);
  const ownerToken = session.ownerToken;

  useEffect(() => {
    loadSequenceRef.current += 1;
    const loadSequence = loadSequenceRef.current;
    loadedChunksRef.current.clear();
    inFlightChunksRef.current.clear();
    if (!ownerToken) {
      return;
    }
    const partitionTag = getHomeDisplaySnapshotPartitionTag(
      ownerToken.scopeKey,
    );
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
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

    const ensureSource = async (
      candidateOwnerToken: IHomeRuntimeOwnerToken,
      sourceId: IHomeStoreSourceId,
    ) => {
      if (
        candidateOwnerToken.scopeKey !== ownerToken.scopeKey ||
        candidateOwnerToken.sessionId !== ownerToken.sessionId ||
        !isCurrent()
      ) {
        return;
      }
      const requestKey = `${candidateOwnerToken.scopeKey}:${sourceId}`;
      if (loadedChunksRef.current.has(requestKey)) {
        return;
      }
      const existing = inFlightChunksRef.current.get(requestKey);
      if (existing) {
        return existing;
      }
      const task = (async () => {
        const startedAt = getNow();
        try {
          const context = await loadHomeDisplaySnapshotManifest({
            ownerScopeKey: candidateOwnerToken.scopeKey,
          });
          if (!isCurrent()) {
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
              stage: 'lazyChunk',
              outcome: 'stale',
              partitionTag,
              elapsedMs: getElapsed(startedAt),
              recordCount: 0,
              requestedSourceIds: sourceId,
            });
            return;
          }
          if (!context) {
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
              stage: 'lazyChunk',
              outcome: 'miss',
              partitionTag,
              elapsedMs: getElapsed(startedAt),
              recordCount: 0,
              requestedSourceIds: sourceId,
            });
            return;
          }
          const records = await loadHomeDisplaySnapshotSourceRecords({
            context,
            sourceIds: [sourceId],
          });
          if (!isCurrent()) {
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
              stage: 'lazyChunk',
              outcome: 'stale',
              partitionTag,
              elapsedMs: getElapsed(startedAt),
              recordCount: 0,
              requestedSourceIds: sourceId,
              generation: context.manifest.generation,
            });
            return;
          }
          loadedChunksRef.current.add(requestKey);
          if (records.length > 0) {
            hydrateHomeDisplaySnapshot({
              ownerScopeKey: candidateOwnerToken.scopeKey,
              sessionId: candidateOwnerToken.sessionId,
              records,
            });
            perfMark('Home:v2Cache:sectionHydrated', {
              sourceId,
              recordCount: records.length,
            });
          }
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
            stage: 'lazyChunk',
            outcome: records.length > 0 ? 'hit' : 'miss',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: records.length,
            requestedSourceIds: sourceId,
            loadedSourceIds: getSourceIdsText(
              records.map((record) => record.sourceId),
            ),
            generation: context.manifest.generation,
          });
        } catch (error) {
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
            stage: 'lazyChunk',
            outcome: 'failed',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: 0,
            requestedSourceIds: sourceId,
            errorName: getErrorName(error),
          });
        }
      })().finally(() => {
        inFlightChunksRef.current.delete(requestKey);
      });
      inFlightChunksRef.current.set(requestKey, task);
      return task;
    };
    ensureSourceRef.current = ensureSource;

    const loadInitialSnapshot = async () => {
      const startedAt = getNow();
      perfMark('Home:v2Cache:loadStart');
      try {
        const context = await loadHomeDisplaySnapshotManifest({
          ownerScopeKey: ownerToken.scopeKey,
        });
        if (!isCurrent()) {
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
            stage: 'manifest',
            outcome: 'stale',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: 0,
          });
          return;
        }
        if (!context) {
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
            stage: 'manifest',
            outcome: 'miss',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: 0,
          });
          perfMark('Home:v2Cache:miss', {
            elapsedMs: getElapsed(startedAt),
          });
          return;
        }
        const manifestSourceIds = Object.keys(context.manifest.chunks).filter(
          (chunkId): chunkId is IHomeStoreSourceId => chunkId !== 'critical',
        );
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
          stage: 'manifest',
          outcome: 'hit',
          partitionTag,
          elapsedMs: getElapsed(startedAt),
          recordCount: manifestSourceIds.length,
          loadedSourceIds: getSourceIdsText(manifestSourceIds),
          generation: context.manifest.generation,
          criticalIncluded: Boolean(context.manifest.chunks.critical),
          cacheAgeMs: Math.max(0, getNow() - context.manifest.createdAt),
        });
        const criticalStartedAt = getNow();
        const critical = await loadHomeDisplaySnapshotCritical({
          context,
        });
        if (!isCurrent()) {
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
            stage: 'critical',
            outcome: 'stale',
            partitionTag,
            elapsedMs: getElapsed(criticalStartedAt),
            recordCount: 0,
            generation: context.manifest.generation,
          });
          return;
        }
        if (critical) {
          hydrateHomeDisplaySnapshot({
            ownerScopeKey: ownerToken.scopeKey,
            sessionId: ownerToken.sessionId,
            records: [],
            shell: critical.shell,
            navigation: critical.navigation,
            selectedTabPreference: critical.selectedTabPreference,
          });
          perfMark('Home:v2Cache:criticalHydrated', {
            elapsedMs: getElapsed(criticalStartedAt),
          });
        }
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
          stage: 'critical',
          outcome: critical ? 'hit' : 'miss',
          partitionTag,
          elapsedMs: getElapsed(criticalStartedAt),
          recordCount: 0,
          generation: context.manifest.generation,
          criticalIncluded: Boolean(critical),
        });

        const selectedSourceId =
          critical?.selectedTabPreference ??
          store.get(homeInteractionState.atom()).preferredTabId ??
          'portfolio';
        const visibleSourceIds = Array.from(
          new Set<IHomeStoreSourceId>(['banner', selectedSourceId]),
        );
        const records = await loadHomeDisplaySnapshotSourceRecords({
          context,
          sourceIds: visibleSourceIds,
        });
        if (!isCurrent()) {
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
            stage: 'visibleChunks',
            outcome: 'stale',
            partitionTag,
            elapsedMs: getElapsed(startedAt),
            recordCount: 0,
            requestedSourceIds: getSourceIdsText(visibleSourceIds),
            generation: context.manifest.generation,
          });
          return;
        }
        visibleSourceIds.forEach((sourceId) =>
          loadedChunksRef.current.add(`${ownerToken.scopeKey}:${sourceId}`),
        );
        if (records.length > 0) {
          hydrateHomeDisplaySnapshot({
            ownerScopeKey: ownerToken.scopeKey,
            sessionId: ownerToken.sessionId,
            records,
          });
        }
        const loadedSourceIds = records.map((record) => record.sourceId);
        const visibleOutcome = getChunkLoadOutcome({
          loadedCount: loadedSourceIds.length,
          requestedCount: visibleSourceIds.length,
        });
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
          stage: 'visibleChunks',
          outcome: visibleOutcome,
          partitionTag,
          elapsedMs: getElapsed(startedAt),
          recordCount: records.length,
          requestedSourceIds: getSourceIdsText(visibleSourceIds),
          loadedSourceIds: getSourceIdsText(loadedSourceIds),
          generation: context.manifest.generation,
        });
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
          stage: 'initialHydrate',
          outcome: critical || records.length > 0 ? 'accepted' : 'empty',
          partitionTag,
          elapsedMs: getElapsed(startedAt),
          recordCount: records.length,
          loadedSourceIds: getSourceIdsText(loadedSourceIds),
          generation: context.manifest.generation,
          criticalIncluded: Boolean(critical),
        });
        perfMark('Home:v2Cache:initialHydrated', {
          elapsedMs: getElapsed(startedAt),
          recordCount: records.length,
        });
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
          stage: 'initialHydrate',
          outcome: 'failed',
          partitionTag,
          elapsedMs: getElapsed(startedAt),
          recordCount: 0,
          errorName: getErrorName(error),
        });
        perfMark('Home:v2Cache:failed', {
          elapsedMs: getElapsed(startedAt),
        });
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
      homeDisplaySnapshotPersistQueue.enqueue(state, commitIdentity);
      const preferredTabId = state.interaction.preferredTabId;
      const activeOwnerToken = state.session.ownerToken;
      if (preferredTabId && activeOwnerToken) {
        void ensureSourceRef.current(activeOwnerToken, preferredTabId);
      }
    };
    const unsubscribe = store.sub(homeCommitIdentityState.atom(), onCommit);
    return () => {
      unsubscribe();
      void homeDisplaySnapshotPersistQueue.flushNow();
    };
  }, [store]);

  useEffect(() => {
    return registerColdStartFlushTrigger(() =>
      homeDisplaySnapshotPersistQueue.flushAndCompact(),
    );
  }, []);

  return null;
}

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

import type { ILoadedHomeDisplaySnapshotManifest } from '../cacheV2/homeDisplaySnapshotTypes';
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

function yieldToHomeRenderer(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
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
  const inFlightChunksRef = useRef(new Map<string, Promise<number>>());
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
    ensureSourceRef.current = async () => undefined;
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
          const resolvedContext =
            context ??
            (await loadHomeDisplaySnapshotManifest({
              ownerScopeKey: candidateOwnerToken.scopeKey,
            }));
          if (!isCurrent()) {
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
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
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
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
            defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
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
            perfMark('Home:v2Cache:sectionHydrated', {
              sourceId,
              recordCount: records.length,
            });
          }
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
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
          defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
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

        // Let the confirmed Header and action policy commit before any larger
        // section chunk is read and decoded on the main JS runtime.
        await yieldToHomeRenderer();
        if (!isCurrent()) {
          return;
        }

        ensureSourceRef.current = ensureSource;
        const selectedSourceId =
          critical?.selectedTabPreference ??
          store.get(homeInteractionState.atom()).preferredTabId ??
          'portfolio';
        const bannerLoad = loadSourceChunk({
          candidateOwnerToken: ownerToken,
          context,
          sourceId: 'banner',
          stage: 'visibleChunks',
        });

        // Start the visible section on the next paint turn without waiting for
        // Banner I/O. Each source hydrates as soon as its own read completes.
        await yieldToHomeRenderer();
        if (!isCurrent()) {
          return;
        }
        const selectedLoad = loadSourceChunk({
          candidateOwnerToken: ownerToken,
          context,
          sourceId: selectedSourceId,
          stage: 'visibleChunks',
        });

        const [bannerRecordCount, selectedRecordCount] = await Promise.all([
          bannerLoad,
          selectedLoad,
        ]);
        const loadedSourceIds: IHomeStoreSourceId[] = [];
        if (bannerRecordCount > 0) {
          loadedSourceIds.push('banner');
        }
        if (selectedRecordCount > 0) {
          loadedSourceIds.push(selectedSourceId);
        }
        defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
          stage: 'initialHydrate',
          outcome:
            critical || loadedSourceIds.length > 0 ? 'accepted' : 'empty',
          partitionTag,
          elapsedMs: getElapsed(startedAt),
          recordCount: loadedSourceIds.length,
          loadedSourceIds: getSourceIdsText(loadedSourceIds),
          generation: context.manifest.generation,
          criticalIncluded: Boolean(critical),
        });
        perfMark('Home:v2Cache:initialHydrated', {
          elapsedMs: getElapsed(startedAt),
          recordCount: loadedSourceIds.length,
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

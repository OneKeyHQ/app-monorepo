import { useLayoutEffect, useMemo } from 'react';

import {
  useHomeContextStore,
  useHomeSessionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { homeDisplaySnapshotLoadState } from '@onekeyhq/kit/src/states/jotai/contexts/home/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

import { getHomeDisplaySnapshotPartitionTag } from '../cache/homeDisplaySnapshotKeys';
import { loadHomeStartupPreparedDisplaySnapshot } from '../cache/homeStartupPreparedDisplaySnapshot';
import { loadPreparedHomeDisplaySnapshot } from '../cache/loadPreparedHomeDisplaySnapshot.native';

import { HomeDisplaySnapshotControllerShared } from './HomeDisplaySnapshotController.shared';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

function NativeHomeDisplaySnapshotBootstrap() {
  const session = useHomeSessionState();
  const store = useHomeContextStore();
  const { publishPreparedHomeDisplaySnapshot } =
    useHomeStoreControllerActions();
  const ownerToken = session.ownerToken;
  // Keep this read in the pre-paint render path. Deferring it to an effect
  // leaves the native Home without cached content when the splash is revealed.
  // The cached owner is only a hint and is validated against ownerToken below.
  const startupPreparedDisplaySnapshot = useMemo(() => {
    const startedAt = Date.now();
    perfMark('Home:displayCache:startupStaticLoadStart');
    const handle = loadHomeStartupPreparedDisplaySnapshot();
    const prepared = handle?.kind === 'ready' ? handle.result : undefined;
    perfMark('Home:displayCache:startupStaticLoadDone', {
      elapsedMs: Date.now() - startedAt,
      hit: Boolean(prepared?.displaySnapshot),
    });
    return prepared;
  }, []);

  useLayoutEffect(() => {
    if (!ownerToken) {
      store.set(homeDisplaySnapshotLoadState.atom(), { status: 'idle' });
      return;
    }
    const existingLoadState = store.get(homeDisplaySnapshotLoadState.atom());
    // HomeStoreControllerBridge may have already published the same prepared
    // snapshot atomically with the owner. Avoid a second hydration in that case.
    if (
      existingLoadState.status === 'hit' &&
      existingLoadState.ownerScopeKey === ownerToken.scopeKey &&
      existingLoadState.sessionId === ownerToken.sessionId
    ) {
      return;
    }

    const startedAt = Date.now();
    const partitionTag = getHomeDisplaySnapshotPartitionTag(
      ownerToken.scopeKey,
    );
    perfMark('Home:displayCache:nativeSyncLoadStart');
    try {
      const displaySnapshot =
        startupPreparedDisplaySnapshot?.ownerScopeKey === ownerToken.scopeKey
          ? startupPreparedDisplaySnapshot.displaySnapshot
          : loadPreparedHomeDisplaySnapshot({
              ownerScopeKey: ownerToken.scopeKey,
            });
      publishPreparedHomeDisplaySnapshot({
        displaySnapshot,
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
      });
      const loadedSourceIds =
        displaySnapshot?.records.map((record) => record.sourceId) ?? [];
      defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
        stage: 'initialHydrate',
        outcome: displaySnapshot ? 'accepted' : 'miss',
        partitionTag,
        elapsedMs: Date.now() - startedAt,
        recordCount: loadedSourceIds.length,
        loadedSourceIds: loadedSourceIds.toSorted().join(','),
        criticalIncluded: Boolean(displaySnapshot?.shell),
      });
      perfMark('Home:displayCache:nativeSyncHydrated', {
        elapsedMs: Date.now() - startedAt,
        recordCount: loadedSourceIds.length,
      });
    } catch (error) {
      publishPreparedHomeDisplaySnapshot({
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
      });
      defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
        stage: 'initialHydrate',
        outcome: 'failed',
        partitionTag,
        elapsedMs: Date.now() - startedAt,
        recordCount: 0,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }, [
    ownerToken,
    publishPreparedHomeDisplaySnapshot,
    startupPreparedDisplaySnapshot,
    store,
  ]);

  return null;
}

export function HomeDisplaySnapshotController() {
  return (
    <>
      <NativeHomeDisplaySnapshotBootstrap />
      <HomeDisplaySnapshotControllerShared />
    </>
  );
}

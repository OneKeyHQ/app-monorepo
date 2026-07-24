import { useLayoutEffect } from 'react';

import {
  useHomeContextStore,
  useHomeSessionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { homeDisplaySnapshotLoadState } from '@onekeyhq/kit/src/states/jotai/contexts/home/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

import { getHomeDisplaySnapshotPartitionTag } from '../cacheV2/homeDisplaySnapshotKeys';
import { loadPreparedHomeDisplaySnapshot } from '../cacheV2/loadPreparedHomeDisplaySnapshot.native';

import { HomeDisplaySnapshotControllerShared } from './HomeDisplaySnapshotController.shared';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

function NativeHomeDisplaySnapshotBootstrap() {
  const session = useHomeSessionState();
  const store = useHomeContextStore();
  const { publishPreparedHomeDisplaySnapshot } =
    useHomeStoreControllerActions();
  const ownerToken = session.ownerToken;

  useLayoutEffect(() => {
    if (!ownerToken) {
      store.set(homeDisplaySnapshotLoadState.atom(), { status: 'idle' });
      return;
    }
    const existingLoadState = store.get(homeDisplaySnapshotLoadState.atom());
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
    perfMark('Home:v3Cache:nativeSyncLoadStart');
    try {
      const displaySnapshot = loadPreparedHomeDisplaySnapshot({
        ownerScopeKey: ownerToken.scopeKey,
      });
      publishPreparedHomeDisplaySnapshot({
        displaySnapshot,
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
      });
      const loadedSourceIds =
        displaySnapshot?.records.map((record) => record.sourceId) ?? [];
      defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
        stage: 'initialHydrate',
        outcome: displaySnapshot ? 'accepted' : 'miss',
        partitionTag,
        elapsedMs: Date.now() - startedAt,
        recordCount: loadedSourceIds.length,
        loadedSourceIds: loadedSourceIds.toSorted().join(','),
        criticalIncluded: Boolean(displaySnapshot?.shell),
      });
      perfMark('Home:v3Cache:nativeSyncHydrated', {
        elapsedMs: Date.now() - startedAt,
        recordCount: loadedSourceIds.length,
      });
    } catch (error) {
      publishPreparedHomeDisplaySnapshot({
        ownerScopeKey: ownerToken.scopeKey,
        sessionId: ownerToken.sessionId,
      });
      defaultLogger.wallet.homeUi.homeDisplaySnapshotCacheV2({
        stage: 'initialHydrate',
        outcome: 'failed',
        partitionTag,
        elapsedMs: Date.now() - startedAt,
        recordCount: 0,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }, [ownerToken, publishPreparedHomeDisplaySnapshot, store]);

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

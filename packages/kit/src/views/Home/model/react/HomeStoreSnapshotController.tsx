import { useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHomeInteraction,
  useHomeResource,
  useHomeSessionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import {
  decodeHomeStoreSnapshot,
  encodeHomeStoreSnapshot,
  isHomeCachedRecordExactForToken,
} from '../store/homeStoreSnapshotCodec';
import {
  HOME_STORE_CACHE_TTL_MS,
  createCacheRecord,
} from '../store/homeStoreSnapshotRecord';

import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

import type {
  IHomeCachedSnapshotPayload,
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

const HOME_STORE_CACHE_PERSIST_DEBOUNCE_MS = 500;

function getHomeStoreCacheKey(ownerScopeKey: string): string {
  return `home-unified-v1:${ownerScopeKey}`;
}

export function HomeStoreSnapshotController() {
  const session = useHomeSessionState();
  const interaction = useHomeInteraction();
  const capability = useHomeResource('capability');
  const banner = useHomeResource('banner');
  const portfolio = useHomeResource('portfolio');
  const perps = useHomeResource('perps');
  const defi = useHomeResource('defi');
  const nft = useHomeResource('nft');
  const history = useHomeResource('history');
  const market = useHomeResource('market');
  const { hydrateHomeConfirmedSnapshot } = useHomeStoreControllerActions();
  const loadGenerationRef = useRef(0);
  const hydratedSourceIdsRef = useRef(new Set<IHomeStoreSourceId>());
  const hydratedPreferenceRef = useRef(false);
  const [loadedSnapshot, setLoadedSnapshot] =
    useState<IHomeCachedSnapshotPayload>();
  const ownerToken = session.ownerToken;
  const resources = useMemo(
    () => ({
      capability,
      banner,
      portfolio,
      perps,
      defi,
      nft,
      history,
      market,
    }),
    [banner, capability, defi, history, market, nft, perps, portfolio],
  );

  useEffect(() => {
    loadGenerationRef.current += 1;
    const generation = loadGenerationRef.current;
    hydratedSourceIdsRef.current.clear();
    hydratedPreferenceRef.current = false;
    setLoadedSnapshot(undefined);
    if (!ownerToken) {
      return;
    }
    const load = async () => {
      const envelope =
        await backgroundApiProxy.serviceBootstrap.loadHomeStoreCache(
          getHomeStoreCacheKey(ownerToken.scopeKey),
        );
      if (generation !== loadGenerationRef.current) {
        return;
      }
      const snapshot = decodeHomeStoreSnapshot({
        envelope,
        expectedOwnerScopeKey: ownerToken.scopeKey,
        now: Date.now(),
      });
      if (!snapshot) {
        return;
      }
      setLoadedSnapshot(snapshot);
    };
    void load();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [ownerToken]);

  useEffect(() => {
    if (
      !loadedSnapshot ||
      !ownerToken ||
      loadedSnapshot.ownerScopeKey !== ownerToken.scopeKey
    ) {
      return;
    }
    const records = loadedSnapshot.records.filter((record) => {
      if (hydratedSourceIdsRef.current.has(record.sourceId)) {
        return false;
      }
      const current = resources[record.sourceId];
      if (
        current.kind === 'ready' ||
        current.kind === 'empty' ||
        current.kind === 'partial'
      ) {
        hydratedSourceIdsRef.current.add(record.sourceId);
        return false;
      }
      return Boolean(
        current.kind !== 'idle' &&
        current.token &&
        isHomeCachedRecordExactForToken(record, current.token),
      );
    });
    const shouldHydratePreference =
      !hydratedPreferenceRef.current &&
      loadedSnapshot.selectedTabPreference !== undefined;
    if (records.length === 0 && !shouldHydratePreference) {
      return;
    }
    hydrateHomeConfirmedSnapshot({
      ownerScopeKey: ownerToken.scopeKey,
      sessionId: ownerToken.sessionId,
      records,
      selectedTabPreference: shouldHydratePreference
        ? loadedSnapshot.selectedTabPreference
        : undefined,
    });
    records.forEach((record) =>
      hydratedSourceIdsRef.current.add(record.sourceId),
    );
    if (shouldHydratePreference) {
      hydratedPreferenceRef.current = true;
    }
  }, [hydrateHomeConfirmedSnapshot, loadedSnapshot, ownerToken, resources]);

  useEffect(() => {
    if (!ownerToken) {
      return;
    }
    const timeout = setTimeout(() => {
      const now = Date.now();
      const records = Object.entries(resources)
        .map(([sourceId, slot]) =>
          createCacheRecord({
            now,
            sourceId: sourceId as IHomeStoreSourceId,
            slot,
          }),
        )
        .filter(
          (record): record is IHomeCachedSourceRecord => record !== undefined,
        );
      if (records.length === 0) {
        return;
      }
      const envelope = encodeHomeStoreSnapshot({
        key: getHomeStoreCacheKey(ownerToken.scopeKey),
        ownerScopeKey: ownerToken.scopeKey,
        records,
        selectedTabPreference: interaction.preferredTabId,
        createdAt: now,
        expiresAt: now + HOME_STORE_CACHE_TTL_MS,
      });
      if (envelope) {
        void backgroundApiProxy.serviceBootstrap.persistHomeStoreCache(
          envelope,
        );
      }
    }, HOME_STORE_CACHE_PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [interaction.preferredTabId, ownerToken, resources]);

  return null;
}

export { getHomeStoreCacheKey };

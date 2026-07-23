import { useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHomeInteraction,
  useHomeResource,
  useHomeSessionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  decodeHomeStoreSnapshot,
  encodeHomeStoreSnapshot,
  isHomeCachedRecordExactForToken,
} from '../store/homeStoreSnapshotCodec';
import {
  HOME_STORE_CACHE_TTL_MS,
  createCacheRecord,
  getHomeStoreCacheContentSignature,
  mergeHomeStoreCacheRecords,
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
  const lastPersistedSignatureRef = useRef<string | undefined>(undefined);
  const hydratedSourceIdsRef = useRef(new Set<IHomeStoreSourceId>());
  const hydratedPreferenceRef = useRef(false);
  const confirmedRecordsRef = useRef<{
    ownerScopeKey?: string;
    records: readonly IHomeCachedSourceRecord[];
  }>({ records: [] });
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
    lastPersistedSignatureRef.current = undefined;
    confirmedRecordsRef.current = {
      ownerScopeKey: ownerToken?.scopeKey,
      records: [],
    };
    setLoadedSnapshot(undefined);
    if (!ownerToken) {
      return;
    }
    const load = async () => {
      try {
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
        let outcome: 'accepted' | 'rejected' | 'empty' = 'empty';
        if (snapshot) {
          outcome = 'accepted';
        } else if (envelope) {
          outcome = 'rejected';
        }
        defaultLogger.wallet.homeUi.homeStoreCacheDecision({
          operation: 'load',
          outcome,
          recordCount: snapshot?.records.length ?? 0,
        });
        if (snapshot) {
          lastPersistedSignatureRef.current =
            getHomeStoreCacheContentSignature(snapshot);
          if (
            confirmedRecordsRef.current.ownerScopeKey ===
              snapshot.ownerScopeKey &&
            confirmedRecordsRef.current.records.length === 0
          ) {
            confirmedRecordsRef.current = {
              ownerScopeKey: snapshot.ownerScopeKey,
              records: snapshot.records,
            };
          }
          setLoadedSnapshot(snapshot);
        } else if (envelope) {
          void backgroundApiProxy.serviceBootstrap.removeHomeStoreCache(
            getHomeStoreCacheKey(ownerToken.scopeKey),
          );
        }
      } catch {
        defaultLogger.wallet.homeUi.homeStoreCacheDecision({
          operation: 'load',
          outcome: 'failed',
          recordCount: 0,
        });
      }
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
    defaultLogger.wallet.homeUi.homeStoreCacheDecision({
      operation: 'hydrate',
      outcome: 'accepted',
      recordCount: records.length,
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
      const liveRecords = Object.entries(resources)
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
      const records = mergeHomeStoreCacheRecords({
        cachedRecords:
          confirmedRecordsRef.current.ownerScopeKey === ownerToken.scopeKey
            ? confirmedRecordsRef.current.records
            : [],
        liveRecords,
        now,
      });
      if (records.length === 0) {
        return;
      }
      if (liveRecords.length > 0) {
        confirmedRecordsRef.current = {
          ownerScopeKey: ownerToken.scopeKey,
          records,
        };
      }
      const contentSignature = getHomeStoreCacheContentSignature({
        records,
        selectedTabPreference: interaction.preferredTabId,
      });
      if (contentSignature === lastPersistedSignatureRef.current) {
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
        lastPersistedSignatureRef.current = contentSignature;
        void backgroundApiProxy.serviceBootstrap
          .persistHomeStoreCache(envelope)
          .then(() => {
            defaultLogger.wallet.homeUi.homeStoreCacheDecision({
              operation: 'persist',
              outcome: 'accepted',
              recordCount: records.length,
            });
          })
          .catch(() => {
            if (lastPersistedSignatureRef.current === contentSignature) {
              lastPersistedSignatureRef.current = undefined;
            }
            defaultLogger.wallet.homeUi.homeStoreCacheDecision({
              operation: 'persist',
              outcome: 'failed',
              recordCount: records.length,
            });
          });
      }
    }, HOME_STORE_CACHE_PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [interaction.preferredTabId, ownerToken, resources]);

  return null;
}

export { getHomeStoreCacheKey };

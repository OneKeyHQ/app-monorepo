import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import { logMarketWidgetEvent } from '@onekeyhq/shared/src/modules/MarketWidget/diagnostics';
import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
  IMarketWidgetKind,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

const loadingSnapshot = {
  state: undefined,
  isLoading: true,
  hasError: false,
};

export function useMarketWidgetEditorState(
  editorSession?: string,
  pickerQuery?: string,
  instanceId?: string,
  instanceKind?: IMarketWidgetKind,
) {
  const [snapshot, setSnapshot] = useState<{
    state?: IMarketWidgetEditorState;
    isLoading: boolean;
    hasError: boolean;
  }>(loadingSnapshot);
  const { isLoading, hasError } = snapshot;
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchResponse, setSearchResponse] = useState<{
    query: string;
    assets?: IMarketWidgetAsset[];
    results?: IMarketWidgetAsset[];
  }>();
  const [privacyMasked, setPrivacyMasked] = useState(
    travelModeManager.isMaskingDataSync(),
  );
  const focusedRef = useRef(false);
  const mountedRef = useRef(true);
  const activeRef = useRef(true);
  const lifecycleRef = useRef(0);
  const requestRef = useRef(0);
  const pendingBrowseRef = useRef<number | undefined>(undefined);
  const searchRequestRef = useRef(0);
  const draftRequestRef = useRef(0);
  const acceptedDraftRef = useRef<{ searchAssets?: IMarketWidgetAsset[] }>(
    undefined,
  );
  const draftQueueRef = useRef(Promise.resolve());
  const [nativeSession, setNativeSession] = useState(editorSession);
  const sessionRef = useRef(editorSession);
  const pendingSessionRef = useRef<Promise<string | undefined> | undefined>(
    undefined,
  );

  const releaseSession = useCallback((token: string) => {
    void marketWidget
      .finishEditing?.(token, false)
      .catch((error: unknown) =>
        logMarketWidgetEvent('editor.cleanup_failed', {}, token, error),
      );
  }, []);
  const getEditorSession = useCallback(async () => {
    if (sessionRef.current || !marketWidget.beginEditing)
      return sessionRef.current;
    if (!pendingSessionRef.current) {
      const lifecycle = lifecycleRef.current;
      const pending = marketWidget
        .beginEditing(
          instanceId && instanceKind
            ? { id: instanceId, kind: instanceKind }
            : undefined,
        )
        .then((token) => {
          if (
            !mountedRef.current ||
            !focusedRef.current ||
            lifecycle !== lifecycleRef.current
          ) {
            if (token) releaseSession(token);
            return undefined;
          }
          sessionRef.current = token;
          setNativeSession(token);
          return token;
        })
        .catch((error: unknown) => {
          if (pendingSessionRef.current === pending)
            pendingSessionRef.current = undefined;
          throw error;
        });
      pendingSessionRef.current = pending;
    }
    return pendingSessionRef.current;
  }, [instanceId, instanceKind, releaseSession]);

  const cancelDraft = useCallback(() => {
    draftRequestRef.current += 1;
  }, []);
  const cancelSearch = useCallback(() => {
    searchRequestRef.current += 1;
    setSearchResponse(undefined);
    setIsSearching(false);
    setSearchError(false);
  }, []);
  const retainDraft = useCallback(
    async (
      assets: IMarketWidgetAsset[],
      visibleAssets: IMarketWidgetAsset[] = [],
    ) => {
      if (!focusedRef.current || !activeRef.current) return false;
      const lifecycle = lifecycleRef.current;
      draftRequestRef.current += 1;
      const request = draftRequestRef.current;
      const isCurrent = () =>
        mountedRef.current &&
        focusedRef.current &&
        activeRef.current &&
        lifecycle === lifecycleRef.current &&
        request === draftRequestRef.current;
      const operation = draftQueueRef.current.then(async () => {
        try {
          if (!isCurrent()) return false;
          const session = await getEditorSession();
          if (!isCurrent()) return false;
          if (!session || !marketWidget.setEditorDraft) return true;
          const browseRequest = requestRef.current;
          const browseWasIdle = pendingBrowseRef.current !== browseRequest;
          // Preserve the visible selection until JS accepts its replacement.
          const next = await marketWidget.setEditorDraft(
            assets,
            session,
            visibleAssets,
          );
          if (!isCurrent()) return false;
          const masked =
            next.privacyMasked || travelModeManager.isMaskingDataSync();
          setPrivacyMasked(masked);
          if (masked) {
            requestRef.current += 1;
            cancelSearch();
            setSnapshot({
              state: undefined,
              isLoading: false,
              hasError: false,
            });
            return false;
          }
          const draft = { searchAssets: next.searchAssets };
          acceptedDraftRef.current = draft;
          // The draft response can include a newer native Trending cache.
          const browse =
            browseWasIdle && browseRequest === requestRef.current
              ? { watchlist: next.watchlist, hot: next.hot }
              : undefined;
          setSnapshot((current) =>
            current.state
              ? { ...current, state: { ...current.state, ...draft, ...browse } }
              : current,
          );
          return true;
        } catch (error) {
          if (!isCurrent()) return false;
          throw error;
        }
      });
      draftQueueRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [cancelSearch, getEditorSession],
  );

  const searchAssets = useCallback(
    async (query: string) => {
      if (
        !marketWidget.searchAssets ||
        !focusedRef.current ||
        !activeRef.current
      )
        return;
      searchRequestRef.current += 1;
      const request = searchRequestRef.current;
      const lifecycle = lifecycleRef.current;
      const isCurrent = () =>
        mountedRef.current &&
        focusedRef.current &&
        activeRef.current &&
        lifecycle === lifecycleRef.current &&
        request === searchRequestRef.current;
      setIsSearching(true);
      setSearchError(false);
      try {
        await travelModeManager.ready;
        if (!isCurrent() || travelModeManager.isMaskingDataSync()) return;
        const session = await getEditorSession();
        if (!isCurrent()) return;
        const next = await marketWidget.searchAssets(query, session);
        if (!isCurrent()) return;
        const masked =
          next.privacyMasked || travelModeManager.isMaskingDataSync();
        setPrivacyMasked(masked);
        setSearchResponse(
          masked
            ? undefined
            : { query, assets: next.searchAssets, results: next.searchResults },
        );
        setSearchError(!masked && next.searchIncomplete === true);
        if (masked) {
          setSnapshot((current) => ({ ...current, state: undefined }));
        } else if (!next.searchResults && next.searchAssets) {
          // Older native editors keep stock selections in the candidate catalog.
          setSnapshot((current) =>
            current.state
              ? {
                  ...current,
                  state: { ...current.state, searchAssets: next.searchAssets },
                }
              : current,
          );
        }
      } catch (error) {
        logMarketWidgetEvent('editor.search_failed', {}, editorSession, error);
        if (isCurrent()) setSearchError(true);
      } finally {
        if (isCurrent()) setIsSearching(false);
      }
    },
    [editorSession, getEditorSession],
  );

  useEffect(() => {
    if (!pickerQuery || isLoading || hasError || privacyMasked) return;
    const timer = setTimeout(() => void searchAssets(pickerQuery), 300);
    return () => {
      clearTimeout(timer);
      cancelSearch();
    };
  }, [
    pickerQuery,
    isLoading,
    hasError,
    privacyMasked,
    searchAssets,
    cancelSearch,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const readEditor = useCallback(
    async (keepVisible: boolean) => {
      if (!focusedRef.current || !activeRef.current) return;
      requestRef.current += 1;
      const request = requestRef.current;
      pendingBrowseRef.current = request;
      const finishBrowse = () => {
        if (pendingBrowseRef.current === request) {
          pendingBrowseRef.current = undefined;
        }
      };
      const started = Date.now();
      const isCurrent = () =>
        focusedRef.current &&
        activeRef.current &&
        request === requestRef.current;
      logMarketWidgetEvent('editor.read_started', { request }, editorSession);
      if (!keepVisible) {
        cancelSearch();
        setSnapshot(loadingSnapshot);
      }
      const searchRequest = searchRequestRef.current;
      const draftAtReadStart = acceptedDraftRef.current;
      const publish = (next?: IMarketWidgetEditorState) => {
        const masked =
          next?.privacyMasked === true || travelModeManager.isMaskingDataSync();
        setPrivacyMasked(masked);
        if (masked) cancelSearch();
        const searchChanged = searchRequest !== searchRequestRef.current;
        const draft = acceptedDraftRef.current;
        setSnapshot((current) => {
          let state = masked ? undefined : next;
          if (state && keepVisible && current.state) {
            state = {
              ...current.state,
              watchlist: state.watchlist,
              hot: state.hot,
            };
          } else if (state) {
            if (searchChanged && current.state?.searchAssets) {
              state = { ...state, searchAssets: current.state.searchAssets };
            } else if (draft !== draftAtReadStart) {
              state = { ...state, ...draft };
            }
          }
          return { isLoading: false, hasError: false, state };
        });
        return !masked;
      };
      let refreshingMetadata = false;
      try {
        if (travelModeManager.isMaskingDataSync()) {
          publish();
          return;
        }
        const session =
          marketWidget.beginEditing && !editorSession
            ? await getEditorSession()
            : editorSession;
        if (!isCurrent()) return;
        const next = await marketWidget.getEditorState(session);
        logMarketWidgetEvent(
          'editor.read_succeeded',
          { request, durationMs: Date.now() - started },
          editorSession,
        );
        if (
          !isCurrent() ||
          !publish(next) ||
          !marketWidget.refreshEditorState
        ) {
          return;
        }
        // Display the local snapshot first; network metadata must not block navigation.
        const metadata = marketWidget.refreshEditorState(session);
        refreshingMetadata = true;
        void metadata
          .then((updated) => {
            if (isCurrent()) publish(updated);
          })
          .catch((error: unknown) => {
            logMarketWidgetEvent(
              'editor.metadata_failed',
              { request },
              editorSession,
              error,
            );
          })
          .finally(finishBrowse);
      } catch (error) {
        logMarketWidgetEvent(
          'editor.read_failed',
          { request },
          editorSession,
          error,
        );
        if (isCurrent()) {
          setSnapshot((current) =>
            current.state
              ? current
              : { state: undefined, isLoading: false, hasError: true },
          );
        }
      } finally {
        if (!refreshingMetadata) finishBrowse();
      }
    },
    [cancelSearch, editorSession, getEditorSession],
  );
  const refresh = useCallback(() => readEditor(false), [readEditor]);

  useFocusEffect(
    useCallback(() => {
      logMarketWidgetEvent('editor.focus', {}, editorSession);
      focusedRef.current = true;
      activeRef.current = true;
      lifecycleRef.current += 1;
      void refresh();
      const syncBrowseLists = () => void readEditor(true);
      appEventBus.on(
        EAppEventBusNames.MarketWidgetConfigurationSynced,
        syncBrowseLists,
      );
      const subscription = AppState.addEventListener('change', (appState) => {
        logMarketWidgetEvent('editor.app_state', { appState }, editorSession);
        if (appState === 'active') {
          if (!activeRef.current) {
            activeRef.current = true;
            void refresh();
          }
        } else {
          cancelSearch();
          cancelDraft();
          activeRef.current = false;
          lifecycleRef.current += 1;
          if (!sessionRef.current) pendingSessionRef.current = undefined;
          // Do not retain a visible native snapshot while the app is inactive.
          requestRef.current += 1;
          setSnapshot(loadingSnapshot);
        }
      });
      return () => {
        logMarketWidgetEvent('editor.blur', {}, editorSession);
        focusedRef.current = false;
        lifecycleRef.current += 1;
        requestRef.current += 1;
        cancelSearch();
        cancelDraft();
        subscription.remove();
        appEventBus.off(
          EAppEventBusNames.MarketWidgetConfigurationSynced,
          syncBrowseLists,
        );
        if (!editorSession && sessionRef.current)
          releaseSession(sessionRef.current);
        sessionRef.current = editorSession;
        pendingSessionRef.current = undefined;
        setNativeSession(editorSession);
        setSnapshot(loadingSnapshot);
      };
    }, [
      editorSession,
      refresh,
      readEditor,
      cancelSearch,
      cancelDraft,
      releaseSession,
    ]),
  );

  const state = useMemo(() => {
    const current = snapshot.state;
    if (!current || !searchResponse) return current;
    return {
      ...current,
      searchAssets: searchResponse.assets ?? current.searchAssets,
      searchResults: searchResponse.results,
    };
  }, [snapshot.state, searchResponse]);

  const unavailable = !!(
    platformEnv.isNativeIOS &&
    instanceId &&
    instanceKind &&
    state?.settings?.length === 0
  );
  return {
    editorSession: nativeSession,
    cancelDraft,
    retainDraft,
    state: unavailable ? undefined : state,
    unavailable,
    isLoading,
    hasError,
    privacyMasked,
    isSearching,
    searchError,
    searchQuery: searchResponse?.query,
    searchAssets,
    cancelSearch,
    refresh,
    isActive: () => focusedRef.current,
    isMounted: () => mountedRef.current,
    getLifecycleToken: () => lifecycleRef.current,
    isLifecycleCurrent: (token: number) =>
      mountedRef.current &&
      focusedRef.current &&
      activeRef.current &&
      token === lifecycleRef.current,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';

import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import { logMarketWidgetEvent } from '@onekeyhq/shared/src/modules/MarketWidget/diagnostics';
import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

export function useMarketWidgetEditorState(editorSession?: string) {
  const [state, setState] = useState<IMarketWidgetEditorState>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [privacyMasked, setPrivacyMasked] = useState(
    travelModeManager.isMaskingDataSync(),
  );
  const focusedRef = useRef(false);
  const mountedRef = useRef(true);
  const activeRef = useRef(true);
  const lifecycleRef = useRef(0);
  const requestRef = useRef(0);
  const searchRequestRef = useRef(0);
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
        .beginEditing()
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
  }, [releaseSession]);

  const retainDraft = useCallback(
    async (assets: IMarketWidgetAsset[]) => {
      if (!focusedRef.current || !activeRef.current) return false;
      const lifecycle = lifecycleRef.current;
      const session = await getEditorSession();
      if (
        !mountedRef.current ||
        !focusedRef.current ||
        !activeRef.current ||
        lifecycle !== lifecycleRef.current
      )
        return false;
      if (!session || !marketWidget.setEditorDraft) return true;
      requestRef.current += 1;
      const next = await marketWidget.setEditorDraft(assets, session);
      if (
        !mountedRef.current ||
        !focusedRef.current ||
        !activeRef.current ||
        lifecycle !== lifecycleRef.current
      )
        return false;
      const masked =
        next.privacyMasked || travelModeManager.isMaskingDataSync();
      setPrivacyMasked(masked);
      setState(masked ? undefined : next);
      return !masked;
    },
    [getEditorSession],
  );

  const cancelSearch = useCallback(() => {
    searchRequestRef.current += 1;
    setIsSearching(false);
    setSearchError(false);
  }, []);

  const searchStocks = useCallback(
    async (query: string) => {
      if (
        !marketWidget.searchStocks ||
        !focusedRef.current ||
        !activeRef.current
      )
        return;
      searchRequestRef.current += 1;
      const request = searchRequestRef.current;
      // An older metadata refresh must not erase newly discovered stock candidates.
      requestRef.current += 1;
      const snapshotRequest = requestRef.current;
      const lifecycle = lifecycleRef.current;
      const isCurrent = () =>
        mountedRef.current &&
        focusedRef.current &&
        activeRef.current &&
        lifecycle === lifecycleRef.current &&
        snapshotRequest === requestRef.current &&
        request === searchRequestRef.current;
      setIsSearching(true);
      setSearchError(false);
      try {
        await travelModeManager.ready;
        if (!isCurrent() || travelModeManager.isMaskingDataSync()) return;
        const session = await getEditorSession();
        if (!isCurrent()) return;
        const next = await marketWidget.searchStocks(query, session);
        if (!isCurrent()) return;
        const masked =
          next.privacyMasked || travelModeManager.isMaskingDataSync();
        setPrivacyMasked(masked);
        setState(masked ? undefined : next);
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    requestRef.current += 1;
    const request = requestRef.current;
    if (!focusedRef.current) return;
    const started = Date.now();
    logMarketWidgetEvent('editor.read_started', { request }, editorSession);
    setIsLoading(true);
    setHasError(false);
    setState(undefined);
    if (travelModeManager.isMaskingDataSync()) {
      setPrivacyMasked(true);
      setIsLoading(false);
      return;
    }
    try {
      const session =
        marketWidget.beginEditing && !editorSession
          ? await getEditorSession()
          : editorSession;
      if (!focusedRef.current || request !== requestRef.current) return;
      const next = await marketWidget.getEditorState(session);
      logMarketWidgetEvent(
        'editor.read_succeeded',
        { request, durationMs: Date.now() - started },
        editorSession,
      );
      if (!focusedRef.current || request !== requestRef.current) return;
      const masked =
        next.privacyMasked || travelModeManager.isMaskingDataSync();
      setPrivacyMasked(masked);
      setState(masked ? undefined : next);
      setIsLoading(false);
      if (!masked && marketWidget.refreshEditorState) {
        // Display the local snapshot first; network metadata must not block navigation.
        void marketWidget
          .refreshEditorState(session)
          .then((updated) => {
            if (!focusedRef.current || request !== requestRef.current) return;
            const isMasked =
              updated.privacyMasked || travelModeManager.isMaskingDataSync();
            setPrivacyMasked(isMasked);
            setState(isMasked ? undefined : updated);
          })
          .catch((error: unknown) => {
            logMarketWidgetEvent(
              'editor.metadata_failed',
              { request },
              editorSession,
              error,
            );
            // A failed background refresh does not invalidate the readable local snapshot.
          });
      }
    } catch (error) {
      logMarketWidgetEvent(
        'editor.read_failed',
        { request },
        editorSession,
        error,
      );
      if (!focusedRef.current || request !== requestRef.current) return;
      setHasError(true);
    } finally {
      if (focusedRef.current && request === requestRef.current) {
        setIsLoading(false);
      }
    }
  }, [editorSession, getEditorSession]);

  useFocusEffect(
    useCallback(() => {
      logMarketWidgetEvent('editor.focus', {}, editorSession);
      focusedRef.current = true;
      activeRef.current = true;
      lifecycleRef.current += 1;
      void refresh();
      const subscription = AppState.addEventListener('change', (appState) => {
        logMarketWidgetEvent('editor.app_state', { appState }, editorSession);
        if (appState === 'active') {
          if (!activeRef.current) {
            activeRef.current = true;
            void refresh();
          }
        } else {
          cancelSearch();
          activeRef.current = false;
          lifecycleRef.current += 1;
          if (!sessionRef.current) pendingSessionRef.current = undefined;
          // Do not retain a visible native snapshot while the app is inactive.
          requestRef.current += 1;
          setState(undefined);
          setIsLoading(true);
        }
      });
      return () => {
        logMarketWidgetEvent('editor.blur', {}, editorSession);
        focusedRef.current = false;
        lifecycleRef.current += 1;
        requestRef.current += 1;
        cancelSearch();
        subscription.remove();
        if (!editorSession && sessionRef.current)
          releaseSession(sessionRef.current);
        sessionRef.current = editorSession;
        pendingSessionRef.current = undefined;
        setNativeSession(editorSession);
        setState(undefined);
        setIsLoading(true);
        setHasError(false);
      };
    }, [editorSession, refresh, cancelSearch, releaseSession]),
  );

  return {
    editorSession: nativeSession,
    retainDraft,
    state,
    isLoading,
    hasError,
    privacyMasked,
    isSearching,
    searchError,
    searchStocks,
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

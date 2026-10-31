import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';

import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import type { IMarketWidgetEditorState } from '@onekeyhq/shared/src/modules/MarketWidget/types';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

export function useMarketWidgetEditorState(editorSession?: string) {
  const [state, setState] = useState<IMarketWidgetEditorState>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [privacyMasked, setPrivacyMasked] = useState(
    travelModeManager.isMaskingDataSync(),
  );
  const focusedRef = useRef(false);
  const mountedRef = useRef(true);
  const activeRef = useRef(true);
  const lifecycleRef = useRef(0);
  const requestRef = useRef(0);

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
    setIsLoading(true);
    setHasError(false);
    setState(undefined);
    if (travelModeManager.isMaskingDataSync()) {
      setPrivacyMasked(true);
      setIsLoading(false);
      return;
    }
    try {
      const next = await marketWidget.getEditorState(editorSession);
      if (!focusedRef.current || request !== requestRef.current) return;
      const masked =
        next.privacyMasked || travelModeManager.isMaskingDataSync();
      setPrivacyMasked(masked);
      setState(masked ? undefined : next);
      setIsLoading(false);
      if (!masked && marketWidget.refreshEditorState) {
        // Display the local snapshot first; network metadata must not block navigation.
        void marketWidget
          .refreshEditorState(editorSession)
          .then((updated) => {
            if (!focusedRef.current || request !== requestRef.current) return;
            const isMasked =
              updated.privacyMasked || travelModeManager.isMaskingDataSync();
            setPrivacyMasked(isMasked);
            setState(isMasked ? undefined : updated);
          })
          .catch(() => {
            // A failed background refresh does not invalidate the readable local snapshot.
          });
      }
    } catch {
      if (!focusedRef.current || request !== requestRef.current) return;
      setHasError(true);
    } finally {
      if (focusedRef.current && request === requestRef.current) {
        setIsLoading(false);
      }
    }
  }, [editorSession]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      activeRef.current = true;
      lifecycleRef.current += 1;
      void refresh();
      const subscription = AppState.addEventListener('change', (appState) => {
        if (appState === 'active') {
          activeRef.current = true;
          void refresh();
        } else {
          activeRef.current = false;
          lifecycleRef.current += 1;
          // Do not retain a visible native snapshot while the app is inactive.
          requestRef.current += 1;
          setState(undefined);
          setIsLoading(true);
        }
      });
      return () => {
        focusedRef.current = false;
        lifecycleRef.current += 1;
        requestRef.current += 1;
        subscription.remove();
        setState(undefined);
        setIsLoading(true);
        setHasError(false);
      };
    }, [refresh]),
  );

  return {
    state,
    isLoading,
    hasError,
    privacyMasked,
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

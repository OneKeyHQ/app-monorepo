import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import * as ReactNavigationCore from '@react-navigation/core';
import { AppState } from 'react-native';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isForceUpdateStrategy } from '../../../components/AppUpdate';

export const CONTACT_SUPPORT_RECHECK_INTERVAL_MS = 10_000;
const CONTACT_SUPPORT_HANDOFF_TTL_MS = 5000;

type IMountedForceUpdateListener = {
  onRemoteResponse: (response: IAppUpdateInfo) => void;
  onContactSupport: () => void;
};

const mountedForceUpdateListeners = new Set<IMountedForceUpdateListener>();
let pendingContactSupportHandoffAt = 0;
// Shared across hook instances because every response is broadcast to all
// mounted listeners: only the most recently started refresh may apply, so an
// older response that resolves late cannot overwrite a newer lock decision.
let latestRefreshGeneration = 0;

export function markPendingContactSupportHandoff(): void {
  pendingContactSupportHandoffAt = Date.now();
}

function consumePendingContactSupportHandoff(): boolean {
  if (!pendingContactSupportHandoffAt) {
    return false;
  }
  const isFresh =
    Date.now() - pendingContactSupportHandoffAt <=
    CONTACT_SUPPORT_HANDOFF_TTL_MS;
  pendingContactSupportHandoffAt = 0;
  return isFresh;
}

type INavigationFocusLike = {
  addListener?: (
    event: string,
    callback: () => void,
  ) => (() => void) | undefined;
};

const FallbackNavigationContext = createContext<
  INavigationFocusLike | undefined
>(undefined);

const SafeNavigationContext: React.Context<INavigationFocusLike | undefined> =
  (
    ReactNavigationCore as {
      NavigationContext?: React.Context<INavigationFocusLike | undefined>;
    }
  ).NavigationContext ?? FallbackNavigationContext;

export interface IUseForceUpdateContactSupportOptions {
  initialForceUpdate?: boolean;
  enabled?: boolean;
  onInitialRemoteResponse?: (response: IAppUpdateInfo) => void;
}

export function useForceUpdateContactSupport({
  initialForceUpdate,
  enabled = true,
  onInitialRemoteResponse,
}: IUseForceUpdateContactSupportOptions = {}) {
  const navigation = useContext(SafeNavigationContext);
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const [updateInfo, setUpdateInfo] = useState<IAppUpdateInfo>(appUpdateInfo);
  const [hasRemoteResponse, setHasRemoteResponse] = useState(false);
  const [hasContactedSupport, setHasContactedSupport] = useState(() =>
    enabled ? consumePendingContactSupportHandoff() : false,
  );
  const didNotifyInitialRef = useRef(false);
  const onInitialRemoteResponseRef = useRef(onInitialRemoteResponse);
  onInitialRemoteResponseRef.current = onInitialRemoteResponse;
  const mountedRef = useRef(true);
  const prevAtomInfoRef = useRef(appUpdateInfo);

  const applyRemoteResponse = useCallback((response: IAppUpdateInfo) => {
    setUpdateInfo(response);
    setHasRemoteResponse(true);
    if (!didNotifyInitialRef.current) {
      didNotifyInitialRef.current = true;
      onInitialRemoteResponseRef.current?.(response);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const listener: IMountedForceUpdateListener = {
      onRemoteResponse: (response) => {
        if (enabled && mountedRef.current) {
          applyRemoteResponse(response);
        }
      },
      onContactSupport: () => {
        if (enabled && mountedRef.current) {
          setHasContactedSupport(true);
        }
      },
    };
    mountedForceUpdateListeners.add(listener);
    return () => {
      mountedRef.current = false;
      mountedForceUpdateListeners.delete(listener);
    };
  }, [applyRemoteResponse, enabled]);

  // Sync local `updateInfo` when `appUpdatePersistAtom` emits a new snapshot
  // after initial hydration so any external `fetchAppUpdateInfo(true)` call
  // also updates the lock state immediately.
  useEffect(() => {
    if (prevAtomInfoRef.current !== appUpdateInfo) {
      prevAtomInfoRef.current = appUpdateInfo;
      if (appUpdateInfo) {
        setUpdateInfo(appUpdateInfo);
      }
    }
  }, [appUpdateInfo]);

  const refreshUpdateInfo = useCallback(async () => {
    if (!enabled) {
      return undefined;
    }
    latestRefreshGeneration += 1;
    const generation = latestRefreshGeneration;
    try {
      const response =
        await backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
      if (generation !== latestRefreshGeneration) {
        return undefined;
      }
      if (response) {
        if (mountedRef.current) {
          applyRemoteResponse(response);
        }
        mountedForceUpdateListeners.forEach((listener) => {
          listener.onRemoteResponse(response);
        });
      }
      return response;
    } catch {
      // Keep fail-safe route-param lock when remote fetch fails.
      return undefined;
    }
  }, [applyRemoteResponse, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refreshUpdateInfo();
  }, [enabled, refreshUpdateInfo]);

  // `updateInfo` is seeded from the useAppUpdatePersistAtom() snapshot, which
  // during the jotai hydration race is still the non-force placeholder on the
  // first paint. Deriving the lock purely from it would leave a mandatory
  // update briefly dismissible until fetchAppUpdateInfo() resolves. The route
  // param is derived from authoritative state at navigation time, so a force
  // param must win on the first frame (fail-safe toward locked), while a fresh
  // remote response can unlock the page if the device was added to forceUpdateWhitelist.
  const resolvedForceUpdate = hasRemoteResponse
    ? isForceUpdateStrategy(updateInfo?.updateStrategy)
    : Boolean(initialForceUpdate) ||
      isForceUpdateStrategy(updateInfo?.updateStrategy);
  const isForceUpdate = enabled ? resolvedForceUpdate : false;

  // Re-fetch when returning from the support WebViewModal (navigation focus),
  // resuming the app from background (AppState 'active'), or regaining window focus.
  useEffect(() => {
    if (!enabled || !isForceUpdate) {
      return undefined;
    }
    const cleanups: Array<() => void> = [];

    if (typeof navigation?.addListener === 'function') {
      const unsubFocus = navigation.addListener('focus', () => {
        void refreshUpdateInfo();
      });
      if (typeof unsubFocus === 'function') {
        cleanups.push(unsubFocus);
      }
    }

    if (typeof AppState?.addEventListener === 'function') {
      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          void refreshUpdateInfo();
        }
      });
      if (appStateSub && typeof appStateSub.remove === 'function') {
        cleanups.push(() => appStateSub.remove());
      }
    }

    if (typeof globalThis.addEventListener === 'function') {
      const onWindowFocus = () => {
        void refreshUpdateInfo();
      };
      globalThis.addEventListener('focus', onWindowFocus);
      if (typeof globalThis.removeEventListener === 'function') {
        cleanups.push(() =>
          globalThis.removeEventListener('focus', onWindowFocus),
        );
      }
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [enabled, isForceUpdate, navigation, refreshUpdateInfo]);

  // After the user clicks "Contact Support", poll periodically while still
  // locked so that on Desktop/Web (where Intercom opens as an in-page widget
  // without changing app/window focus) the force-update lock is lifted
  // automatically once support adds their instanceId to forceUpdateWhitelist.
  useEffect(() => {
    if (!enabled || !isForceUpdate || !hasContactedSupport) {
      return undefined;
    }
    const timer = setInterval(() => {
      void refreshUpdateInfo();
    }, CONTACT_SUPPORT_RECHECK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [enabled, hasContactedSupport, isForceUpdate, refreshUpdateInfo]);

  const handleContactSupport = useCallback(async () => {
    setHasContactedSupport(true);
    mountedForceUpdateListeners.forEach((listener) => {
      listener.onContactSupport();
    });
    try {
      await showIntercom();
    } catch {
      // Keep polling active even if opening Intercom fails.
    }
  }, []);

  return {
    updateInfo,
    isForceUpdate,
    hasRemoteResponse,
    refreshUpdateInfo,
    handleContactSupport,
  };
}

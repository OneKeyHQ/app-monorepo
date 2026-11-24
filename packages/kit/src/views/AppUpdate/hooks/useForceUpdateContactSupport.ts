import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import * as ReactNavigationCore from '@react-navigation/core';
import { AppState } from 'react-native';

import { showIntercom } from '@onekeyhq/kit/src/views/Intercom/client';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isForceUpdateStrategy } from '../../../components/AppUpdate';

import {
  type IMountedForceUpdateListener,
  mountedForceUpdateListeners,
} from './forceUpdateSurfaces';

export const CONTACT_SUPPORT_RECHECK_INTERVAL_MS = 10_000;
export const CONTACT_SUPPORT_HANDOFF_WAIT_MS = 1000;

async function waitForMountedHandoff(
  key: 'supportHandoffId' | 'downloadHandoffId',
  handoffId: string,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  while (
    !Array.from(mountedForceUpdateListeners).some(
      (listener) => listener[key] === handoffId,
    )
  ) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    await timerUtils.wait(Math.min(50, remaining));
  }
  return true;
}

export function waitForFeaturedDownloadPage(downloadHandoffId: string) {
  return waitForMountedHandoff('downloadHandoffId', downloadHandoffId, 5000);
}

export function waitForContactSupportHandoff(supportHandoffId: string) {
  return waitForMountedHandoff(
    'supportHandoffId',
    supportHandoffId,
    CONTACT_SUPPORT_HANDOFF_WAIT_MS,
  );
}

// A late older response cannot overwrite a newer decision. A failed request
// does not discard an older successful response.
let lastStartedRefreshGeneration = 0;
let lastAppliedRefreshGeneration = 0;

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
  routeKey?: string;
  supportHandoffId?: string;
  downloadHandoffId?: string;
  enabled?: boolean;
  onInitialRemoteResponse?: (response: IAppUpdateInfo) => void;
}

export function useForceUpdateContactSupport({
  initialForceUpdate,
  routeKey,
  supportHandoffId,
  downloadHandoffId,
  enabled = true,
  onInitialRemoteResponse,
}: IUseForceUpdateContactSupportOptions = {}) {
  const navigation = useContext(SafeNavigationContext);
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const [updateInfo, setUpdateInfo] = useState<IAppUpdateInfo>(appUpdateInfo);
  const [hasRemoteResponse, setHasRemoteResponse] = useState(false);
  const [hasContactedSupport, setHasContactedSupport] = useState(false);
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
    lastStartedRefreshGeneration += 1;
    const generation = lastStartedRefreshGeneration;
    try {
      const response =
        await backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
      if (generation < lastAppliedRefreshGeneration) {
        return undefined;
      }
      if (response) {
        lastAppliedRefreshGeneration = generation;
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

  useLayoutEffect(() => {
    mountedRef.current = true;
    const listener: IMountedForceUpdateListener = {
      isForceUpdate,
      routeKey,
      supportHandoffId,
      downloadHandoffId,
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
  }, [
    applyRemoteResponse,
    downloadHandoffId,
    enabled,
    isForceUpdate,
    routeKey,
    supportHandoffId,
  ]);

  // Re-fetch when returning from the support modal (navigation focus),
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

  // Continue checking the whitelist while the support modal covers this page
  // so support can release the update lock without an app/window focus change.
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

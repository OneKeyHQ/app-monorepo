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

import { showIntercom } from '@onekeyhq/kit/src/views/Intercom/client';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isForceUpdateStrategy } from '../../../components/AppUpdate';

export const CONTACT_SUPPORT_RECHECK_INTERVAL_MS = 10_000;
const CONTACT_SUPPORT_HANDOFF_TTL_MS = 5000;
export const CONTACT_SUPPORT_HANDOFF_WAIT_MS = 1000;

type IMountedForceUpdateListener = {
  onRemoteResponse: (response: IAppUpdateInfo) => void;
  onContactSupport: () => void;
};

const mountedForceUpdateListeners = new Set<IMountedForceUpdateListener>();
// Each handoff gets a generation so a late mount effect from a superseded
// handoff can never satisfy a newer one.
let contactSupportHandoffGeneration = 0;
let pendingContactSupportHandoff:
  | { at: number; generation: number }
  | undefined;
let acceptedContactSupportHandoffGeneration = 0;
const contactSupportHandoffWaiters = new Map<
  (accepted: boolean) => void,
  number
>();
// Shared across hook instances because every response is broadcast to all
// mounted listeners. A response is dropped only when a newer one has already
// been applied: a late older response cannot overwrite a newer lock decision,
// while a newer request that fails does not discard an older success.
let lastStartedRefreshGeneration = 0;
let lastAppliedRefreshGeneration = 0;

export function markPendingContactSupportHandoff(): void {
  contactSupportHandoffGeneration += 1;
  pendingContactSupportHandoff = {
    at: Date.now(),
    generation: contactSupportHandoffGeneration,
  };
  // A superseded handoff will never be accepted; release its waiters now.
  contactSupportHandoffWaiters.forEach((_, settle) => settle(false));
}

function acceptContactSupportHandoff(generation: number) {
  if (generation !== contactSupportHandoffGeneration) {
    return;
  }
  acceptedContactSupportHandoffGeneration = generation;
  contactSupportHandoffWaiters.forEach((waiterGeneration, settle) => {
    if (waiterGeneration === generation) {
      settle(true);
    }
  });
}

// Resolves once a page that took over the latest handoff has committed its
// mount, so its lock and whitelist polling sit below support. Resolves false
// after `timeoutMs` when no page takes over (e.g. a deduplicated modal push)
// or when a newer handoff supersedes it.
export function waitForContactSupportHandoff(
  timeoutMs = CONTACT_SUPPORT_HANDOFF_WAIT_MS,
): Promise<boolean> {
  const generation = contactSupportHandoffGeneration;
  if (
    generation > 0 &&
    acceptedContactSupportHandoffGeneration === generation
  ) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timeout: { id?: ReturnType<typeof setTimeout> } = {};
    const settle = (accepted: boolean) => {
      clearTimeout(timeout.id);
      contactSupportHandoffWaiters.delete(settle);
      resolve(accepted);
    };
    timeout.id = setTimeout(() => settle(false), timeoutMs);
    contactSupportHandoffWaiters.set(settle, generation);
  });
}

// Returns the generation of a fresh pending handoff, or 0 when there is none.
function consumePendingContactSupportHandoff(): number {
  const pending = pendingContactSupportHandoff;
  pendingContactSupportHandoff = undefined;
  if (!pending) {
    return 0;
  }
  return Date.now() - pending.at <= CONTACT_SUPPORT_HANDOFF_TTL_MS
    ? pending.generation
    : 0;
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
  const [acceptedHandoffGeneration] = useState(() =>
    enabled ? consumePendingContactSupportHandoff() : 0,
  );
  const [hasContactedSupport, setHasContactedSupport] = useState(
    acceptedHandoffGeneration > 0,
  );
  useEffect(() => {
    if (acceptedHandoffGeneration > 0) {
      acceptContactSupportHandoff(acceptedHandoffGeneration);
    }
  }, [acceptedHandoffGeneration]);
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

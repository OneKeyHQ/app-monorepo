/* eslint-disable global-require */
import { type PropsWithChildren, useEffect, useRef, useState } from 'react';

import { Splash } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { appStorage } from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const SPLASH_SAFETY_TIMEOUT = 10_000;
const jsEntryStart: number =
  (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();

function logSplashProvider(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    const elapsed = Date.now() - jsEntryStart;
    defaultLogger.app.appUpdate.log(
      `[SplashProvider] ${message} (+${elapsed}ms)`,
    );
  }
}

/** Check if jotai was hydrated from MMKV snapshot WITH balance data.
 *  When balance cache exists, React renders cached balance on first render,
 *  HomePageReady fires immediately, and splash dismisses fast.
 *  Without balance cache, waiting for HomePageReady would stall splash
 *  until a network fetch completes — so we dismiss immediately instead. */
function hasBalanceCacheInSnapshot(): boolean {
  const snapshot = (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__ as
    | Record<string, unknown>
    | undefined;
  if (!snapshot) return false;
  return Object.keys(snapshot).some(
    (k) => k.includes('ctx:accountWorthAtom') && snapshot[k] != null,
  );
}

/**
 * Splash dismiss strategy — three paths:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Path 1: Balance cache exists (hasCachedStates=true)                │
 * │   MMKV snapshot contains accountWorthAtom → jotai hydrates cached  │
 * │   balance into atoms → React renders real balance on first frame   │
 * │   → HomePageReady fires immediately → splash dismisses instantly.  │
 * │   This is the SSR hydration fast-path.                             │
 * │                                                                    │
 * │ Path 2: No balance cache, but OTA pending task exists              │
 * │   A downloaded bundle update needs to be applied before the app    │
 * │   can render correctly. Wait for background thread to process it   │
 * │   (PendingInstallTaskProcessFinished event), then dismiss.         │
 * │   Pending task presence is checked locally via MMKV (no RPC).      │
 * │                                                                    │
 * │ Path 3: No balance cache, no pending task                          │
 * │   Nothing to wait for — dismiss splash immediately (0ms).          │
 * │   Typical for fresh installs or first launch after update.         │
 * │                                                                    │
 * │ In all paths, processPendingInstallTask runs as fire-and-forget    │
 * │ in the background — it never blocks splash dismissal.              │
 * │                                                                    │
 * │ Safety: 10s timeout guarantees splash dismissal if any path stalls.│
 * └─────────────────────────────────────────────────────────────────────┘
 */
export const useCanDismissSplash =
  platformEnv.isDesktop || platformEnv.isNative
    ? () => {
        const hasCachedStates = hasBalanceCacheInSnapshot();

        const [canDismissSplash, setCanDismissSplash] = useState(false);
        const hasLaunchCallbackStartedRef = useRef(false);

        useEffect(() => {
          if (hasLaunchCallbackStartedRef.current) {
            return;
          }
          hasLaunchCallbackStartedRef.current = true;
          logSplashProvider(
            `effect started, hasCachedStates=${hasCachedStates}`,
          );

          const safetyTimer = setTimeout(() => {
            defaultLogger.app.appUpdate.log(
              `SplashProvider: safety timer fired after ${SPLASH_SAFETY_TIMEOUT}ms, forcing splash hide`,
            );
            logSplashProvider('safety timer fired');
            setCanDismissSplash(true);
          }, SPLASH_SAFETY_TIMEOUT);

          const dismiss = () => {
            clearTimeout(safetyTimer);
            setCanDismissSplash(true);
          };

          const handleHomePageReady = () => {
            logSplashProvider('HomePageReady event received');
            dismiss();
          };

          const handlePendingInstallTaskFinished = () => {
            logSplashProvider('pending install task finished event received');
            dismiss();
          };

          // ── Determine dismiss strategy ──
          // 1. Balance cache → wait HomePageReady (instant with hydration)
          // 2. Pending OTA task → wait for background RPC to finish
          // 3. Neither → dismiss immediately, no need to wait
          const hasPendingTask = Boolean(
            appStorage.syncStorage.getString(
              EAppSyncStorageKeys.onekey_pending_install_task,
            ),
          );
          logSplashProvider(
            `hasCachedStates=${hasCachedStates}, hasPendingTask=${hasPendingTask}`,
          );

          if (hasCachedStates) {
            // SSR hydration path: cached balance renders instantly,
            // HomePageReady fires on first render frame.
            if ((globalThis as any).__onekeyBalanceDisplayed) {
              logSplashProvider(
                'HomePageReady already fired before listener attached, dismiss immediately',
              );
              dismiss();
            } else {
              appEventBus.on(
                EAppEventBusNames.HomePageReady,
                handleHomePageReady,
              );
            }
          } else if (hasPendingTask) {
            // OTA install pending: must wait for background to apply it.
            appEventBus.on(
              EAppEventBusNames.PendingInstallTaskProcessFinished,
              handlePendingInstallTaskFinished,
            );
          } else {
            // No cache, no pending task: dismiss immediately.
            logSplashProvider('no cache and no pending task, dismiss immediately');
            dismiss();
          }

          // Fire-and-forget: run pending task in background without blocking splash.
          void (async () => {
            try {
              logSplashProvider('processPendingInstallTask start');
              await backgroundApiProxy.servicePendingInstallTask.processPendingInstallTask();
              logSplashProvider('processPendingInstallTask resolved');
            } catch (error) {
              logSplashProvider(
                `processPendingInstallTask failed: ${(error as Error)?.message ?? 'unknown'}`,
              );
            }
          })();

          return () => {
            logSplashProvider('effect cleanup');
            clearTimeout(safetyTimer);
            appEventBus.off(
              EAppEventBusNames.HomePageReady,
              handleHomePageReady,
            );
            appEventBus.off(
              EAppEventBusNames.PendingInstallTaskProcessFinished,
              handlePendingInstallTaskFinished,
            );
          };
        }, [hasCachedStates]);

        useEffect(() => {
          logSplashProvider(`canDismissSplash=${canDismissSplash}`);
        }, [canDismissSplash]);

        return canDismissSplash;
      }
    : () => true;

export function SplashProvider({ children }: PropsWithChildren<unknown>) {
  const canDismissSplash = useCanDismissSplash();
  logSplashProvider(`render canDismissSplash=${canDismissSplash}`);

  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('SplashProvider render');
  }

  // Web platform: skip splash screen entirely, render children directly
  useEffect(() => {
    if (platformEnv.isWeb) {
      globalThis.$$onekeyUIVisibleAt = Date.now();
    }
  }, []);

  if (platformEnv.isWeb) {
    return <>{children}</>;
  }

  return <Splash canDismissSplash={canDismissSplash}>{children}</Splash>;
}

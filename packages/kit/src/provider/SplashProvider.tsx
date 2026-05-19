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
import { hasPendingInstallTask } from '@onekeyhq/shared/src/utils/pendingTaskUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const SPLASH_SAFETY_TIMEOUT = 5000;
const jsEntryStart: number =
  (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();

// EXPERIMENT: dismiss splash immediately when SplashProvider mounts — skip
// waiting for HomePageReady / PendingInstallTaskProcessFinished.
// Uses a synchronous state update (no setTimeout) so the main-thread-busy
// window doesn't starve the dismissal. Trades "guaranteed balance on first
// visible frame" for ~300-500ms perceived TTI gain.
// Tests that need to exercise the original cache-aware dismissal logic can
// set `globalThis.__ONEKEY_DISABLE_SPLASH_DISMISS_ON_MOUNT = true` before
// loading this module.
const EXPERIMENT_DISMISS_SPLASH_ON_MOUNT =
  (globalThis as any).__ONEKEY_DISABLE_SPLASH_DISMISS_ON_MOUNT !== true;

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

/** Check if jotai was hydrated with EXACTLY the data `HomeOverviewContainer`
 *  needs to render a balance on its first frame. Only a first-frame-ready
 *  render lets `HomePageReady` fire before the 5s safety timer, so this
 *  check has to mirror HomeOverviewContainer's first-frame data path — not
 *  merely "there is some balance-shaped cache lying around".
 *
 *  HomeOverviewContainer first-frame path (see `HomeOverviewContainer.tsx`):
 *    ownerKey = `${account.id}__${network.id}`            (`buildOverviewOwnerKey`)
 *    currentConfirmedBalance = lastConfirmedOverviewBalance.byOwner[ownerKey]
 *    balanceReady ← currentConfirmedBalance is truthy
 *  The `latest` field and the `canReuseLatestDisplayedBalance` branch both
 *  require runtime atoms (`overviewTokenCacheState` / `overviewDeFiDataState`)
 *  that are not yet hydrated on frame 1, so they cannot satisfy `balanceReady`.
 *
 *  For the fast path to pay off the snapshot must provide, simultaneously:
 *    (1) `lastConfirmedOverviewBalanceAtom.byOwner` is non-empty
 *    (2) `accountSelector@home::activeAccountsAtom[0]` is hydrated with
 *         a concrete `{ account.id, network.id }` pair
 *    (3) `byOwner[`${account.id}__${network.id}`]` is a non-empty string
 *        (exact ownerKey hit — otherwise HomeOverviewContainer won't read
 *        it on the first frame)
 *
 *  `accountWorthAtom` deliberately stays out of the check: a Home reset can
 *  persist `{ worth: {}, initialized: false }` into it, making it look
 *  "populated" while contributing nothing to the first-frame render.
 *
 *  Missing any of (1)(2)(3) → fall back to path 3 (no cache, dismiss
 *  immediately) rather than waiting 5s for `HomePageReady` that will never
 *  fire. */
function hasBalanceCacheInSnapshot(): boolean {
  const snapshot = (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__ as
    | Record<string, unknown>
    | undefined;
  if (!snapshot) return false;

  // (1) byOwner must be non-empty — it is the only source of
  //     currentConfirmedBalance on the first render frame.
  const balanceKey = Object.keys(snapshot).find((key) =>
    key.includes('ctx:lastConfirmedOverviewBalanceAtom'),
  );
  const balanceValue = balanceKey
    ? (snapshot[balanceKey] as { byOwner?: Record<string, unknown> } | null)
    : null;
  const byOwner =
    balanceValue?.byOwner && Object.keys(balanceValue.byOwner).length > 0
      ? balanceValue.byOwner
      : undefined;
  if (!byOwner) return false;

  // (2) The Home account selector's activeAccounts must already be
  //     hydrated at num=0, which is what `HomeOverviewContainer` reads
  //     to compute `currentOverviewOwnerKey` on mount.
  const activeKey = Object.keys(snapshot).find(
    (key) =>
      key.includes('accountSelector@home') &&
      key.includes('ctx:activeAccountsAtom'),
  );
  const activeValue = activeKey
    ? (snapshot[activeKey] as Record<
        number,
        { account?: { id?: string }; network?: { id?: string } } | undefined
      > | null)
    : null;
  const homeActive = activeValue?.[0];
  const accountId = homeActive?.account?.id;
  const networkId = homeActive?.network?.id;
  if (!accountId || !networkId) return false;

  // (3) The ownerKey HomeOverviewContainer will compute must land in
  //     byOwner with a real balance string — mirrors buildOverviewOwnerKey
  //     in kit/src/states/jotai/contexts/accountOverview/atoms.ts.
  const ownerKey = `${accountId}__${networkId}`;
  const balance = byOwner[ownerKey];
  return typeof balance === 'string' && balance.length > 0;
}

/**
 * Splash dismiss strategy — three paths:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Path 1: Balance cache exists (hasCachedStates=true)                │
 * │   MMKV snapshot has lastConfirmedOverviewBalanceAtom with non-empty│
 * │   latest/byOwner → jotai hydrates → React reads it to render real  │
 * │   balance on first frame → HomePageReady fires immediately →       │
 * │   splash dismisses instantly. This is the SSR hydration fast-path. │
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
 * │ Safety: 5s timeout guarantees splash dismissal if any path stalls. │
 * └─────────────────────────────────────────────────────────────────────┘
 */
export const useCanDismissSplash =
  platformEnv.isDesktop || platformEnv.isNative
    ? () => {
        const hasCachedStates = hasBalanceCacheInSnapshot();

        const [canDismissSplash, setCanDismissSplash] = useState(false);
        const hasLaunchCallbackStartedRef = useRef(false);

        // EXPERIMENT short-circuit: synchronous dismiss on mount. No setTimeout —
        // the main-thread-busy window around React mount starves setTimeout(50)
        // to 100-350ms, defeating the "50ms" intent. A sync setState dispatches
        // in React's scheduler directly and avoids the starvation tax.
        useEffect(() => {
          if (!EXPERIMENT_DISMISS_SPLASH_ON_MOUNT) return;
          logSplashProvider('experiment: immediate dismiss on mount');
          setCanDismissSplash(true);
        }, []);

        // Unconditional safety timer: mounts once and guarantees dismissal
        // regardless of which path (cached/pending/none) is taken, or whether
        // `hasCachedStates` changes mid-session (which would cancel the main
        // effect's cleanup and leave a stale, cleared timer otherwise).
        useEffect(() => {
          const timer = setTimeout(() => {
            defaultLogger.app.appUpdate.log(
              `SplashProvider: safety timer fired after ${SPLASH_SAFETY_TIMEOUT}ms, forcing splash hide`,
            );
            logSplashProvider('safety timer fired');
            setCanDismissSplash(true);
          }, SPLASH_SAFETY_TIMEOUT);
          return () => clearTimeout(timer);
        }, []);

        useEffect(() => {
          if (hasLaunchCallbackStartedRef.current) {
            return;
          }
          hasLaunchCallbackStartedRef.current = true;
          logSplashProvider(
            `effect started, hasCachedStates=${hasCachedStates}`,
          );

          const dismiss = () => {
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
          const hasPendingTask = hasPendingInstallTask();
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
            logSplashProvider(
              'no cache and no pending task, dismiss immediately',
            );
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

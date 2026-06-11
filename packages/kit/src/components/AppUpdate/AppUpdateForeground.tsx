import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import { useInTabDialog } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
  getUpdateFileType,
  isFirstLaunchAfterUpdated,
  isNeedUpdate,
  isWhatsNewShown,
  markWhatsNewShown,
} from '@onekeyhq/shared/src/appUpdate';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { runAfterTokensDone } from '../../hooks/useRunAfterTokensDone';
import { whenAppUnlocked } from '../../utils/passwordUtils';
import { tryShowFeaturedDialog } from '../../views/AppUpdate/dialogs/tryShowFeaturedDialog';

import { buildSoftwareUpdateParams } from './updateAnalytics';
// OK-55397: showSilentUpdateDialogUI no longer used — silent updates are
// applied via a pending install task on restart instead of a "ready" dialog.
import { showUpdateDialogUI } from './updateDialogs';
import { isAutoUpdateStrategy, isForceUpdateStrategy } from './updateStrategy';
import { useDownloadPackage } from './useDownloadPackage';

// Module-level guard so the first-launch dispatch effect fires exactly
// once across the lifetime of the app, even if AppUpdateForeground is
// remounted (StrictMode / hot reload). Independent from the
// component-local `cancelled` flag which only protects against in-flight
// awaits after unmount.
let didRunFirstLaunchDispatch = false;
// Silent-ready dialog should fire at most once per app session even if
// the persist atom hydrates after the first-launch dispatch useEffect has
// already consumed didRunFirstLaunchDispatch. Tracked separately so the
// watcher effect below can react to a late hydration / in-session status
// transition without re-running the full first-launch dispatch.
let silentReadyDialogShown = false;

/**
 * Mount-once foreground container for app-update side effects.
 *
 * Two side effects live here, both naturally global and previously
 * scattered across multiple `useAppUpdateInfo` mounts in
 * `UpdateReminder/hooks.tsx`:
 *
 *   1. First-launch dispatch — on first render, decides what to do
 *      based on the persisted update status:
 *        - 'firstLaunchAfterUpdated' → mark whatsNew shown + report
 *          softwareUpdateResult({status:'success'})
 *        - status in {downloadPackage, downloadASC, verifyASC,
 *          verifyPackage} → resume the corresponding step
 *        - status === 'ready' → silent / seamless / manual dialog
 *        - default → fetchUpdateInfo and act on the response
 *      Previously this lived in `useAppUpdateInfo`'s autoCheck
 *      useEffect which N consumers all triggered, gated by a module
 *      `let isFirstLaunch = true`. Centralized here — no flag
 *      coordination, just one mount.
 *
 *   2. AppState 'active' resume — when the app returns to the
 *      foreground, ask the service whether a stalled download should
 *      resume (status===downloadPackageFailed/downloadASCFailed +
 *      30s cooldown gate; concurrent-safe via claim-before-await).
 *      If the service says yes, fire JS downloadPackage() to actually
 *      kick the byte transfer. Previously per-mount; now exactly one
 *      listener for the entire app.
 *
 * Renders nothing. Mount once at app boot via Bootstrap.tsx.
 */
/**
 * Hook form of the AppUpdateForeground side effects. Used by:
 *   - <AppUpdateForeground /> component (always enabled)
 *   - useAppUpdateInfo(autoCheck=true) opt-in path (kept for the
 *     existing test suite which exercised side effects via the hook)
 *
 * `enabled=false` makes the hook a no-op while still calling all
 * underlying hooks at the top level (Rules of Hooks compliance).
 * Production callers of useAppUpdateInfo default autoCheck=false, so
 * exactly one site (the <AppUpdateForeground /> mount in Bootstrap)
 * runs the effects in production.
 */
export function useAppUpdateForegroundEffects(enabled = true) {
  const intl = useIntl();
  const themeVariant = useThemeVariant();
  const navigation = useAppNavigation();
  const dialog = useInTabDialog();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const {
    downloadPackage,
    verifyPackage,
    verifyASC,
    downloadASC,
    installPackage,
  } = useDownloadPackage();

  const onViewReleaseInfo = useCallback(() => {
    if (platformEnv.isE2E) return;
    setTimeout(async () => {
      if (await tryShowFeaturedDialog(false)) return;
      navigation.pushModal(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.WhatsNew,
      });
    });
  }, [navigation]);

  const toUpdatePreviewPage = useCallback(
    (
      isFull = false,
      params?: { latestVersion?: string; isForceUpdate?: boolean },
    ) => {
      setTimeout(async () => {
        if (await tryShowFeaturedDialog(true)) return;
        const currentAppUpdateInfo =
          await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
        const pushModal = isFull
          ? navigation.pushFullModal
          : navigation.pushModal;
        pushModal(EModalRoutes.AppUpdateModal, {
          screen: EAppUpdateRoutes.UpdatePreview,
          params: {
            latestVersion:
              params?.latestVersion ?? currentAppUpdateInfo.latestVersion,
            isForceUpdate:
              params?.isForceUpdate ??
              isForceUpdateStrategy(appUpdateInfo.updateStrategy),
            autoClose: isFull,
            ...params,
          },
        });
      }, 0);
    },
    [appUpdateInfo.updateStrategy, navigation],
  );

  // OK-55397: silent updates no longer show a "ready" dialog. The downloaded
  // package is queued as a pending install task in
  // ServiceAppUpdate.readyToInstall → syncPendingInstallTaskWithReleaseInfo
  // (silent is now allowed past the strategy gate) and applied on the next
  // restart; the header / reminder update button lets the user restart-install
  // immediately. Dialog plumbing kept commented out for an easy revert.
  // const showSilentUpdateDialog = useCallback(() => {
  //   setTimeout(async () => {
  //     const currentUpdateInfo =
  //       await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
  //     await whenAppUnlocked();
  //     await showSilentUpdateDialogUI({
  //       intl,
  //       summary: currentUpdateInfo.summary || '',
  //       themeVariant,
  //       onConfirm: () => {
  //         navigation.pushModal(EModalRoutes.AppUpdateModal, {
  //           screen: EAppUpdateRoutes.DownloadVerify,
  //         });
  //       },
  //     });
  //   }, 0);
  // }, [intl, navigation, themeVariant]);

  const showUpdateDialog = useCallback(
    (
      isFull = false,
      params?: {
        latestVersion?: string;
        jsBundleVersion?: string;
        isForceUpdate?: boolean;
        summary?: string;
        storeUrl?: string;
      },
    ) => {
      setTimeout(async () => {
        await whenAppUnlocked();
        const currentUpdateInfo =
          await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
        showUpdateDialogUI({
          dialog,
          intl,
          themeVariant,
          summary: params?.summary || '',
          lastUpdateDialogShownAt: currentUpdateInfo.lastUpdateDialogShownAt,
          onConfirm: () => {
            const fileType = getUpdateFileType({
              latestVersion:
                params?.latestVersion ?? currentUpdateInfo.latestVersion,
              jsBundleVersion:
                params?.jsBundleVersion ?? currentUpdateInfo.jsBundleVersion,
            });
            if (
              !platformEnv.isExtension &&
              params?.storeUrl &&
              fileType === EUpdateFileType.appShell
            ) {
              openUrlExternal(params.storeUrl);
            } else {
              setTimeout(async () => {
                const updateInfo =
                  await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
                if (updateInfo.status === EAppUpdateStatus.ready) {
                  navigation.pushModal(EModalRoutes.AppUpdateModal, {
                    screen: EAppUpdateRoutes.DownloadVerify,
                    params: {
                      isForceUpdate: isForceUpdateStrategy(
                        currentUpdateInfo.updateStrategy,
                      ),
                    },
                  });
                } else {
                  toUpdatePreviewPage(isFull, params);
                }
              }, 120);
            }
            defaultLogger.app.component.confirmedInUpdateDialog();
          },
        });
      }, 0);
    },
    [dialog, intl, navigation, themeVariant, toUpdatePreviewPage],
  );

  const checkForUpdates = useCallback(async () => {
    defaultLogger.app.appUpdate.startCheckForUpdatesOnly();
    const response =
      await backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
    const { shouldUpdate, fileType, isRollback } = isNeedUpdate({
      latestVersion: response?.latestVersion,
      jsBundleVersion: response?.jsBundleVersion,
      status: response?.status,
    });
    const updateStrategy = response?.updateStrategy ?? EUpdateStrategy.manual;
    return {
      isForceUpdate: isForceUpdateStrategy(updateStrategy),
      isNeedUpdate: shouldUpdate,
      isRollback,
      updateFileType: fileType,
      response,
    };
  }, []);

  // First-launch dispatch — runs once per app lifecycle.
  useEffect(() => {
    if (!enabled) return;
    if (didRunFirstLaunchDispatch) return;
    didRunFirstLaunchDispatch = true;

    let isShowForceUpdatePreviewPage = false;
    let cancelled = false;
    let hasTriggeredUpdateCheck = false;
    let cleanupUpdateCheck: (() => void) | undefined;
    let cleanupPruneStaleArtifacts: (() => void) | undefined;

    const fetchUpdateInfo = (_trigger: string) => {
      void checkForUpdates().then(
        async ({
          isNeedUpdate: needUpdate,
          isForceUpdate,
          isRollback,
          response,
        }) => {
          if (isShowForceUpdatePreviewPage) return;
          // Late-hydration race: persist atom may hydrate to `ready` after
          // we queued this check, in which case the silent-ready watcher
          // (or seamless install path) is already handling the same target.
          // Re-downloading here would clobber the ready bundle on disk and
          // hand the user a half-written file when they confirm install.
          if (response?.status === EAppUpdateStatus.ready) return;
          const updateStrategy =
            response?.updateStrategy ?? EUpdateStrategy.manual;
          if (needUpdate) {
            if (isAutoUpdateStrategy(updateStrategy)) {
              void downloadPackage();
            } else if (isForceUpdate) {
              toUpdatePreviewPage(true, response);
            } else if (platformEnv.isNative || platformEnv.isDesktop) {
              setTimeout(() => {
                showUpdateDialog(false, response);
              }, 200);
            }
          } else if (
            isRollback &&
            response?.status === EAppUpdateStatus.notify
          ) {
            // Rollback always auto-downloads regardless of server strategy —
            // it is a corrective action, not a user-facing update.
            void downloadPackage();
          }
        },
      );
    };

    const scheduleFetchUpdateInfo = () => {
      if (cancelled || hasTriggeredUpdateCheck || cleanupUpdateCheck) return;
      const triggerFetch = (trigger: string) => {
        if (cancelled || hasTriggeredUpdateCheck) return;
        hasTriggeredUpdateCheck = true;
        cleanupUpdateCheck?.();
        cleanupUpdateCheck = undefined;
        fetchUpdateInfo(trigger);
      };
      cleanupUpdateCheck = runAfterTokensDone({
        onRun: (trigger) => triggerFetch(trigger),
      });
    };

    // Read the authoritative persisted state via the service instead of the
    // React-hook snapshot. The hook's `appUpdateInfo` can still be the
    // initial-value placeholder ({status: done, latestVersion: '0.0.0'}) at
    // the moment this empty-deps effect runs on cold start, because jotai's
    // per-key MMKV hydration races against the first paint. When that
    // happens, isFirstLaunchAfterUpdated() returns false on the very launch
    // that *is* the first launch after an update, the post-update "what's
    // new" dialog is skipped, and the module-level didRunFirstLaunchDispatch
    // guard prevents any retry — so the dialog ends up surfacing on the
    // following cold launch instead of the one right after the install.
    void (async () => {
      const info = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      if (cancelled) return;

      if (isFirstLaunchAfterUpdated(info)) {
        // After the update has completed, current == target, so
        // getUpdateFileType always returns appShell. Derive the actual type
        // from the persisted info so bundle (hot-update) successes aren't
        // misclassified as app-shell in analytics.
        const fileType = info.jsBundleVersion
          ? EUpdateFileType.jsBundle
          : EUpdateFileType.appShell;
        // Re-emit the persisted attemptId from the original
        // softwareUpdateStarted so per-attempt funnels stay correlated
        // across the install/relaunch boundary; falls back to a fresh UUID
        // if the persist atom was wiped before this code ran.
        defaultLogger.app.appUpdate.softwareUpdateResult({
          ...buildSoftwareUpdateParams(
            fileType,
            info,
            info.currentUpdateAttemptId,
          ),
          status: 'success',
        });
        const whatsNewAlreadyShown = isWhatsNewShown();
        markWhatsNewShown(Boolean(info.jsBundleVersion));
        if (
          info.updateStrategy !== EUpdateStrategy.seamless &&
          !whatsNewAlreadyShown
        ) {
          onViewReleaseInfo();
        }
        setTimeout(async () => {
          await backgroundApiProxy.serviceAppUpdate.refreshUpdateStatus();
          scheduleFetchUpdateInfo();
        }, 250);
        return;
      }

      const forceUpdate = isForceUpdateStrategy(info.updateStrategy);
      if (info.status !== EAppUpdateStatus.done && forceUpdate) {
        isShowForceUpdatePreviewPage = true;
        // Pass the force semantics derived from the authoritative `info` so
        // the preview route locks down (usePreventRemove / header) on its
        // first render. Without this, toUpdatePreviewPage falls back to the
        // hook's `appUpdateInfo.updateStrategy`, which can still be the
        // pre-hydration placeholder during the very race this effect guards
        // against — briefly opening a mandatory update as dismissible.
        toUpdatePreviewPage(true, { ...info, isForceUpdate: forceUpdate });
      }

      if (info.status === EAppUpdateStatus.updateIncomplete) {
        // do nothing
      } else if (info.status === EAppUpdateStatus.downloadPackage) {
        void downloadPackage();
      } else if (info.status === EAppUpdateStatus.downloadASC) {
        void downloadASC();
      } else if (info.status === EAppUpdateStatus.verifyASC) {
        void verifyASC();
      } else if (info.status === EAppUpdateStatus.verifyPackage) {
        void verifyPackage();
      } else if (info.status === EAppUpdateStatus.ready) {
        if (isShowForceUpdatePreviewPage) return;
        const fileType = getUpdateFileType(info);
        if (info.updateStrategy === EUpdateStrategy.seamless) {
          if (fileType === EUpdateFileType.jsBundle) {
            if (
              info.downloadedEvent?.signature &&
              info.downloadedEvent?.sha256
            ) {
              void BundleUpdate.installBundle(info.downloadedEvent);
            } else {
              defaultLogger.app.appUpdate.endInstallPackage(
                false,
                new Error('Missing signature or sha256 for seamless install'),
              );
              void backgroundApiProxy.serviceAppUpdate.reset();
            }
          } else {
            void installPackage(
              () => undefined,
              () => {
                void backgroundApiProxy.serviceAppUpdate.resetToInComplete();
              },
            );
          }
        } else if (info.updateStrategy === EUpdateStrategy.silent) {
          // OK-55397: silent no longer pops a dialog here. readyToInstall has
          // already queued a pending install task (silent is allowed past the
          // strategy gate), applied on the next restart; the update button
          // offers an immediate restart-install. Keep the guard set so the
          // (now no-op) silent-ready watcher below stays consistent.
          silentReadyDialogShown = true;
          // showSilentUpdateDialog();
        } else {
          showUpdateDialog();
        }
      } else {
        scheduleFetchUpdateInfo();
      }
    })();

    // Cold-start idle sweep of stale download artifacts (old-appVersion OTA
    // bundles + Android APK cache when no update is pending). Deferred to
    // after the first-render token-load settle so it never competes with
    // boot work, and runs at most once per launch (service-side debounce +
    // the module-level didRunFirstLaunchDispatch guard on this effect).
    cleanupPruneStaleArtifacts = runAfterTokensDone({
      onRun: () => {
        if (cancelled) return;
        void backgroundApiProxy.serviceAppUpdate
          .pruneStaleArtifacts()
          .catch(() => {
            // pruneStaleArtifacts already swallows internally; this is a
            // belt-and-braces guard so a rejected proxy call can never
            // surface an unhandled rejection.
          });
      },
    });

    return () => {
      cancelled = true;
      cleanupUpdateCheck?.();
      cleanupUpdateCheck = undefined;
      cleanupPruneStaleArtifacts?.();
      cleanupPruneStaleArtifacts = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Silent-ready watcher — independent of didRunFirstLaunchDispatch.
  // The first-launch dispatch effect above runs exactly once with an
  // empty dep list, so it cannot react to status changes that arrive
  // after the first run (e.g. a silent download completes in-session, or
  // the persist atom hydrates after the initial render on restart). This
  // dedicated effect covers both cases. silentReadyDialogShown (module-
  // level) ensures only one dispatch per app session even when the hook
  // is mounted twice (StrictMode / the legacy useAppUpdateInfo opt-in).
  useEffect(() => {
    if (!enabled) return;
    if (silentReadyDialogShown) return;
    if (appUpdateInfo.updateStrategy !== EUpdateStrategy.silent) return;
    if (appUpdateInfo.status !== EAppUpdateStatus.ready) return;
    if (isFirstLaunchAfterUpdated(appUpdateInfo)) return;
    silentReadyDialogShown = true;
    // OK-55397: silent-ready dialog removed — apply-on-restart is handled by
    // the pending install task queued in readyToInstall. Nothing to show here.
    // showSilentUpdateDialog();
    // deps: only re-run on status / strategy transitions.
    // appUpdateInfo is omitted intentionally — including the object ref
    // would re-fire on every unrelated field mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, appUpdateInfo.status, appUpdateInfo.updateStrategy]);

  // Single AppState listener for the whole app — replaces the per-mount
  // listeners that previously lived in `useAppUpdateInfo`. The service-
  // side cooldown gate is still consulted (defense-in-depth) but with
  // exactly one listener, the multi-mount race that motivated the
  // 30s cooldown band-aid no longer exists in practice.
  useEffect(() => {
    if (!enabled) return undefined;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const step =
        await backgroundApiProxy.serviceAppUpdate.shouldResumeStalledDownload();
      // Route by step so an ASC-only failure resumes via downloadASC()
      // instead of downloadPackage(). The latter clears downloadedEvent
      // and forces a full re-download of an already-on-disk package —
      // wasted bandwidth, especially under foreground/background churn
      // or a permanent 403/404 on the ASC URL.
      if (step === 'downloadPackage') {
        void downloadPackage();
      } else if (step === 'downloadASC') {
        void downloadASC();
      }
    });
    return () => sub.remove();
  }, [downloadASC, downloadPackage, enabled]);
}

/**
 * Mount-once foreground container for app-update side effects.
 * Renders nothing; just calls the hook with enabled=true.
 */
export function AppUpdateForeground() {
  useAppUpdateForegroundEffects(true);
  return null;
}

// Test-only escape hatch so the once-per-app guard can be reset between
// integration tests. Not exported via index.ts to keep the production
// API surface clean.
export function __resetAppUpdateForegroundForTests() {
  didRunFirstLaunchDispatch = false;
  silentReadyDialogShown = false;
}

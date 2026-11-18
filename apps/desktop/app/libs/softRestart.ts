import {
  getSafelyMainWindow,
  setMainWindow,
  showMainWindow,
} from './mainWindowAccess';
import { PROTOCOL } from './protocol';

import type { BrowserWindow, Session } from 'electron';

type ILoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type IStoreLike = {
  getUpdateBundleData: () =>
    | {
        appVersion?: string;
        bundleVersion?: string;
      }
    | undefined;
  resetConsecutiveBootFailCount: () => void;
};

export interface ISoftRestartRendererDeps {
  logger: ILoggerLike;
  app: {
    getVersion: () => string;
    exit: (code?: number) => void;
  };
  store: IStoreLike;
  getTrayWindow: () => unknown;
  destroyTrayWindow: () => void;
  setAppReady: (ready: boolean) => void;
  session: {
    defaultSession: Session;
  };
  createMainWindow: (opts: {
    isSoftRestart: boolean;
  }) => Promise<BrowserWindow | null>;
  getBundleIndexHtmlPath: () => string | undefined;
  getProcessMas: () => boolean | undefined;
}

export interface ISoftRestartRenderer {
  softRestartRenderer: () => Promise<void>;
  isSoftRestarting: () => boolean;
}

// MAS / Mac App Store builds cannot call `app.relaunch()` (sandbox forbids it),
// so a JS bundle update there cannot hard-restart. Instead we "soft restart":
// destroy the renderer and recreate it in-process. createMainWindow() re-runs
// processPreLaunchPendingTask() + getUpdateBundleData() + getBundleIndexHtmlPath()
// and (after the P0-1 uninterceptProtocol fix) rebinds the file:// interceptor to
// the new bundle, so the recreated window loads the freshly-installed bundle.
// The active bundle pointer was already written to the main-process store
// (store.setUpdateBundleData) before this runs, so no extra path wiring is needed.
export function createSoftRestartRenderer(
  deps: ISoftRestartRendererDeps,
): ISoftRestartRenderer {
  let softRestarting = false;
  const softRestartRenderer = async () => {
    if (softRestarting) {
      deps.logger.warn(
        '[softRestart] already in progress, ignoring re-entrant call',
      );
      return;
    }
    softRestarting = true;
    const startedAt = Date.now();
    const targetBundle = deps.store.getUpdateBundleData();
    deps.logger.info('[softRestart] begin', {
      mas: deps.getProcessMas(),
      targetAppVersion: targetBundle?.appVersion,
      targetBundleVersion: targetBundle?.bundleVersion,
      nativeVersion: deps.app.getVersion(),
      hadTrayWindow: !!deps.getTrayWindow(),
    });
    try {
      // Give the newly installed bundle a fresh boot-fail budget (the bundle-level
      // analog of createMainWindow's app-version-change reset). createMainWindow
      // then increments to 1 — the soft restart still COUNTS, so a new bundle that
      // crashes on boot accumulates toward the recovery page just like a cold boot,
      // while repeated SUCCESSFUL soft restarts can't trip recovery (each resets
      // here, then markBootSuccess clears it). This keeps the crash self-heal /
      // auto-rollback path alive on MAS where app.relaunch() is unavailable.
      deps.store.resetConsecutiveBootFailCount();
      // destroy() force-terminates the old renderer process (same as today's hard
      // restart), giving the recreated window a clean customElements registry and
      // killing any in-flight JS in the old renderer so it cannot re-trigger.
      getSafelyMainWindow()?.destroy();
      setMainWindow(null);
      deps.setAppReady(false);
      deps.logger.info('[softRestart] old renderer destroyed');
      // The macOS tray panel is a separate BrowserWindow running its own copy of
      // the bundle; it is NOT recreated by createMainWindow, so after a soft
      // restart it would keep running the OLD bundle. Destroy it (keeping the tray
      // icon + polling alive) so the next tray open lazily rebuilds it from the new
      // bundle (loadTrayUrl reads the current bundle path fresh on each create).
      deps.destroyTrayWindow();
      deps.logger.info(
        '[softRestart] tray window destroyed (will rebuild on demand)',
      );
      // Remove the previous window's file:// interceptor NOW, before the recreated
      // window's loadURL runs. The interceptor lives on the persistent
      // defaultSession (it outlives the window) and still captures the OLD bundle's
      // path + metadata. createMainWindow only re-registers it later, after an
      // `await getMetadata`, so without this the new bundle's very first
      // `file://{newBundle}/index.html` request would be served by the stale
      // interceptor → hash mismatch / tamper dialog / old bundle. Clearing it here
      // lets Chromium's default file handler serve the real new index.html (same
      // as a cold boot), and createMainWindow then installs a fresh interceptor.
      try {
        const wasIntercepted =
          deps.session.defaultSession.protocol.isProtocolIntercepted(PROTOCOL);
        if (wasIntercepted) {
          deps.session.defaultSession.protocol.uninterceptProtocol(PROTOCOL);
        }
        deps.logger.info('[softRestart] stale file interceptor cleared', {
          wasIntercepted,
        });
      } catch (e) {
        deps.logger.warn(
          '[softRestart] uninterceptProtocol before recreate failed',
          e,
        );
      }
      setMainWindow(await deps.createMainWindow({ isSoftRestart: true }));
      showMainWindow();
      deps.logger.info(
        '[softRestart] done: renderer recreated with new bundle',
        {
          durationMs: Date.now() - startedAt,
          indexHtml: deps.getBundleIndexHtmlPath(),
        },
      );
    } catch (e) {
      // If recreation fails there is no safe in-process recovery on MAS; exit so
      // the user can relaunch manually (equivalent to today's MAS behavior).
      deps.logger.error('[softRestart] failed, exiting', {
        durationMs: Date.now() - startedAt,
        error: e,
      });
      deps.app.exit(0);
    } finally {
      softRestarting = false;
    }
  };
  return {
    softRestartRenderer,
    isSoftRestarting: () => softRestarting,
  };
}

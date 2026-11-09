type ILoggerLike = {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export interface IRestartAppForBundleUpdateDeps {
  app: {
    relaunch: () => void;
    quit: () => void;
    exit: (code?: number) => void;
  };
  logger: ILoggerLike;
  getUpdateBundleData: () =>
    | {
        appVersion?: string;
        bundleVersion?: string;
      }
    | undefined;
  getMainWindow: () => { destroy: () => void } | undefined;
  getSoftRestartRenderer: () => (() => Promise<void>) | undefined;
}

// Single choke point for "restart the app to load the just-written bundle".
// The active bundle pointer (store.setUpdateBundleData) must already be
// written before calling this.
// - Normal builds: hard restart (destroy renderer + relaunch process).
// - MAS / Mac App Store builds: app.relaunch() is forbidden by the sandbox,
//   so we soft-restart — destroy + recreate the renderer in-process. The
//   main process (which hosts all kit-bg desktopApis and the bundle store)
//   stays alive, and createMainWindow() re-reads the new bundle pointer.
export async function restartAppForBundleUpdate(
  deps: IRestartAppForBundleUpdateDeps,
): Promise<void> {
  const bundleData = deps.getUpdateBundleData();
  deps.logger.info('bundle-restart', {
    mode: process.mas ? 'soft' : 'hard',
    mas: process.mas,
    appVersion: bundleData?.appVersion,
    bundleVersion: bundleData?.bundleVersion,
  });
  if (process.mas) {
    const softRestart = deps.getSoftRestartRenderer();
    if (!softRestart) {
      // Should not happen once the main window exists (the full
      // $desktopMainAppFunctions is assigned in createMainWindow). Log loudly
      // so an online "update applied but UI didn't refresh" report is
      // diagnosable, then fall back to a hard exit.
      deps.logger.error(
        'bundle-restart: softRestartRenderer unavailable, falling back to app.exit',
      );
      deps.getMainWindow()?.destroy();
      deps.app.exit(0);
      return;
    }
    await softRestart();
    return;
  }
  // Destroy window first to ensure renderer process is fully terminated
  // before relaunch, preventing webview custom element double registration
  deps.getMainWindow()?.destroy();
  deps.app.relaunch();
  if (process.platform === 'darwin') {
    // before-quit releases BLE native managers before Node environment teardown.
    deps.app.quit();
  } else {
    deps.app.exit(0);
  }
}

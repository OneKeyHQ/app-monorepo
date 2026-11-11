type ILoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type IElectronAppLike = {
  quit: () => void;
};

type IQuitWindowLike = {
  removeAllListeners: (event?: string) => void;
  close: () => void;
};

export type INativeBleInstanceLike = {
  stop?: () => void;
};

export type ITrezorBleSupportLike = {
  disposeForAppQuit: (
    releaseNoble?: (instance: INativeBleInstanceLike) => void,
  ) => Promise<void>;
};

type IAppUpdateLike = {
  hasPreparedQuitInstall: () => boolean;
  installOnQuit: () => Promise<unknown>;
};

export interface IBeforeQuitHandlerDeps {
  app: IElectronAppLike;
  isMac: boolean;
  logger: ILoggerLike;
  getDesktopApiAppUpdate: () => IAppUpdateLike;
  markAppQuitStarted: () => void;
  unregisterShortcuts: () => void;
  getBleQuitStarted: () => boolean;
  setBleQuitStarted: (started: boolean) => void;
  getBleQuitReady: () => boolean;
  setBleQuitReady: (ready: boolean) => void;
  getNobleBleInitialization: () => Promise<unknown>;
  getTrezorBleSupports: () => Set<ITrezorBleSupportLike>;
  disposeNobleBleSupport: (
    releaseNoble: (instance: INativeBleInstanceLike) => void,
  ) => Promise<unknown>;
  getSafelyMainWindow: () => IQuitWindowLike | undefined;
  destroyTrayManager: () => void;
  resetBootFailCountOnGracefulQuit: () => void;
  clearSystemIdleInterval: () => void;
  disposeContextMenu: () => void;
}

export function createBeforeQuitHandler(
  deps: IBeforeQuitHandlerDeps,
): (event: { preventDefault: () => void }) => void {
  const { logger } = deps;
  let quitInstallStarted = false;
  let quitInstallDone = false;

  return (event) => {
    deps.markAppQuitStarted();
    deps.unregisterShortcuts();
    if (deps.isMac && !deps.getBleQuitReady()) {
      event.preventDefault();
      if (deps.getBleQuitStarted()) return;
      deps.setBleQuitStarted(true);
      logger.info('[BLE] Process dispose started');
      const instances = new Set<INativeBleInstanceLike>();
      const stopped = new Set<INativeBleInstanceLike>();
      let draining = false;
      const stopNative = (instance: INativeBleInstanceLike) => {
        if (stopped.has(instance)) return;
        stopped.add(instance);
        try {
          instance.stop?.();
          logger.info('[BLE] Noble native manager stopped before app quit');
        } catch (error) {
          logger.error('[BLE] Noble native stop failed', error);
        }
      };
      const releaseNoble = (instance: INativeBleInstanceLike) => {
        instances.add(instance);
        if (draining) stopNative(instance);
      };
      let timeout: ReturnType<typeof setTimeout> | undefined;
      void Promise.race([
        Promise.allSettled([
          deps.getNobleBleInitialization(),
          deps.disposeNobleBleSupport(releaseNoble),
          ...Array.from(deps.getTrezorBleSupports(), (support) =>
            support.disposeForAppQuit(releaseNoble),
          ),
        ]).then((results) => {
          for (const result of results) {
            if (result.status === 'rejected') {
              logger.error('[BLE] Process dispose failed', result.reason);
            }
          }
        }),
        new Promise<void>((resolve) => {
          timeout = setTimeout(() => {
            logger.warn('[BLE] Process dispose timed out');
            resolve();
          }, 5000);
        }),
      ]).finally(() => {
        clearTimeout(timeout);
        draining = true;
        instances.forEach(stopNative);
        deps.getTrezorBleSupports().clear();
        logger.info('[BLE] Process dispose completed; resuming app quit');
        deps.setBleQuitReady(true);
        // Let the native before-quit callback return before retrying. An immediately
        // resolved cleanup can otherwise re-enter app.quit() and lose its quit state.
        setImmediate(() => deps.app.quit());
      });
      return;
    }

    if (!deps.isMac && !quitInstallDone) {
      if (quitInstallStarted) {
        event.preventDefault();
        return;
      }
      const appUpdate = deps.getDesktopApiAppUpdate();
      if (appUpdate.hasPreparedQuitInstall()) {
        event.preventDefault();
        quitInstallStarted = true;
        void appUpdate.installOnQuit().finally(() => {
          quitInstallDone = true;
          setImmediate(() => deps.app.quit());
        });
        return;
      }
    }

    if (deps.isMac) {
      deps.destroyTrayManager();
    }

    deps.resetBootFailCountOnGracefulQuit();

    deps.clearSystemIdleInterval();
    const safelyMainWindow = deps.getSafelyMainWindow();
    if (safelyMainWindow) {
      safelyMainWindow.removeAllListeners();
      safelyMainWindow.removeAllListeners('close');
      safelyMainWindow.close();
    }
    deps.disposeContextMenu();
  };
}

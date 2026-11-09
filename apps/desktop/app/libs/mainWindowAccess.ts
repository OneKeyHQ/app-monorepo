import type { BrowserWindow } from 'electron';

type ILoggerLike = {
  info: (...args: unknown[]) => void;
};

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

export function getSafelyMainWindow(): BrowserWindow | undefined {
  try {
    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      !mainWindow.webContents.isDestroyed()
    ) {
      return mainWindow;
    }
  } catch {
    // Window or webContents already destroyed
  }
  return undefined;
}

export function showMainWindow() {
  const safelyMainWindow = getSafelyMainWindow();
  safelyMainWindow?.show();
  safelyMainWindow?.focus();
}

export function createSafelyBrowserWindowGetter(
  getBrowserWindow: () => BrowserWindow | undefined,
): () => BrowserWindow | undefined {
  return () => {
    const browserWindow = getBrowserWindow();
    try {
      if (
        browserWindow &&
        !browserWindow.isDestroyed() &&
        !browserWindow.webContents.isDestroyed()
      ) {
        return browserWindow;
      }
    } catch {
      // Window or webContents already destroyed
    }
    return undefined;
  };
}

export function createMainWindowClosedHandler(params: {
  browserWindow: BrowserWindow;
  unregisterShortcuts: () => void;
  getAppReady: () => boolean;
  setAppReady: (ready: boolean) => void;
  logger: ILoggerLike;
}): () => void {
  return () => {
    params.unregisterShortcuts();
    if (getMainWindow() === params.browserWindow) {
      setMainWindow(null);
      params.setAppReady(false);
    }
    params.logger.info(
      'set isAppReady on browserWindow closed',
      params.getAppReady(),
    );
  };
}

import { isTrustedMainWindowUrl } from './desktopApiModuleAllowlist';

import type { BrowserWindow } from 'electron';

type ILoggerLike = {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

export interface IShellDocumentTrustState {
  selectedShellDocumentCommitted: boolean;
  trustedSameDocumentRouteUrl: string | undefined;
}

export type ITrustedMainWindowSenderFrame = {
  url: string;
} | null;

export type IIsTrustedMainWindowSender = (
  senderId: number,
  senderFrame: ITrustedMainWindowSenderFrame,
  mainFrame: ITrustedMainWindowSenderFrame,
) => boolean;

export function createShellDocumentTrustState(): IShellDocumentTrustState {
  return {
    selectedShellDocumentCommitted: false,
    trustedSameDocumentRouteUrl: undefined,
  };
}

export function createMainWindowSenderTrustPredicate(params: {
  state: IShellDocumentTrustState;
  getSafelyMainWindow: () => BrowserWindow | undefined;
  getSafelyBrowserWindow: () => BrowserWindow | undefined;
  getAppShellUrl: () => string;
  isDevServer: boolean;
}): IIsTrustedMainWindowSender {
  const getAppShellUrl = () => params.getAppShellUrl();
  return (senderId, senderFrame, mainFrame) => {
    try {
      const currentMainWindow =
        params.getSafelyMainWindow() ?? params.getSafelyBrowserWindow();
      return Boolean(
        currentMainWindow?.webContents.id === senderId &&
        senderFrame &&
        senderFrame === mainFrame &&
        params.state.selectedShellDocumentCommitted &&
        isTrustedMainWindowUrl(
          getAppShellUrl(),
          senderFrame.url,
          params.state.trustedSameDocumentRouteUrl,
          params.isDevServer,
        ),
      );
    } catch {
      return false;
    }
  };
}

// Keep the renderer navigable only inside the committed app shell document
// (plus same-document routes observed after it committed in dev-server mode).
export function installMainWindowShellNavigationHandlers(params: {
  browserWindow: BrowserWindow;
  state: IShellDocumentTrustState;
  getAppShellUrl: () => string;
  isDevServer: boolean;
  getSafelyBrowserWindow: () => BrowserWindow | undefined;
  logger: ILoggerLike;
}): void {
  const { browserWindow, state, isDevServer, getSafelyBrowserWindow, logger } =
    params;

  browserWindow.webContents.on('did-navigate', (_event, url) => {
    state.selectedShellDocumentCommitted = isTrustedMainWindowUrl(
      params.getAppShellUrl(),
      url,
      isDevServer ? state.trustedSameDocumentRouteUrl : undefined,
      isDevServer,
    );
    state.trustedSameDocumentRouteUrl =
      isDevServer && state.selectedShellDocumentCommitted ? url : undefined;
    if (!state.selectedShellDocumentCommitted) {
      try {
        if (
          new URL(params.getAppShellUrl()).protocol === 'file:' &&
          new URL(url).protocol === 'file:'
        ) {
          void getSafelyBrowserWindow()
            ?.loadURL(params.getAppShellUrl())
            .catch((error) =>
              logger.error('Failed to reload app shell:', error),
            );
        }
      } catch {
        // Invalid URLs cannot be recovered as local app-shell routes.
      }
    }
  });
  browserWindow.webContents.on(
    'did-navigate-in-page',
    (_event, url, isMainFrame) => {
      if (isMainFrame && state.selectedShellDocumentCommitted) {
        state.trustedSameDocumentRouteUrl = url;
      }
    },
  );

  const guardMainWindowNavigation = (event: Electron.Event, url: string) => {
    if (
      !isTrustedMainWindowUrl(
        params.getAppShellUrl(),
        url,
        isDevServer ? state.trustedSameDocumentRouteUrl : undefined,
        isDevServer,
      )
    ) {
      event.preventDefault();
      logger.warn(
        '[MainWindow] rejected navigation outside selected app shell',
      );
    }
  };
  browserWindow.webContents.on('will-navigate', guardMainWindowNavigation);
  browserWindow.webContents.on('will-redirect', guardMainWindowNavigation);
  browserWindow.webContents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame) guardMainWindowNavigation(event, event.url);
  });
}

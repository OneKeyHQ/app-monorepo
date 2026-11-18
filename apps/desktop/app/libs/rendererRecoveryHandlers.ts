import logger from 'electron-log/main';

import { isTrustedMainWindowUrl } from './desktopApiModuleAllowlist';
import { shouldReloadAppShellAfterFailedLoad } from './rendererLoadRecovery';

import type { BrowserWindow } from 'electron';

// When the main renderer dies, the window keeps its last frame but ignores all
// input. Reload it, capped so a renderer that crashes while booting cannot
// reload forever.
export const MAIN_RENDERER_RELOAD_WINDOW_MS = 5 * 60 * 1000;
export const MAIN_RENDERER_MAX_RELOADS_IN_WINDOW = 3;

export interface IMainRendererRecoveryState {
  bootFailed: boolean;
  reloadTimestamps: number[];
}

export function createMainRendererRecoveryState(): IMainRendererRecoveryState {
  return {
    bootFailed: false,
    reloadTimestamps: [],
  };
}

export interface IRenderProcessGoneDetails {
  reason: string;
  exitCode: number;
}

export function createRenderProcessGoneHandler(params: {
  state: IMainRendererRecoveryState;
  getSafelyBrowserWindow: () => BrowserWindow | undefined;
  getAppShellUrl: () => string;
  isAppQuitStarted: () => boolean;
  isBleQuitStarted: () => boolean;
  isSoftRestarting: () => boolean;
  setAppReady: (ready: boolean) => void;
}): (event: unknown, details: IRenderProcessGoneDetails) => void {
  return (_event, details) => {
    if (
      details.reason === 'clean-exit' ||
      params.isAppQuitStarted() ||
      params.isBleQuitStarted() ||
      params.isSoftRestarting()
    ) {
      return;
    }
    params.state.bootFailed = true;
    const now = Date.now();
    params.state.reloadTimestamps = params.state.reloadTimestamps.filter(
      (timestamp) => now - timestamp < MAIN_RENDERER_RELOAD_WINDOW_MS,
    );
    const logData = {
      reason: details.reason,
      exitCode: details.exitCode,
      recentReloads: params.state.reloadTimestamps.length,
    };
    if (
      params.state.reloadTimestamps.length >=
      MAIN_RENDERER_MAX_RELOADS_IN_WINDOW
    ) {
      logger.error(
        '[RendererRecovery] main renderer keeps crashing, not reloading',
        logData,
      );
      return;
    }
    params.state.reloadTimestamps.push(now);
    logger.warn('[RendererRecovery] main renderer gone, reloading', logData);
    // Start the reload after Electron finishes dispatching this event.
    setImmediate(() => {
      const safelyBrowserWindow = params.getSafelyBrowserWindow();
      if (
        !safelyBrowserWindow ||
        params.isAppQuitStarted() ||
        params.isBleQuitStarted() ||
        params.isSoftRestarting()
      ) {
        return;
      }
      // Deep links received while the page reboots wait for dom-ready.
      params.setAppReady(false);
      void safelyBrowserWindow.loadURL(params.getAppShellUrl());
    });
  };
}

export function createDidFailLoadHandler(params: {
  state: IMainRendererRecoveryState;
  getSafelyBrowserWindow: () => BrowserWindow | undefined;
  getAppShellUrl: () => string;
  isAppQuitStarted: () => boolean;
}): (
  event: unknown,
  errorCode: number,
  description: string,
  validatedURL: string,
  isMainFrame: boolean,
) => void {
  return (_event, errorCode, _description, validatedURL, isMainFrame) => {
    if (
      !params.isAppQuitStarted() &&
      isMainFrame &&
      errorCode !== -3 &&
      isTrustedMainWindowUrl(params.getAppShellUrl(), validatedURL)
    ) {
      params.state.bootFailed = true;
    }
    if (
      !shouldReloadAppShellAfterFailedLoad({
        validatedURL,
        isMainFrame,
        errorCode,
        appShellUrl: params.getAppShellUrl(),
      })
    ) {
      return;
    }
    logger.info('browserWindow >>>> reload app shell after failed load', {
      errorCode,
    });
    const w = params.getSafelyBrowserWindow();
    void w?.loadURL(params.getAppShellUrl());
  };
}

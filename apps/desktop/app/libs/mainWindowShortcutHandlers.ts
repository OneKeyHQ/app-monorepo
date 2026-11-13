import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import type { IDesktopAppState } from '@onekeyhq/shared/types/desktop';

import type { BrowserWindow } from 'electron';

// Shortcuts may only run while the main window is the focused, visible renderer.
// `bleQuitStarted` keeps a quitting app from re-registering them during teardown.
export function installMainWindowShortcutHandlers(params: {
  browserWindow: BrowserWindow;
  getSafelyBrowserWindow: () => BrowserWindow | undefined;
  getBleQuitStarted: () => boolean;
  ipcMessageKeys: {
    APP_STATE: string;
    APP_SHORTCUT: string;
  };
  registerShortcuts: (callback: (event: EShortcutEvents) => void) => void;
  unregisterShortcuts: () => void;
}): void {
  const { browserWindow, getSafelyBrowserWindow, ipcMessageKeys } = params;

  const registerWindowShortcuts = () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    if (
      params.getBleQuitStarted() ||
      !safelyBrowserWindow?.isFocused() ||
      !safelyBrowserWindow.isVisible()
    ) {
      return;
    }
    params.registerShortcuts((event) => {
      const w = getSafelyBrowserWindow();
      w?.webContents.send(ipcMessageKeys.APP_SHORTCUT, event);
    });
  };

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('enter-full-screen', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, undefined);
    registerWindowShortcuts();
  });

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('leave-full-screen', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, undefined);
  });

  browserWindow.on('focus', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    const state: IDesktopAppState = 'active';
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, state);
    registerWindowShortcuts();
  });

  browserWindow.on('blur', () => {
    params.unregisterShortcuts();
    const safelyBrowserWindow = getSafelyBrowserWindow();
    const state: IDesktopAppState = 'blur';
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, state);
  });

  browserWindow.on('hide', () => {
    params.unregisterShortcuts();
    const safelyBrowserWindow = getSafelyBrowserWindow();
    const state: IDesktopAppState = 'background';
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, state);
  });
}

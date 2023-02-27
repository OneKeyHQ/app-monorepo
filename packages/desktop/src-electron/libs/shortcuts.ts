import { app, globalShortcut } from 'electron';

import { ExplorerShortcutEvents } from '@onekeyhq/shared/types';

const isMac = process.platform === 'darwin';

const shortcutsMap = {
  [ExplorerShortcutEvents.NewTab]: {
    keys: 'CmdOrCtrl+N',
  },
  [ExplorerShortcutEvents.NewTabAndFocus]: {
    keys: 'CmdOrCtrl+T',
  },
  [ExplorerShortcutEvents.JumpToNextTab]: {
    keys: isMac ? 'Cmd+Alt+Right' : 'Ctrl+Tab',
  },
  [ExplorerShortcutEvents.GobackHistory]: {
    keys: 'Alt+Left',
  },
  [ExplorerShortcutEvents.GoForwardHistory]: {
    keys: 'Alt+Right',
  },
  [ExplorerShortcutEvents.CloseTab]: {
    keys: 'CmdOrCtrl+W',
  },
};

export function registerShortcuts(
  callback: (event: ExplorerShortcutEvents) => void,
) {
  app.whenReady().then(() => {
    Object.entries(shortcutsMap).forEach(([event, { keys }]) => {
      globalShortcut.register(keys, () => {
        callback(event as ExplorerShortcutEvents);
      });
    });
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

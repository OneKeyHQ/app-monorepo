import { app, globalShortcut } from 'electron';

import type { ExplorerShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { getShortcutsMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

const shortcutsMap = getShortcutsMap(process.platform === 'darwin');
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

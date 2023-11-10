import { app, globalShortcut } from 'electron';

import { getShortcutsMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import type { EExplorerShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

const shortcutsMap = getShortcutsMap(process.platform === 'darwin');
export function registerShortcuts(
  callback: (event: EExplorerShortcutEvents) => void,
) {
  void app.whenReady().then(() => {
    Object.entries(shortcutsMap).forEach(([event, { keys }]) => {
      if (keys) {
        globalShortcut.register(keys, () => {
          console.log('shortcut', event);
          callback(event as EExplorerShortcutEvents);
        });
      }
    });
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

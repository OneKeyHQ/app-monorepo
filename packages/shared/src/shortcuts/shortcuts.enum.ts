import { Alt } from '@onekeyhq/components/src/primitives/Icon/react/outline';

import platformEnv from '../platformEnv';

export enum EBrowserShortcutEvents {
  GoBackHistory = 'GoBackHistory',
  GoForwardHistory = 'GoForwardHistory',
  Refresh = 'Refresh',
  NewTab = 'NewTab',
  CloseTab = 'CloseTab',
}

export const getShortcutsMap: () => Record<
  EBrowserShortcutEvents,
  { keys: string | null; desc: string }
> = () => ({
  [EBrowserShortcutEvents.GoBackHistory]: {
    keys: 'CmdOrCtrl+[',
    desc: 'Go back history',
  },
  [EBrowserShortcutEvents.GoForwardHistory]: {
    keys: 'CmdOrCtrl+]',
    desc: 'Go forward history',
  },
  [EBrowserShortcutEvents.Refresh]: {
    keys: 'CmdOrCtrl+R',
    desc: 'Refresh',
  },
  [EBrowserShortcutEvents.NewTab]: {
    keys: 'CmdOrCtrl+T',
    desc: 'New Tab',
  },
  [EBrowserShortcutEvents.CloseTab]: {
    keys: 'CmdOrCtrl+W',
    desc: 'Close Tab',
  },
});

const isMacOSStyleInBrowser = () => {
  if (typeof navigator !== 'undefined') {
    if ('platform' in navigator) {
      return navigator.platform.toLowerCase().indexOf('mac') > -1;
    }
    if ('userAgentData' in navigator) {
      return (
        ((
          navigator as { userAgentData?: { platform: string } }
        ).userAgentData?.platform
          .toLowerCase()
          .indexOf('mac') || -1) > -1
      );
    }
  }
  return false;
};

const isMacStyleKeyboard =
  platformEnv.isDesktopMac ||
  platformEnv.isNativeIOS ||
  isMacOSStyleInBrowser();

export const keysMap = {
  CmdOrCtrl: isMacStyleKeyboard ? '⌘' : 'Ctrl',
  Alt: isMacStyleKeyboard ? '⌥' : 'Alt',
  Shift: isMacStyleKeyboard ? '⇧' : 'Shift',
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
  Search: '/',
};

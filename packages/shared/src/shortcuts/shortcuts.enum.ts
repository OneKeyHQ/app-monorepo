export enum EBrowserShortcutEvents {
  GoBackHistory = 'GoBackHistory',
  GoForwardHistory = 'GoForwardHistory',
  Refresh = 'Refresh',
  NewTab = 'NewTab',
  CloseTab = 'CloseTab',
  Search = 'Search',
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
  [EBrowserShortcutEvents.Search]: {
    keys: '/',
    desc: 'Search',
  },
});

export const getDisplayKeysMap = (isMac?: boolean) => ({
  CmdOrCtrl: isMac ? '⌘' : 'Ctrl',
  Alt: isMac ? '⌥' : 'Alt',
  Shift: isMac ? '⇧' : 'Shift',
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
  Search: '/',
});

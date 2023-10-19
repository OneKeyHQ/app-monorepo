export enum ExplorerShortcutEvents {
  NewTab = 'NewTab',
  NewTabAndFocus = 'NewTabAndFocus',
  JumpToNextTab = 'JumpToNextTab',
  GobackHistory = 'GobackHistory',
  GoForwardHistory = 'GoForwardHistory',
  CloseTab = 'CloseTab',
  CloseTabOnWinOrLinux = 'CloseTabOnWinOrLinux',
}

export const getShortcutsMap: (
  isMac?: boolean,
) => Record<ExplorerShortcutEvents, { keys: string | null; desc: string }> = (
  isMac,
) => ({
  [ExplorerShortcutEvents.NewTab]: {
    keys: 'CmdOrCtrl+N',
    desc: 'New Tab',
  },
  [ExplorerShortcutEvents.NewTabAndFocus]: {
    keys: 'CmdOrCtrl+T',
    desc: 'New Tab',
  },
  [ExplorerShortcutEvents.JumpToNextTab]: {
    keys: isMac ? 'Cmd+Alt+Right' : 'Ctrl+Tab',
    desc: 'New Tab',
  },
  [ExplorerShortcutEvents.GobackHistory]: {
    keys: 'Alt+Left',
    desc: 'New Tab',
  },
  [ExplorerShortcutEvents.GoForwardHistory]: {
    keys: 'Alt+Right',
    desc: 'New Tab',
  },
  [ExplorerShortcutEvents.CloseTab]: {
    keys: 'CmdOrCtrl+W',
    desc: 'Close Tab',
  },
  [ExplorerShortcutEvents.CloseTabOnWinOrLinux]: {
    keys: isMac ? null : 'Ctrl+F4',
    desc: 'Close Tab',
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
});

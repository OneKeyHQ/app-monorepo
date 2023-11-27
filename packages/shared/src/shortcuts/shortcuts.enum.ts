export enum EExplorerShortcutEvents {
  NewTab = 'NewTab',
  NewTabAndFocus = 'NewTabAndFocus',
  JumpToNextTab = 'JumpToNextTab',
  GoBackHistory = 'GoBackHistory',
  GoForwardHistory = 'GoForwardHistory',
  CloseTab = 'CloseTab',
  CloseTabOnWinOrLinux = 'CloseTabOnWinOrLinux',
}

export const getShortcutsMap: (
  isMac?: boolean,
) => Record<EExplorerShortcutEvents, { keys: string | null; desc: string }> = (
  isMac,
) => ({
  [EExplorerShortcutEvents.NewTab]: {
    keys: 'CmdOrCtrl+N',
    desc: 'New Tab',
  },
  [EExplorerShortcutEvents.NewTabAndFocus]: {
    keys: 'CmdOrCtrl+T',
    desc: 'New Tab',
  },
  [EExplorerShortcutEvents.JumpToNextTab]: {
    keys: isMac ? 'Cmd+Alt+Right' : 'Ctrl+Tab',
    desc: 'New Tab',
  },
  [EExplorerShortcutEvents.GoBackHistory]: {
    keys: 'Alt+Left',
    desc: 'New Tab',
  },
  [EExplorerShortcutEvents.GoForwardHistory]: {
    keys: 'Alt+Right',
    desc: 'New Tab',
  },
  [EExplorerShortcutEvents.CloseTab]: {
    keys: 'CmdOrCtrl+W',
    desc: 'Close Tab',
  },
  [EExplorerShortcutEvents.CloseTabOnWinOrLinux]: {
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

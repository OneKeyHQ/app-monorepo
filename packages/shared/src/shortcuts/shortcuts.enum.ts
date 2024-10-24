import { shortcutsKeys } from './shortcutsKeys.enum';

export enum EShortcutEvents {
  GoBackHistory = 'GoBackHistory',
  GoForwardHistory = 'GoForwardHistory',
  Refresh = 'Refresh',
  NewTab = 'NewTab',
  CloseTab = 'CloseTab',
  SideBar = 'SideBar',
  Settings = 'Settings',
}

const CmdOrCtrl = shortcutsKeys.CmdOrCtrl;

export const shortcutsMap: Record<
  EShortcutEvents,
  { keys: string[]; desc: string }
> = {
  [EShortcutEvents.GoBackHistory]: {
    keys: [CmdOrCtrl, '['],
    desc: 'Go back history',
  },
  [EShortcutEvents.GoForwardHistory]: {
    keys: [CmdOrCtrl, ']'],
    desc: 'Go forward history',
  },
  [EShortcutEvents.Refresh]: {
    keys: [CmdOrCtrl, 'R'],
    desc: 'Refresh',
  },
  [EShortcutEvents.NewTab]: {
    keys: [CmdOrCtrl, 'T'],
    desc: 'New Tab',
  },
  [EShortcutEvents.CloseTab]: {
    keys: [CmdOrCtrl, 'W'],
    desc: 'Close Tab',
  },
  [EShortcutEvents.SideBar]: {
    keys: [CmdOrCtrl, 'S'],
    desc: 'Open / Close SideBar',
  },
  [EShortcutEvents.Settings]: {
    keys: [CmdOrCtrl, ','],
    desc: 'Open Settings',
  },
};

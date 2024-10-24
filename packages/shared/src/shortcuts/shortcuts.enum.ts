import { shortcutsKeys } from './shortcutsKeys.enum';

export enum EShortcutEvents {
  GoBackHistory = 'GoBackHistory',
  GoForwardHistory = 'GoForwardHistory',
  Refresh = 'Refresh',
  NewTab = 'NewTab',
  CloseTab = 'CloseTab',
  SideBar = 'SideBar',
  SearchInPage = 'SearchInPage',
  CopyAddress = 'CopyAddress',
  AccountSelector = 'AccountSelector',
  NetworkSelector = 'NetworkSelector',
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
  [EShortcutEvents.SearchInPage]: {
    keys: [CmdOrCtrl, 'F'],
    desc: 'Search in Page',
  },
  [EShortcutEvents.CopyAddress]: {
    keys: [CmdOrCtrl, shortcutsKeys.Shift, 'C'],
    desc: 'Copy Address',
  },
  [EShortcutEvents.AccountSelector]: {
    keys: [CmdOrCtrl, 'P'],
    desc: 'Account Selector',
  },
  [EShortcutEvents.NetworkSelector]: {
    keys: [CmdOrCtrl, 'O'],
    desc: 'Network Selector',
  },
};

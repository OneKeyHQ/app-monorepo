import { shortcutsKeys } from './shortcutsKeys.enum';

export enum EShortcutEvents {
  GoBackHistory = 'GoBackHistory',
  GoForwardHistory = 'GoForwardHistory',
  Refresh = 'Refresh',
  NewTab = 'NewTab',
  NewTab2 = 'NewTab2',
  CloseTab = 'CloseTab',
  SideBar = 'SideBar',
  SearchInPage = 'SearchInPage',
  CopyAddressOrUrl = 'CopyAddressOrUrl',
  AccountSelector = 'AccountSelector',
  NetworkSelector = 'NetworkSelector',
  TabWallet = 'TabWallet',
  TabEarn = 'TabEarn',
  TabSwap = 'TabSwap',
  TabMarket = 'TabMarket',
  TabBrowser = 'TabBrowser',
  ViewHistory = 'ViewHistory',
  ViewBookmark = 'ViewBookmark',
  AddOrRemoveBookmark = 'AddOrRemoveBookmark',
  PinOrUnpinTab = 'PinOrUnpinTab',
}

export const shortcutsMap: Record<
  EShortcutEvents,
  { keys: string[]; desc: string }
> = {
  [EShortcutEvents.GoBackHistory]: {
    keys: [shortcutsKeys.CmdOrCtrl, '['],
    desc: 'Go back history',
  },
  [EShortcutEvents.GoForwardHistory]: {
    keys: [shortcutsKeys.CmdOrCtrl, ']'],
    desc: 'Go forward history',
  },
  [EShortcutEvents.Refresh]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'R'],
    desc: 'Refresh',
  },
  [EShortcutEvents.NewTab]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'T'],
    desc: 'New Tab',
  },
  [EShortcutEvents.NewTab2]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'N'],
    desc: 'New Tab2',
  },
  [EShortcutEvents.CloseTab]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'W'],
    desc: 'Close Tab',
  },
  [EShortcutEvents.SideBar]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'S'],
    desc: 'Open / Close SideBar',
  },
  [EShortcutEvents.SearchInPage]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'F'],
    desc: 'Search in Page',
  },
  [EShortcutEvents.CopyAddressOrUrl]: {
    keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'C'],
    desc: 'Copy Address',
  },
  [EShortcutEvents.AccountSelector]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'P'],
    desc: 'Account Selector',
  },
  [EShortcutEvents.NetworkSelector]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'O'],
    desc: 'Network Selector',
  },
  [EShortcutEvents.TabWallet]: {
    keys: [shortcutsKeys.CmdOrCtrl, '1'],
    desc: 'Wallet Tab',
  },
  [EShortcutEvents.TabEarn]: {
    keys: [shortcutsKeys.CmdOrCtrl, '2'],
    desc: 'Earn Tab',
  },
  [EShortcutEvents.TabSwap]: {
    keys: [shortcutsKeys.CmdOrCtrl, '3'],
    desc: 'Swap Tab',
  },
  [EShortcutEvents.TabMarket]: {
    keys: [shortcutsKeys.CmdOrCtrl, '4'],
    desc: 'Market Tab',
  },
  [EShortcutEvents.TabBrowser]: {
    keys: [shortcutsKeys.CmdOrCtrl, '5'],
    desc: 'Browser Tab',
  },
  [EShortcutEvents.ViewHistory]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'Y'],
    desc: 'View History',
  },
  [EShortcutEvents.ViewBookmark]: {
    keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'B'],
    desc: 'View Bookmark',
  },
  [EShortcutEvents.AddOrRemoveBookmark]: {
    keys: [shortcutsKeys.CmdOrCtrl, 'D'],
    desc: 'Add or Remove Bookmark',
  },
  [EShortcutEvents.PinOrUnpinTab]: {
    keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'P'],
    desc: 'Pin or Unpin Tab',
  },
};

import { ETabRoutes } from '../routes/tab';

import { EShortcutEvents } from './shortcuts.enum';

const tabRouteShortcutMap: Partial<Record<ETabRoutes, EShortcutEvents>> = {
  [ETabRoutes.Home]: EShortcutEvents.TabWallet,
  [ETabRoutes.Market]: EShortcutEvents.TabMarket,
  [ETabRoutes.Swap]: EShortcutEvents.TabSwap,
  [ETabRoutes.Perp]: EShortcutEvents.TabPerps,
  [ETabRoutes.Earn]: EShortcutEvents.TabEarn,
  [ETabRoutes.ReferFriends]: EShortcutEvents.TabReferAFriend,
  [ETabRoutes.Discovery]: EShortcutEvents.TabBrowser,
  [ETabRoutes.DeviceManagement]: EShortcutEvents.TabMyOneKey,
  [ETabRoutes.Developer]: EShortcutEvents.TabDeveloper,
};

const shortcutEventAriaKeyMap: Partial<Record<EShortcutEvents, string>> = {
  [EShortcutEvents.TabWallet]: 'Control+1',
  [EShortcutEvents.TabMarket]: 'Control+2',
  [EShortcutEvents.TabSwap]: 'Control+3',
  [EShortcutEvents.TabPerps]: 'Control+4',
  [EShortcutEvents.TabEarn]: 'Control+5',
  [EShortcutEvents.TabReferAFriend]: 'Control+6',
  [EShortcutEvents.TabBrowser]: 'Control+7',
  [EShortcutEvents.TabMyOneKey]: 'Control+8',
  [EShortcutEvents.TabDeveloper]: 'Control+9',
};

export function getTabRouteShortcutEvent(
  routeName: string,
): EShortcutEvents | undefined {
  return tabRouteShortcutMap[routeName as ETabRoutes];
}

export function getTabRouteAriaKeyShortcut(
  routeName: string,
): string | undefined {
  const shortcutEvent = getTabRouteShortcutEvent(routeName);
  if (!shortcutEvent) {
    return undefined;
  }
  return shortcutEventAriaKeyMap[shortcutEvent];
}

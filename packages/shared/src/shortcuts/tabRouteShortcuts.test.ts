import { ETabRoutes } from '../routes/tab';

import { EShortcutEvents } from './shortcuts.enum';
import {
  getTabRouteAriaKeyShortcut,
  getTabRouteShortcutEvent,
} from './tabRouteShortcuts';

describe('tabRouteShortcuts', () => {
  it.each([
    [ETabRoutes.Home, EShortcutEvents.TabWallet],
    [ETabRoutes.Market, EShortcutEvents.TabMarket],
    [ETabRoutes.Swap, EShortcutEvents.TabSwap],
    [ETabRoutes.Perp, EShortcutEvents.TabPerps],
    [ETabRoutes.Earn, EShortcutEvents.TabEarn],
    [ETabRoutes.ReferFriends, EShortcutEvents.TabReferAFriend],
    [ETabRoutes.Discovery, EShortcutEvents.TabBrowser],
    [ETabRoutes.DeviceManagement, EShortcutEvents.TabMyOneKey],
    [ETabRoutes.Developer, EShortcutEvents.TabDeveloper],
  ] as const)('maps %s to %s', (route, shortcutEvent) => {
    expect(getTabRouteShortcutEvent(route)).toBe(shortcutEvent);
  });

  it('returns undefined for routes without tab shortcuts', () => {
    expect(getTabRouteShortcutEvent(ETabRoutes.BulkSend)).toBeUndefined();
  });

  it('returns aria key shortcuts in Control syntax', () => {
    expect(getTabRouteAriaKeyShortcut(ETabRoutes.Home)).toBe('Control+1');
    expect(getTabRouteAriaKeyShortcut(ETabRoutes.Developer)).toBe('Control+9');
  });
});

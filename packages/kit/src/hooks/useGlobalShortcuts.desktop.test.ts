/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useShortcuts } from '@onekeyhq/components';
import { EModalRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { EUniversalSearchSource } from '@onekeyhq/shared/types/search';

import useAppNavigation from './useAppNavigation';
import { useGlobalShortcuts } from './useGlobalShortcuts.desktop';
import { useShortcutsRouteStatus } from './useListenTabFocusState';

jest.mock('@onekeyhq/components', () => ({
  useShortcuts: jest.fn(),
}));

jest.mock('./useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./useListenTabFocusState', () => ({
  useShortcutsRouteStatus: jest.fn(),
}));

const mockUseShortcuts = useShortcuts as jest.Mock;
const mockUseAppNavigation = useAppNavigation as jest.Mock;
const mockUseShortcutsRouteStatus = useShortcutsRouteStatus as jest.Mock;

describe('useGlobalShortcuts', () => {
  it('attributes universal search to the current tab when the shortcut fires', () => {
    const pushModal = jest.fn();
    const currentTabRoute = { current: ETabRoutes.Home };
    let shortcutHandler: ((event: EShortcutEvents) => void) | undefined;

    mockUseAppNavigation.mockReturnValue({ pushModal });
    mockUseShortcutsRouteStatus.mockReturnValue({
      currentTabRoute,
      isAtBrowserTab: { current: false },
      shouldReloadAppByCmdR: { current: true },
    });
    mockUseShortcuts.mockImplementation(
      (_scope: unknown, handler: (event: EShortcutEvents) => void) => {
        shortcutHandler = handler;
      },
    );

    renderHook(() => useGlobalShortcuts());

    act(() => shortcutHandler?.(EShortcutEvents.UniversalSearch));
    expect(pushModal).toHaveBeenLastCalledWith(
      EModalRoutes.UniversalSearchModal,
      {
        screen: EUniversalSearchPages.UniversalSearch,
        params: { source: EUniversalSearchSource.Wallet },
      },
    );

    currentTabRoute.current = ETabRoutes.Perp;
    act(() => shortcutHandler?.(EShortcutEvents.UniversalSearch));
    expect(pushModal).toHaveBeenLastCalledWith(
      EModalRoutes.UniversalSearchModal,
      {
        screen: EUniversalSearchPages.UniversalSearch,
        params: { source: EUniversalSearchSource.Perps },
      },
    );

    currentTabRoute.current = ETabRoutes.MultiTabBrowser;
    act(() => shortcutHandler?.(EShortcutEvents.UniversalSearch));
    expect(pushModal).toHaveBeenLastCalledWith(
      EModalRoutes.UniversalSearchModal,
      {
        screen: EUniversalSearchPages.UniversalSearch,
        params: { source: EUniversalSearchSource.Browser },
      },
    );
  });
});

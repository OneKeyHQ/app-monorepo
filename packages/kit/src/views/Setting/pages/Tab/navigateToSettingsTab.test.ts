import {
  EModalRoutes,
  EModalSettingRoutes,
  ERootRoutes,
  ESettingsTabNames,
} from '@onekeyhq/shared/src/routes';

import { tryNavigateToSettingsTabInModal } from './navigateToSettingsTab';

const mockNavigate = jest.fn();
const mockGetRootState = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      getRootState: () => {
        const state: unknown = mockGetRootState();
        return state;
      },
      navigate: (...args: unknown[]) => {
        mockNavigate(...args);
      },
    },
  },
}));

describe('tryNavigateToSettingsTabInModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    {
      name: 'route params',
      settingRoute: {
        name: ERootRoutes.Modal,
        params: { screen: EModalRoutes.SettingModal },
      },
    },
    {
      name: 'nested navigation state',
      settingRoute: {
        name: ERootRoutes.Modal,
        state: {
          index: 0,
          routes: [{ name: EModalRoutes.SettingModal }],
        },
      },
    },
  ])('selects the mounted settings tab from $name', ({ settingRoute }) => {
    mockGetRootState.mockReturnValue({
      index: 1,
      routes: [{ name: ERootRoutes.Main }, settingRoute],
    });

    expect(
      tryNavigateToSettingsTabInModal(ESettingsTabNames.Notifications),
    ).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith(
      EModalSettingRoutes.SettingListModal,
      { screen: ESettingsTabNames.Notifications },
    );
  });

  it('does not navigate when another modal is active', () => {
    mockGetRootState.mockReturnValue({
      index: 1,
      routes: [
        { name: ERootRoutes.Main },
        {
          name: ERootRoutes.Modal,
          params: { screen: EModalRoutes.UniversalSearchModal },
        },
      ],
    });

    expect(
      tryNavigateToSettingsTabInModal(ESettingsTabNames.Notifications),
    ).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

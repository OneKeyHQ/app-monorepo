/** @jest-environment jsdom */

import { fireEvent, render, waitFor } from '@testing-library/react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalRoutes,
  EModalSettingRoutes,
  ERootRoutes,
  ESettingsTabNames,
} from '@onekeyhq/shared/src/routes';
import {
  EUniversalSearchSource,
  EUniversalSearchType,
  type IUniversalSearchSettings,
} from '@onekeyhq/shared/types/search';

import { UniversalSearchSettingsItem } from './UniversalSearchSettingsItem';

const mockPop = jest.fn();
const mockPushModal = jest.fn();
const mockAddIntoRecentSearchList = jest.fn();
const mockRootNavigate = jest.fn();
const mockGetRootState = jest.fn();
let mockIsTabNavigator = true;

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  SizableText: ({ children }: { children?: React.ReactNode }) => children,
  rootNavigationRef: {
    current: {
      getRootState: () => {
        const state: unknown = mockGetRootState();
        return state;
      },
      navigate: (...args: unknown[]) => {
        mockRootNavigate(...args);
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const ListItem = ({
    children,
    onPress,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
  }) =>
    ReactModule.createElement(
      'button',
      { 'data-testid': 'settings-result', onClick: onPress },
      children,
    );
  ListItem.Text = ({ primary }: { primary?: React.ReactNode }) =>
    ReactModule.createElement('span', null, primary);
  return { ListItem };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pop: mockPop,
    pushModal: mockPushModal,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/universalSearch', () => ({
  useUniversalSearchActions: () => ({
    current: {
      addIntoRecentSearchList: mockAddIntoRecentSearchList,
    },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Setting/pages/Tab/useIsTabNavigator',
  () => ({
    useIsTabNavigator: () => mockIsTabNavigator,
  }),
);
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    universalSearch: {
      search: {
        universalSearchClick: jest.fn(),
      },
    },
    setting: {
      page: {
        settingItemClicked: jest.fn(),
      },
    },
  },
}));

const mockUniversalSearchClick = jest.spyOn(
  defaultLogger.universalSearch.search,
  'universalSearchClick',
);
const mockSettingItemClicked = jest.spyOn(
  defaultLogger.setting.page,
  'settingItemClicked',
);
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn(async () => undefined),
  },
}));

const settingsResult: IUniversalSearchSettings = {
  type: EUniversalSearchType.Settings,
  payload: {
    id: 'notifications',
    title: 'Notifications',
    icon: 'BellOutline',
    sectionName: ESettingsTabNames.Preferences,
    sectionTitle: 'Preferences',
    sectionIcon: 'SliderThreeOutline',
    settingsTab: ESettingsTabNames.Notifications,
  },
};

const sectionFallbackResult: IUniversalSearchSettings = {
  type: EUniversalSearchType.Settings,
  payload: {
    id: 'theme',
    title: 'Theme',
    icon: 'PaletteOutline',
    sectionName: ESettingsTabNames.Preferences,
    sectionTitle: 'Preferences',
    sectionIcon: 'SliderThreeOutline',
  },
};

const dappConnectionsResult: IUniversalSearchSettings = {
  type: EUniversalSearchType.Settings,
  payload: {
    id: 'dapp-connections',
    title: 'dApp connections',
    icon: 'LinkOutline',
    sectionTitle: 'Security',
    sectionIcon: 'Shield2CheckOutline',
    settingRoute: EModalSettingRoutes.SettingDAppConnectionList,
  },
};

describe('UniversalSearchSettingsItem settings tab navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTabNavigator = true;
  });

  it('selects the tab in the existing Settings modal instead of pushing a duplicate modal', async () => {
    mockGetRootState.mockReturnValue({
      index: 1,
      routes: [
        { name: ERootRoutes.Main },
        {
          name: ERootRoutes.Modal,
          state: {
            index: 0,
            routes: [{ name: EModalRoutes.SettingModal }],
          },
        },
      ],
    });

    const { getByTestId } = render(
      <UniversalSearchSettingsItem
        item={settingsResult}
        getSearchInput={() => 'notifications'}
        source={EUniversalSearchSource.Browser}
      />,
    );
    fireEvent.click(getByTestId('settings-result'));

    await waitFor(() => {
      expect(mockRootNavigate).toHaveBeenCalledWith(
        EModalSettingRoutes.SettingListModal,
        { screen: ESettingsTabNames.Notifications },
      );
    });
    expect(mockPushModal).not.toHaveBeenCalled();
    expect(mockUniversalSearchClick).toHaveBeenCalledWith({
      source: EUniversalSearchSource.Browser,
      searchText: 'notifications',
      type: EUniversalSearchType.Settings,
      itemId: 'notifications',
      itemTitle: 'Notifications',
    });
    expect(mockSettingItemClicked).toHaveBeenCalledWith({
      itemId: 'notifications',
      category: ESettingsTabNames.Preferences,
      source: 'universalSearch',
    });
  });

  it('opens Settings at the target tab when Settings is not already active', async () => {
    mockGetRootState.mockReturnValue({
      index: 0,
      routes: [{ name: ERootRoutes.Main }],
    });

    const { getByTestId } = render(
      <UniversalSearchSettingsItem
        item={settingsResult}
        getSearchInput={() => 'notifications'}
        source={EUniversalSearchSource.Browser}
      />,
    );
    fireEvent.click(getByTestId('settings-result'));

    await waitFor(() => {
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListModal,
        params: { screen: ESettingsTabNames.Notifications },
      });
    });
    expect(mockRootNavigate).not.toHaveBeenCalled();
  });

  it('keeps an explicit id for analytics and recents while navigating by route', async () => {
    const { getByTestId } = render(
      <UniversalSearchSettingsItem
        item={dappConnectionsResult}
        getSearchInput={() => 'dapp'}
        source={EUniversalSearchSource.Browser}
      />,
    );
    fireEvent.click(getByTestId('settings-result'));

    await waitFor(() => {
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingDAppConnectionList,
      });
    });
    expect(mockUniversalSearchClick).toHaveBeenCalledWith({
      source: EUniversalSearchSource.Browser,
      searchText: 'dapp',
      type: EUniversalSearchType.Settings,
      itemId: 'dapp-connections',
      itemTitle: 'dApp connections',
    });
    expect(mockAddIntoRecentSearchList).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'settings-dapp-connections' }),
    );
  });

  it('uses the parent category tab for custom controls without a leaf route', async () => {
    mockGetRootState.mockReturnValue({
      index: 1,
      routes: [
        { name: ERootRoutes.Main },
        {
          name: ERootRoutes.Modal,
          state: {
            index: 0,
            routes: [{ name: EModalRoutes.SettingModal }],
          },
        },
      ],
    });

    const { getByTestId } = render(
      <UniversalSearchSettingsItem
        item={sectionFallbackResult}
        getSearchInput={() => 'theme'}
        source={EUniversalSearchSource.Browser}
      />,
    );
    fireEvent.click(getByTestId('settings-result'));

    await waitFor(() => {
      expect(mockRootNavigate).toHaveBeenCalledWith(
        EModalSettingRoutes.SettingListModal,
        { screen: ESettingsTabNames.Preferences },
      );
    });
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('opens Settings at the parent category tab when no Settings modal is active', async () => {
    mockGetRootState.mockReturnValue({
      index: 0,
      routes: [{ name: ERootRoutes.Main }],
    });

    const { getByTestId } = render(
      <UniversalSearchSettingsItem
        item={sectionFallbackResult}
        getSearchInput={() => 'theme'}
        source={EUniversalSearchSource.Browser}
      />,
    );
    fireEvent.click(getByTestId('settings-result'));

    await waitFor(() => {
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListModal,
        params: { screen: ESettingsTabNames.Preferences },
      });
    });
    expect(mockRootNavigate).not.toHaveBeenCalled();
  });

  it('keeps the standalone category page fallback on mobile layouts', async () => {
    mockIsTabNavigator = false;

    const { getByTestId } = render(
      <UniversalSearchSettingsItem
        item={sectionFallbackResult}
        getSearchInput={() => 'theme'}
        source={EUniversalSearchSource.Browser}
      />,
    );
    fireEvent.click(getByTestId('settings-result'));

    await waitFor(() => {
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListSubModal,
        params: {
          name: ESettingsTabNames.Preferences,
          title: 'Preferences',
        },
      });
    });
    expect(mockRootNavigate).not.toHaveBeenCalled();
  });
});

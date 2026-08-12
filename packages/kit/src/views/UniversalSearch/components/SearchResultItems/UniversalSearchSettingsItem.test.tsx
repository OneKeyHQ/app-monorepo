/** @jest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EUniversalSearchSource,
  EUniversalSearchType,
  type IUniversalSearchSettings,
} from '@onekeyhq/shared/types/search';

import { UniversalSearchSettingsItem } from './UniversalSearchSettingsItem';

const mockPop = jest.fn();
const mockPushModal = jest.fn();
const mockAddIntoRecentSearchList = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  SizableText: ({ children }: { children?: React.ReactNode }) => children,
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

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    universalSearch: {
      search: {
        universalSearchClick: jest.fn(),
      },
    },
  },
}));

const mockUniversalSearchClick = jest.spyOn(
  defaultLogger.universalSearch.search,
  'universalSearchClick',
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
    title: 'Notifications',
    icon: 'BellOutline',
    sectionName: 'Preferences',
    sectionTitle: 'Preferences',
    sectionIcon: 'SliderThreeOutline',
  },
};

describe('UniversalSearchSettingsItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the modal entry source on result click events', () => {
    const { getByTestId } = render(
      <UniversalSearchSettingsItem
        item={settingsResult}
        getSearchInput={() => 'notifications'}
        source={EUniversalSearchSource.Browser}
      />,
    );

    fireEvent.click(getByTestId('settings-result'));

    expect(mockUniversalSearchClick).toHaveBeenCalledWith({
      source: EUniversalSearchSource.Browser,
      searchText: 'notifications',
      type: EUniversalSearchType.Settings,
      itemId: 'Preferences',
      itemTitle: 'Notifications',
    });
  });
});

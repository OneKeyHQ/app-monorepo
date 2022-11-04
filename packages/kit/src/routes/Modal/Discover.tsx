import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { SearchModalView } from '@onekeyhq/kit/src/views/Discover/Explorer/Search/SearchModalView';
import { ShareView } from '@onekeyhq/kit/src/views/Discover/Share';

import { MatchDAppItemType } from '../../views/Discover/Explorer/explorerUtils';

import createStackNavigator from './createStackNavigator';

export enum DiscoverModalRoutes {
  SearchHistoryModal = 'SearchHistoryModal',
  ShareModal = 'ShareModal',
}

export type DiscoverRoutesParams = {
  [DiscoverModalRoutes.SearchHistoryModal]: {
    url: string | undefined;
    onSelectorItem?: (item: MatchDAppItemType | string) => void;
  };
  [DiscoverModalRoutes.ShareModal]: {
    url: string;
    name?: string;
    logoURL?: string;
  };
};

const DiscoverNavigator = createStackNavigator<DiscoverRoutesParams>();

const modalRoutes = [
  {
    name: DiscoverModalRoutes.SearchHistoryModal,
    component: SearchModalView,
  },
  {
    name: DiscoverModalRoutes.ShareModal,
    component: ShareView,
  },
];

const DiscoverModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DiscoverNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DiscoverNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DiscoverNavigator.Navigator>
  );
};

export default DiscoverModalStack;

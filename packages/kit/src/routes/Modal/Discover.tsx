import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { SearchModalView } from '@onekeyhq/kit/src/views/Discover/Explorer/Search/SearchModalView';
import type { MatchDAppItemType } from '@onekeyhq/kit/src/views/Discover/Explorer/Search/useSearchHistories';

import createStackNavigator from './createStackNavigator';

export enum DiscoverModalRoutes {
  SearchHistoryModal = 'SearchHistoryModal',
}

export type DiscoverRoutesParams = {
  [DiscoverModalRoutes.SearchHistoryModal]: {
    url: string | undefined;
    onSelectorItem?: (item: MatchDAppItemType | string) => void;
  };
};

const DiscoverNavigator = createStackNavigator<DiscoverRoutesParams>();

const modalRoutes = [
  {
    name: DiscoverModalRoutes.SearchHistoryModal,
    component: SearchModalView,
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

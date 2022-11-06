import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import NFTSearchModal from '../../views/NFTMarket/NFTSearchModal';
import {
  SearchNFTCollectionRoutes,
  SearchNFTCollectionRoutesParams,
} from '../../views/NFTMarket/NFTSearchModal/type';

import createStackNavigator from './createStackNavigator';

const SearchNFTCollectionNavigator =
  createStackNavigator<SearchNFTCollectionRoutesParams>();

const modalRoutes = [
  {
    name: SearchNFTCollectionRoutes.SearchModal,
    component: NFTSearchModal,
  },
];

const SearchNFTCollectionStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <SearchNFTCollectionNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <SearchNFTCollectionNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </SearchNFTCollectionNavigator.Navigator>
  );
};

export default SearchNFTCollectionStack;
export { SearchNFTCollectionRoutes };
export type { SearchNFTCollectionRoutesParams };

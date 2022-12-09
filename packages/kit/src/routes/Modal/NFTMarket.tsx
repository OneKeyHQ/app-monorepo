import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import NFTAttributesModal from '../../views/NFTMarket/Modals/NFTAttributesModal';
import NFTSearchModal from '../../views/NFTMarket/Modals/NFTSearchModal';
import ShareNFTNPLModal from '../../views/NFTMarket/Modals/Share';
import {
  NFTMarketRoutes,
  NFTMarketRoutesParams,
} from '../../views/NFTMarket/Modals/type';

import createStackNavigator from './createStackNavigator';

const NFTMarketNavigator = createStackNavigator<NFTMarketRoutesParams>();

const modalRoutes = [
  {
    name: NFTMarketRoutes.FilterModal,
    component: NFTAttributesModal,
  },
  {
    name: NFTMarketRoutes.SearchModal,
    component: NFTSearchModal,
  },
  {
    name: NFTMarketRoutes.ShareNFTNPLModal,
    component: ShareNFTNPLModal,
  },
];

const NFTMarketStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <NFTMarketNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <NFTMarketNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </NFTMarketNavigator.Navigator>
  );
};

export default NFTMarketStack;
export { NFTMarketRoutes };
export type { NFTMarketRoutesParams };

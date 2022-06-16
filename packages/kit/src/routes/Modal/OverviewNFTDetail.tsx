import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import OverviewNFTsDetail from '@onekeyhq/kit/src/views/Overview/NFTsDetail';
import { NFTsGroup } from '@onekeyhq/kit/src/views/Overview/type';

import createStackNavigator from './createStackNavigator';

export enum OverviewNFTDetailRoutes {
  OverviewNFTDetailScreen = 'OverviewNFTDetailScreen',
}

export type OverviewNFTDetailRoutesParams = {
  [OverviewNFTDetailRoutes.OverviewNFTDetailScreen]: {
    group: NFTsGroup;
  };
};

const modalRoutes = [
  {
    name: OverviewNFTDetailRoutes.OverviewNFTDetailScreen,
    component: OverviewNFTsDetail,
  },
];
const NFTDetailNavigator =
  createStackNavigator<OverviewNFTDetailRoutesParams>();

const NFTDetailModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <NFTDetailNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <NFTDetailNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </NFTDetailNavigator.Navigator>
  );
};

export default NFTDetailModalStack;

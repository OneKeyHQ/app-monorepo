import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import ShareNFTNPLModal from '../../views/NFTMarket/NPL/Share';
import {
  ShareNFTNPLRoutes,
  ShareNFTNPLRoutesParams,
} from '../../views/NFTMarket/NPL/Share/type';

import createStackNavigator from './createStackNavigator';

const ShareNFTNPLNavigator = createStackNavigator<ShareNFTNPLRoutesParams>();

const modalRoutes = [
  {
    name: ShareNFTNPLRoutes.ShareNFTNPLModal,
    component: ShareNFTNPLModal,
  },
];

const ShareNFTNPLStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ShareNFTNPLNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ShareNFTNPLNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ShareNFTNPLNavigator.Navigator>
  );
};

export default ShareNFTNPLStack;
export { ShareNFTNPLRoutes };
export type { ShareNFTNPLRoutesParams };

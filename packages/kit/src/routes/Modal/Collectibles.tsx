import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { Collectible, MoralisNFT } from '@onekeyhq/engine/src/types/moralis';
import { Network } from '@onekeyhq/engine/src/types/network';
import CollectibleDetail from '@onekeyhq/kit/src/views/Wallet/Collectibles/CollectibleDetailModal';
import Collection from '@onekeyhq/kit/src/views/Wallet/Collectibles/CollectionModal';

import createStackNavigator from './createStackNavigator';

export enum CollectiblesModalRoutes {
  CollectionModal = 'CollectionModal',
  CollectibleDetailModal = 'CollectibleDetailModal',
}

export type CollectiblesRoutesParams = {
  [CollectiblesModalRoutes.CollectionModal]: {
    collectible: Collectible;
    network: Network;
  };
  [CollectiblesModalRoutes.CollectibleDetailModal]: {
    asset: MoralisNFT;
    network: Network;
    // address?: string | null;
  };
};

const CollectibleNavigator = createStackNavigator<CollectiblesRoutesParams>();

const modalRoutes = [
  {
    name: CollectiblesModalRoutes.CollectionModal,
    component: Collection,
  },
  {
    name: CollectiblesModalRoutes.CollectibleDetailModal,
    component: CollectibleDetail,
  },
];

const CollectibleModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <CollectibleNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <CollectibleNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </CollectibleNavigator.Navigator>
  );
};

export default CollectibleModalStack;

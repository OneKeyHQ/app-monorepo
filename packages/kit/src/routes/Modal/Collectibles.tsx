import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import CollectibleDetail from '@onekeyhq/kit/src/views/Wallet/NFT/CollectibleDetailModal';
import CollectionModalView from '@onekeyhq/kit/src/views/Wallet/NFT/CollectionModal';

import createStackNavigator from './createStackNavigator';

export enum CollectiblesModalRoutes {
  CollectionModal = 'CollectionModal',
  CollectibleDetailModal = 'CollectibleDetailModal',
}

export type CollectiblesRoutesParams = {
  [CollectiblesModalRoutes.CollectionModal]: {
    collectible: Collection;
    network: Network;
  };
  [CollectiblesModalRoutes.CollectibleDetailModal]: {
    asset: NFTAsset;
    network: Network;
    // address?: string | null;
  };
};

const CollectibleNavigator = createStackNavigator<CollectiblesRoutesParams>();

const modalRoutes = [
  {
    name: CollectiblesModalRoutes.CollectionModal,
    component: CollectionModalView,
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

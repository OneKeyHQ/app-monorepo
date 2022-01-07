import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import CollectibleDetail from '@onekeyhq/kit/src/views/Wallet/Collectibles/CollectibleDetailModal';
import Collection from '@onekeyhq/kit/src/views/Wallet/Collectibles/CollectionModal';

export enum CollectiblesModalRoutes {
  CollectionModal = 'CollectionModal',
  CollectibleDetailModal = 'CollectibleDetailModal',
}

export type CollectiblesRoutesParams = {
  [CollectiblesModalRoutes.CollectionModal]: { id: string | number };
  [CollectiblesModalRoutes.CollectibleDetailModal]: {
    assetId: string | number;
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

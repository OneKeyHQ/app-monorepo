import { useIsVerticalLayout } from '@onekeyhq/components';

import NFTAttributesModal from '../../views/NFTMarket/NFTAttributesModal';
import { NFTAttributeFilterRoutes } from '../../views/NFTMarket/NFTAttributesModal/type';

import createStackNavigator from './createStackNavigator';

import type { NFTAttributeFilterRoutesParams } from '../../views/NFTMarket/NFTAttributesModal/type';

const NFTAttributeFilterNavigator =
  createStackNavigator<NFTAttributeFilterRoutesParams>();

const modalRoutes = [
  {
    name: NFTAttributeFilterRoutes.FilterModal,
    component: NFTAttributesModal,
  },
];

const NFTAttributeFilterStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <NFTAttributeFilterNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <NFTAttributeFilterNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </NFTAttributeFilterNavigator.Navigator>
  );
};

export default NFTAttributeFilterStack;
export { NFTAttributeFilterRoutes };
export type { NFTAttributeFilterRoutesParams };

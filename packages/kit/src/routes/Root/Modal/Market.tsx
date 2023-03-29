import { useIsVerticalLayout } from '@onekeyhq/components';

import MarketSrarchModal from '../../../views/Market/MarketSearch';
import { MarketRoutes } from '../../../views/Market/types';

import createStackNavigator from './createStackNavigator';

import type { MarketRoutesParams } from '../../../views/Market/types';

const MarketModalNavigator = createStackNavigator<MarketRoutesParams>();

const modalRoutes = [
  {
    name: MarketRoutes.MarketSearchModal,
    component: MarketSrarchModal,
  },
];

const MarketModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <MarketModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <MarketModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </MarketModalNavigator.Navigator>
  );
};

export default MarketModalStack;
export type { MarketRoutesParams };

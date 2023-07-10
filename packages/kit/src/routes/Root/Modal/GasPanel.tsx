import { useIsVerticalLayout } from '@onekeyhq/components';

import { GasPanel } from '../../../views/GasPanel';
import { GasPanelRoutes } from '../../../views/GasPanel/types';

import createStackNavigator from './createStackNavigator';

import type { GasPanelRoutesParams } from '../../../views/GasPanel/types';

const GasPanelNavigator = createStackNavigator<GasPanelRoutesParams>();

const modalRoutes = [
  {
    name: GasPanelRoutes.GasPanelModal,
    component: GasPanel,
  },
];

const GasPanelModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <GasPanelNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <GasPanelNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </GasPanelNavigator.Navigator>
  );
};

export default GasPanelModalStack;
export type { GasPanelRoutesParams };

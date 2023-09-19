import { useIsVerticalLayout } from '@onekeyhq/components';

import { MonitorSettings } from '../../../views/Monitor';
import { MonitorRoutes } from '../../../views/Monitor/types';

import createStackNavigator from './createStackNavigator';

import type { MonitorRouteParams } from '../../../views/Monitor/types';

const MonitorNavigator = createStackNavigator<MonitorRouteParams>();

const modalRoutes = [
  {
    name: MonitorRoutes.monitorSetting,
    component: MonitorSettings,
  },
];

const MonitorStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <MonitorNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <MonitorNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </MonitorNavigator.Navigator>
  );
};

export type { MonitorRouteParams };
export default MonitorStack;

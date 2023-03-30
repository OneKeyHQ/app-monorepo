import { useIsVerticalLayout } from '@onekeyhq/components';

import { useOnboardingRequired } from '../../../hooks/useOnboardingRequired';
import Connection from '../../../views/DappModals/Connection';
import NetworkNotMatch from '../../../views/DappModals/NetworkNotMatch';
import { DappConnectionModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

import type { DappConnectionRoutesParams } from '../../../views/DappModals/types';

const DappConnectionModalNavigator =
  createStackNavigator<DappConnectionRoutesParams>();

const modalRoutes = [
  {
    name: DappConnectionModalRoutes.ConnectionModal,
    component: Connection,
  },
  {
    name: DappConnectionModalRoutes.NetworkNotMatchModal,
    component: NetworkNotMatch,
  },
];

const DappConnectionStack = () => {
  useOnboardingRequired();
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DappConnectionModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DappConnectionModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DappConnectionModalNavigator.Navigator>
  );
};

export default DappConnectionStack;
export type { DappConnectionRoutesParams };

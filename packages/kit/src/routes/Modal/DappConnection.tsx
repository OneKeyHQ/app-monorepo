import { useIsVerticalLayout } from '@onekeyhq/components';
import Connection from '@onekeyhq/kit/src/views/DappModals/Connection';
import NetworkNotMatch from '@onekeyhq/kit/src/views/DappModals/NetworkNotMatch';

import { useOnboardingRequired } from '../../hooks/useOnboardingRequired';
import { DappConnectionModalRoutes } from '../../views/DappModals/types';

import createStackNavigator from './createStackNavigator';

import type { DappConnectionRoutesParams } from '../../views/DappModals/types';

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
export { DappConnectionModalRoutes };
export type { DappConnectionRoutesParams };

import { useIsVerticalLayout } from '@onekeyhq/components';

import NostrAuthenticationModal from '../../../views/Account/AddNewAccount/Authentication';
import GetPublicKeyModal from '../../../views/Nostr/GetPublicKeyModal';
import { NostrModalRoutes } from '../../../views/Nostr/types';

import createStackNavigator from './createStackNavigator';

import type { NostrRoutesParams } from '../../../views/Nostr/types';

const NostrNavigator = createStackNavigator<NostrRoutesParams>();

const modalRoutes = [
  {
    name: NostrModalRoutes.GetPublicKey,
    component: GetPublicKeyModal,
  },
  {
    name: NostrModalRoutes.NostrAuthentication,
    component: NostrAuthenticationModal,
  },
];

const NostrModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <NostrNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <NostrNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </NostrNavigator.Navigator>
  );
};

export default NostrModalStack;
export type { NostrRoutesParams };

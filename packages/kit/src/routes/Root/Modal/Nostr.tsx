import { useIsVerticalLayout } from '@onekeyhq/components';

import NostrAuthenticationModal from '../../../views/Account/AddNewAccount/Authentication';
import ExportPubkeyModal from '../../../views/Nostr/ExportPubkeyModal';
import GetPublicKeyModal from '../../../views/Nostr/GetPublicKeyModal';
import SignEventModal from '../../../views/Nostr/SignEventModal';
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
    name: NostrModalRoutes.SignEvent,
    component: SignEventModal,
  },
  {
    name: NostrModalRoutes.NostrAuthentication,
    component: NostrAuthenticationModal,
  },
  {
    name: NostrModalRoutes.ExportPubkey,
    component: ExportPubkeyModal,
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

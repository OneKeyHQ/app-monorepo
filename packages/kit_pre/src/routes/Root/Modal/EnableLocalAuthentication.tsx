import { useIsVerticalLayout } from '@onekeyhq/components';

import EnableLocalAuthentication from '../../../views/EnableLocalAuthentication';
import { EnableLocalAuthenticationRoutes } from '../../../views/EnableLocalAuthentication/types';
import EnableWebAuthn from '../../../views/EnableWebAuthn';

import createStackNavigator from './createStackNavigator';

import type { EnableLocalAuthenticationRoutesParams } from '../../../views/EnableLocalAuthentication/types';

const EnableLocalAuthenticationNavigator =
  createStackNavigator<EnableLocalAuthenticationRoutesParams>();

const modalRoutes = [
  {
    name: EnableLocalAuthenticationRoutes.EnableLocalAuthenticationModal,
    component: EnableLocalAuthentication,
  },
  {
    name: EnableLocalAuthenticationRoutes.EnableWebAuthn,
    component: EnableWebAuthn,
  },
];

const PasswordModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <EnableLocalAuthenticationNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <EnableLocalAuthenticationNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </EnableLocalAuthenticationNavigator.Navigator>
  );
};

export type { EnableLocalAuthenticationRoutesParams };
export default PasswordModalStack;

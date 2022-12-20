import { useIsVerticalLayout } from '@onekeyhq/components';
import EnableLocalAuthentication from '@onekeyhq/kit/src/views/EnableLocalAuthentication';
import type { EnableLocalAuthenticationRoutesParams } from '@onekeyhq/kit/src/views/EnableLocalAuthentication/types';
import { EnableLocalAuthenticationRoutes } from '@onekeyhq/kit/src/views/EnableLocalAuthentication/types';
import EnableWebAuthn from '@onekeyhq/kit/src/views/EnableWebAuthn';

import createStackNavigator from './createStackNavigator';

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
export { EnableLocalAuthenticationRoutes };
export default PasswordModalStack;

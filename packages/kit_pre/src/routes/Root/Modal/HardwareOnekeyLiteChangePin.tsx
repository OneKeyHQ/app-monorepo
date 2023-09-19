import { useIsVerticalLayout } from '@onekeyhq/components';

import OnekeyLiteChangePin from '../../../views/Hardware/OnekeyLite/ChangePin';
import {
  OnekeyLiteCurrentPinCode,
  OnekeyLiteNewRepeatPinCode,
  OnekeyLiteNewSetPinCode,
} from '../../../views/Hardware/OnekeyLite/ChangePinInputPin';
import { OnekeyLiteChangePinModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

import type {
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from '../../../views/Hardware/OnekeyLite/routes';

export type OnekeyLiteChangePinRoutesParams = {
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinInputPinModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteChangePinInputPinModal];
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinSetModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteChangePinSetModal];
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinRepeatModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteChangePinRepeatModal];
  [OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteChangePinModal];
};

const OnekeyLitePinNavigator =
  createStackNavigator<OnekeyLiteChangePinRoutesParams>();

const modalRoutes = [
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinInputPinModal,
    component: OnekeyLiteCurrentPinCode,
  },
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinSetModal,
    component: OnekeyLiteNewSetPinCode,
  },
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinRepeatModal,
    component: OnekeyLiteNewRepeatPinCode,
  },
  {
    name: OnekeyLiteChangePinModalRoutes.OnekeyLiteChangePinModal,
    component: OnekeyLiteChangePin,
  },
];

const OnekeyLitePinModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <OnekeyLitePinNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <OnekeyLitePinNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </OnekeyLitePinNavigator.Navigator>
  );
};

export default OnekeyLitePinModalStack;

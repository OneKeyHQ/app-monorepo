import { useMemo } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootSiblingParent } from 'react-native-root-siblings';

import { HomeRoutes } from '../../../routes/routesEnum';
import { createLazyComponent } from '../../../utils/createLazyComponent';
import EnterPhrase from '../Screen/EnterPhrase';
import ImportKeyTag from '../Screen/ImportKeyTag';
import Introduce from '../Screen/IntroduceKeyTag';
import KeyTagBackupWalletAttentions from '../Screen/KeyTagAttentions';
import KeyTagBackUpWallet from '../Screen/KeyTagBackUpWallet';
import ShowDotMap from '../Screen/ShowDotMap';
import StartedKeyTag from '../Screen/StartedKeyTag';
import VerifyPassword from '../Screen/VerifyPassword';

import { KeyTagRoutes } from './enums';

import type { HomeRoutesParams } from '../../../routes/types';
import type { IKeytagRoutesParams } from './types';

const RouteOnboarding = createLazyComponent(
  () => import('../../Onboarding/routes/RouteOnboarding'),
);

export const stackScreenList = [
  { name: KeyTagRoutes.StartedKeytag, component: StartedKeyTag },
  { name: KeyTagRoutes.ImportKeytag, component: ImportKeyTag },
  { name: KeyTagRoutes.ShowDotMap, component: ShowDotMap },
  { name: KeyTagRoutes.IntroduceKeyTag, component: Introduce },
  { name: KeyTagRoutes.KeyTagBackUpWallet, component: KeyTagBackUpWallet },
  { name: KeyTagRoutes.EnterPhrase, component: EnterPhrase },
  { name: KeyTagRoutes.KeyTagVerifyPassword, component: VerifyPassword },
  {
    name: KeyTagRoutes.KeyTagAttention,
    component: KeyTagBackupWalletAttentions,
  },
  { name: HomeRoutes.HomeOnboarding, component: RouteOnboarding },
];

export const StackNavigator = createNativeStackNavigator<
  IKeytagRoutesParams & HomeRoutesParams
>();

export function RouteKeytag() {
  const stackScreens = useMemo(
    () =>
      stackScreenList.map((stack) => (
        <StackNavigator.Screen
          key={stack.name}
          name={stack.name}
          component={stack.component}
        />
      )),
    [],
  );

  return (
    <RootSiblingParent>
      <StackNavigator.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {stackScreens}
      </StackNavigator.Navigator>
    </RootSiblingParent>
  );
}

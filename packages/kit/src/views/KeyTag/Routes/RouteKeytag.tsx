import { useMemo } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootSiblingParent } from 'react-native-root-siblings';

import EnterPhrase from '../Screen/EnterPhrase';
import ImportKeyTag from '../Screen/ImportKeyTag';
import Introduce from '../Screen/IntroduceKeyTag';
import KeyTagBackUpWallet from '../Screen/KeyTagBackUpWallet';
import ShowDotMap from '../Screen/ShowDotMap';
import StartedKeyTag from '../Screen/StartedKeyTag';

import { KeyTagRoutes } from './enums';

import type { IKeytagRoutesParams } from './types';

export const stackScreenList = [
  { name: KeyTagRoutes.StartedKeytag, component: StartedKeyTag },
  { name: KeyTagRoutes.ImportKeytag, component: ImportKeyTag },
  { name: KeyTagRoutes.ShowDotMap, component: ShowDotMap },
  { name: KeyTagRoutes.IntroduceKeyTag, component: Introduce },
  { name: KeyTagRoutes.KeyTagBackUpWallet, component: KeyTagBackUpWallet },
  { name: KeyTagRoutes.EnterPhrase, component: EnterPhrase },
];

export const StackNavigator = createNativeStackNavigator<IKeytagRoutesParams>();

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

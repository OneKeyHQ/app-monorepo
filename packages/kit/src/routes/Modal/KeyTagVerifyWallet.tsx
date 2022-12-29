import { useIsVerticalLayout } from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';

import KeyTagBackupWalletAttentions from '../../views/KeyTag/Screen/KeyTagAttentions';
import VerifyPassword from '../../views/KeyTag/Screen/VerifyPassword';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export enum KeyTagVerifyWalletRoutes {
  KeyTagVerifyPassword = 'KeyTagVerifyPassword',
  KeyTagAttensions = 'KeyTagAttensions',
}

export type KeyTagVerifyWalletRoutesParams = {
  [KeyTagVerifyWalletRoutes.KeyTagAttensions]: {
    walletId: string;
    password: string;
    wallet?: IWallet;
  };
  [KeyTagVerifyWalletRoutes.KeyTagVerifyPassword]: {
    walletId: string;
    wallet?: IWallet;
  };
};

const KeyTagVerifyWalletNavigator =
  createStackNavigator<KeyTagVerifyWalletRoutesParams>();

const modalRoutes = [
  {
    name: KeyTagVerifyWalletRoutes.KeyTagVerifyPassword,
    component: VerifyPassword,
  },
  {
    name: KeyTagVerifyWalletRoutes.KeyTagAttensions,
    component: KeyTagBackupWalletAttentions,
  },
];

const KeyTagVerifyWalletModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <KeyTagVerifyWalletNavigator.Navigator
      screenOptions={(navInfo) => ({
        headerShown: false,
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map(({ name, component }) => (
        <KeyTagVerifyWalletNavigator.Screen
          key={name}
          name={name}
          component={component}
        />
      ))}
    </KeyTagVerifyWalletNavigator.Navigator>
  );
};

export default KeyTagVerifyWalletModalStack;

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ManagerWalletLocalValidationView from '@onekeyhq/kit/src/views/ManagerWallet/LocalValidationModal';
import ModifyWalletEmojiView from '@onekeyhq/kit/src/views/ManagerWallet/ModifyWallet/emoji';
import ModifyWalletNameView from '@onekeyhq/kit/src/views/ManagerWallet/ModifyWallet/name';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';

import type { ValidationFields } from '../../components/Protected/types';

export enum ManagerWalletModalRoutes {
  ManagerWalletModal = 'ManagerWalletModal',
  ManagerWalletAuthorityVerifyModal = 'ManagerWalletAuthorityVerifyModal',
  ManagerWalletModifyNameModal = 'ManagerWalletModifyNameModal',
  ManagerWalletModifyEmojiModal = 'ManagerWalletModifyEmojiModal',
}

export type ManagerWalletRoutesParams = {
  [ManagerWalletModalRoutes.ManagerWalletModal]: {
    walletId: string;
  };
  [ManagerWalletModalRoutes.ManagerWalletModifyNameModal]: {
    walletId: string;
  };
  [ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal]: {
    requestId: string;
    onSuccess: (requestId: string, password: string) => void;
    onCancel: () => void;
    field?: ValidationFields;
  };
  [ManagerWalletModalRoutes.ManagerWalletModifyEmojiModal]: {
    avatar: Avatar;
    onDone: (avatar: Avatar) => void;
  };
};

const ManagerWalletNavigator =
  createStackNavigator<ManagerWalletRoutesParams>();

const modalRoutes = [
  {
    name: ManagerWalletModalRoutes.ManagerWalletModifyNameModal,
    component: ModifyWalletNameView,
  },
  {
    name: ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal,
    component: ManagerWalletLocalValidationView,
  },
  {
    name: ManagerWalletModalRoutes.ManagerWalletModifyEmojiModal,
    component: ModifyWalletEmojiView,
  },
];

const ManagerWalletModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManagerWalletNavigator.Navigator
      screenOptions={(navInfo) => ({
        headerShown: false,
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <ManagerWalletNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManagerWalletNavigator.Navigator>
  );
};

export default ManagerWalletModalStack;

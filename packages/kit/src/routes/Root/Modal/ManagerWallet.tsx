import { useIsVerticalLayout } from '@onekeyhq/components';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';

import ManagerWalletLocalValidationView from '../../../views/ManagerWallet/LocalValidationModal';
import ModifyWalletEmojiView from '../../../views/ManagerWallet/ModifyWallet/emoji';
import ModifyWalletNameView from '../../../views/ManagerWallet/ModifyWallet/name';
import { ManagerWalletModalRoutes } from '../../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { ValidationFields } from '../../../components/Protected/types';

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

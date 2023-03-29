import { useIsVerticalLayout } from '@onekeyhq/components';
import type { AccountCredential } from '@onekeyhq/engine/src/types/account';

import ManagerAccountModalView from '../../../views/ManagerAccount/AccountInfo';
import ExportPrivateViewModal from '../../../views/ManagerAccount/ExportPrivate';
import { ManagerAccountModalRoutes } from '../../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export type ManagerAccountRoutesParams = {
  [ManagerAccountModalRoutes.ManagerAccountModal]: {
    walletId: string;
    accountId: string;
    networkId: string;
    refreshAccounts: () => void;
  };
  [ManagerAccountModalRoutes.ManagerAccountExportPrivateModal]: {
    accountId: string;
    networkId: string;
    accountCredential: AccountCredential;
  };
};

const ManagerAccountNavigator =
  createStackNavigator<ManagerAccountRoutesParams>();

const modalRoutes = [
  {
    name: ManagerAccountModalRoutes.ManagerAccountModal,
    component: ManagerAccountModalView,
  },
  {
    name: ManagerAccountModalRoutes.ManagerAccountExportPrivateModal,
    component: ExportPrivateViewModal,
  },
];

const ManagerAccountModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManagerAccountNavigator.Navigator
      screenOptions={(navInfo) => ({
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <ManagerAccountNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManagerAccountNavigator.Navigator>
  );
};

export default ManagerAccountModalStack;
